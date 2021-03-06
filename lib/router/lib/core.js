Router.configure({
  layoutTemplate: 'layout',
  loadingTemplate: 'loading',
  notFoundTemplate: 'notFound'
});

Router.requireLogin = function() {
  if (!Meteor.user()) {
    if (Meteor.loggingIn()) {
      this.render(this.loadingTemplate);
    } else {
      Router.go('login');
    }
  } else {
    this.next();
  }
};

Router.requireLoggedOut = function() {
  if (Meteor.user()) {
    if (Meteor.loggingIn()) {
      this.render(this.loadingTemplate);
    } else {
      Router.go('home');
    }
  } else {
    this.next();
  }
};

Router.goToRelevant = function () {
  if (Session.get(CURRENT_COLLECTION_KEY)) {
    Router.go('collection', Session.get(CURRENT_COLLECTION_KEY));
  } else {
    Router.go('home');
  }
};