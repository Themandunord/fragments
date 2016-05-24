const PAGE_SIZE = 15; // items per page
const PREFETCH_HEIGHT = 450; // px
const SCROLL_THROTTLE = 180; // ms
const APPEAR_DELAY = 150; // ms
const DISAPPEAR_DELAY = 450; // ms

Template.fragmentsList.helpers({
  // the fragments cursor
  fragments: function () {
    var instance = Template.instance();
    var cursor = Template.instance().fragments();

    cursor.observe({
      changedAt: function () {
        if (typeof instance.recollect === 'undefined') {
          return;
        }

        setTimeout(function () {
          instance.recollect();
        }, 1);
      }
    });

    return cursor;
  },
  // are there more fragments to show?
  isBusy: function () {
    return Template.instance().isBusy.get() || Session.get(APP_BUSY_KEY);
  },
  textSearch: function () {
    return Session.get(CURRENT_SEARCH_KEY);
  },
  currentCollection: function () {
    return Session.get(CURRENT_COLLECTION_KEY);
  },
  isEmpty: function () {
    return !Template.instance().fragments().count();
  },
  displaySubmitForm: function () {
    // Don't display when fragments are filtered by a search
    if (Session.get(CURRENT_SEARCH_KEY)) {
      return false;
    }

    var collection = Session.get(CURRENT_COLLECTION_KEY);
    if (collection) {
      // Don't display when the user is not the owner of the current collection
      return collection.user === Meteor.userId();
    }

    return true;
  }
});

var $window = $(window);
var onWindowScroll = function (event) {
  var instance = event.data,
      $list = instance.$masonry,
      listHeight = $list.height();

  if (instance.isBusy.get()) {
    return;
  }

  var offset = $window.scrollTop(),
      viewportHeight = $window.height(),
      contentHeight = parseInt($list.height() || $list.css('height'));

  if (offset < (contentHeight - viewportHeight - PREFETCH_HEIGHT)) {
    return;
  }

  instance.isBusy.set(true);

  // get current value for limit, i.e. how many posts are currently displayed
  var limit = instance.limit.get();

  // increase limit
  limit += PAGE_SIZE;
  instance.limit.set(limit);
};

var throttledScroll = _.throttle(onWindowScroll, SCROLL_THROTTLE);

Template.fragmentsList.onCreated(function () {

  // 1. Initialization
  var instance = this;

  // initialize the reactive variables
  instance.isBusy = new ReactiveVar(true);
  instance.loaded = new ReactiveVar(0);
  instance.limit = new ReactiveVar(PAGE_SIZE);

  // 2. Autorun

  // will re-run when the reactive variables changes
  instance.autorun(function () {
    var limit = instance.limit.get(),
        textQuery = Session.get(CURRENT_SEARCH_KEY),
        tag = Session.get(CURRENT_TAG_KEY),
        collection = Session.get(CURRENT_COLLECTION_KEY),
        options = {
          sort: {
            created_at: -1
          },
          limit: limit
        };

    if (textQuery) {
      options.text = textQuery;
    }

    if (collection) {
      options.collection = collection._id;
    }

    if (tag) {
      options.tag = tag;
    }

    // subscribe to the posts publication
    var subscription = instance.subscribe('fragments', options, function () {
      instance.recollect();
    });

    // if subscription is ready, set limit to newLimit
    if (subscription.ready()) {
      instance.loaded.set(limit);
      instance.isBusy.set(false);
    }
  });

  // 3. Cursor

  instance.fragments = function() {
    return Fragments.find({}, { sort: { created_at: -1 }, limit: instance.loaded.get() });
  }

  // 4. UI Events
  $(window).on('scroll', instance, throttledScroll);
});

Template.fragmentsList.onDestroyed(function () {
  this.$masonry.masonry('destroy');
  delete this.$masonry;
  $(window).off('scroll', throttledScroll);
});

Template.fragmentsList.onRendered(function () {
  // setup masonry
  var selector = '.fragments-list',
      $masonry = this.$(selector),
      instance = Template.instance();

  this.$masonry = $masonry;

  $masonry.masonry({
    itemSelector: '.fragment-item',
    transitionDuration: 0
  });

  this.recollect = function () {
    if (instance.$masonry) {
      instance.$masonry.masonry('reloadItems').masonry('layout');
    }
  };

  this.find(selector)._uihooks = {
    insertElement: (node, next) => {
      var $node = $(node);

      if (this.loaded.get()) {
        $node.addClass('reduce-animations');
      }

      $node.addClass('appearing').insertBefore(next);

      this.recollect();

      setTimeout(() => {
        $node.removeClass('appearing reduce-animations');
      }, !this.loaded.get() ? 0 : APPEAR_DELAY);
    },
    removeElement: (node) => {
      var $node = $(node);
      $(node).addClass('removing');

      setTimeout(() => {
        $node.remove();
        this.recollect();
      }, DISAPPEAR_DELAY);
    }
  }
});
