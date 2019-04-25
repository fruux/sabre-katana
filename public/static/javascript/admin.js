/**
 * @license
 *
 * sabre/katana.
 * Copyright (C) 2016 fruux GmbH (https://fruux.com/)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

var ENV = ENV || {};

ENV['katana'] = {
    origin_url: window.location.origin,
    base_url  : window.location.pathname.replace(/\/+[^\/]*$/, '/') + 'server.php/'
};
ENV['simple-auth'] = {
    // Declare our custom authorizer.
    authorizer         : 'authorizer:custom',

    // The session is stored in memory, it disappears when the application
    // reload.
    store              : 'simple-auth-session-store:ephemeral',

    // Login page.
    authenticationRoute: '/'
};

/**
 * Declare our own custom authenticator and authorizer.
 */
Ember.Application.initializer({
    name      : 'authentication',
    before    : 'simple-auth',
    initialize: function(container, application) {
        container.register('authenticator:custom', Katana.CustomAuthenticator);
        container.register('authorizer:custom',    Katana.CustomAuthorizer);
    }
});

/**
 * Create the application.
 */
Katana = Ember.Application.create({

    /**
     * The last user activity, used to detect inactivity and invalidate the
     * session.
     */
    lastActivity: null,

    ready: function()
    {
        this.lastActivity = new Date();
    }

});

/**
 * The custom authenticator is based on the HTTP Basic Authorization.
 */
Katana.CustomAuthenticator = SimpleAuth.Authenticators.Base.extend({

    /**
     * We never restore the session for security reasons.
     */
    restore: function(data)
    {
        return new Ember.RSVP.Promise(
            function(resolve, reject) {
                reject();
            }
        );
    },

    /**
     * To authenticate the session, we `PROPFIND` the root of the server with
     * the given credentials. If it succeeds, it means the server validates
     * these credentials.
     */
    authenticate: function(credentials)
    {
        var basic = btoa(
            (credentials.username || '') +
            ':' +
            (credentials.password || '')
        );

        return new Ember.RSVP.Promise(
            function(resolve, reject) {
                Ember.$.ajax({
                    method : 'PROPFIND',
                    url    : ENV.katana.base_url + 'system',
                    headers: {
                        'Authorization': 'Basic ' + basic,
                        'Content-Type' : 'application/xml; charset=utf-8'
                    },
                    processData: false
                }).then(
                    function(data, status, xhr) {
                        var multiStatus = KatanaWebDAVParser.multiStatus(xhr.responseText);

                        if (0 !== multiStatus.length) {
                            Ember.run(function() {
                                resolve({token: basic});
                            });

                            return;
                        }

                        Ember.run(function() {
                            reject();
                        });
                    },
                    function(xhr, status, error) {
                        Ember.run(function() {
                            reject();
                        });
                    }
                );
            }
        );
    },

    /**
     * Invalidating the session is always a success.
     */
    invalidate: function(data)
    {
        return new Ember.RSVP.Promise(
            function(resolve, reject) {
                resolve();
            }
        );
    }

});

/**
 * The custom authorizer is based on the HTTP Basic Authorization.
 */
Katana.CustomAuthorizer = SimpleAuth.Authorizers.Base.extend({

    /**
     * Automatically inject the Basic token for each request.
     */
    authorize: function(xhr, requestOptions)
    {
        var session = this.get('session');

        if (session.content.token) {
            xhr.setRequestHeader(
                'Authorization', 'Basic ' + session.content.token
            );
        }
    }

});

/**
 * Set the root URL of the application.
 */
Katana.Router.reopen({
    rootURL: window.location.pathname
});

/**
 * Declare the router.
 */
Katana.Router.map(function() {
    this.route('users', {path: 'user'}, function() {
        this.route('user', {path: ':user_id'}, function() {
            this.route('profile', {path: 'profile'});
            this.route('calendars');
            this.route('addressBooks', {path: 'address-books'});
            this.route('tasks');
            this.route('files');
        });
    });
    this.route('settings');
    this.route('about');
});

/**
 * Application route.
 */
Katana.ApplicationRoute = Ember.Route.extend(SimpleAuth.ApplicationRouteMixin, {

    actions: {

        /**
         * Request modal for the whole application. No dialog, just focus on an
         * actual part of the application.
         */
        requestModal: function()
        {
            $('html').addClass('modal');
        },

        /**
         * Cancel modal.
         */
        cancelModal: function()
        {
            $('html').removeClass('modal');
        },

        /**
         * Invalidate the session.
         */
        invalidateSession: function()
        {
            this.get('session').invalidate();
        },

        /**
         * Show the alert modal window.
         */
        alert: function(title, content)
        {
            this.send('_alert', 'modalAlert', title, content);
        },

        /**
         * Show the positive alert modal window.
         */
        positiveAlert: function(title, content)
        {
            this.send('_alert', 'modalPositiveAlert', title, content);
        },

        /**
         * Show an alert modal window.
         */
        _alert: function(modalId, title, content)
        {
            var controller = this.controllerFor('application');
            var oldAlert   = controller.get('alert');

            controller.set('alert.title',   title);
            controller.set('alert.content', content);

            var clean = function() {
                controller.set('alert', oldAlert);

                return true;
            };

            $('#' + modalId)
                .modal(
                    'setting',
                    {
                        onDeny:    clean,
                        onApprove: clean
                    }
                )
                .modal('show');
        },

        /**
         * Show the confirm modal window.
         */
        confirm: function(type, title, content, onApprove, onDeny)
        {
            var controller = this.controllerFor('application');
            var oldConfirm = controller.get('confirm');

            controller.set('confirm.type',    type);
            controller.set('confirm.title',   title);
            controller.set('confirm.content', content);

            var cleanAfter = function(callback) {
                var out = callback();
                controller.set('confirm', oldConfirm);

                return true;
            };

            $('#modalConfirm')
                .modal(
                    'setting',
                    {
                        onApprove: cleanAfter.bind(this, onApprove),
                        onDeny   : cleanAfter.bind(this, onDeny)
                    }
                )
                .modal('show');
        }

    }

});

/**
 * Application controller.
 */
Katana.ApplicationController = Ember.Controller.extend(SimpleAuth.AuthenticationControllerMixin, {

    /**
     * Users are sorted by the display name.
     */
    sortProperties     : ['displayName'],

    /**
     * Whether the login form is valid or not.
     */
    valid              : true,

    /**
     * Whether the login form is submitting or not.
     */
    submitting         : false,

    /**
     * Whether the application can run or not (it runs if authorized).
     */
    authorized         : false,

    /**
     * Tick for the session activity. Does not contain any useful information.
     * Only allows to react to an event (tick update).
     */
    lastSessionTick    : null,

    /**
     * Number of seconds before the session expires.
     */
    sessionExpireIn    : 0,

    /**
     * Whether the session is about to expire or not.
     */
    sessionWillExpire  : false,

    /**
     * Whether a new version of sabre/katana is available.
     */
    newVersionAvailable: false,

    /**
     * Current alert title and message.
     */
    alert: {
        title  : 'Alert',
        content: '(unknown)'
    },

    confirm: {
        type   : '',
        title  : 'Confirm',
        content: '(unknown)'
    },

    /**
     * Run a session tick.
     * Either the session is not authenticated and it does not tick. Else it
     * ticks every second. We set the inactivity time to 10mn. 1mn before the
     * end, the session is considered as “about to expire”.
     */
    sessionTick: function()
    {
        var self            = this;
        var elapsedSeconds  = Math.round((new Date() - Katana.lastActivity) / 1000);
        var sessionExpireIn = (10 * 60) - elapsedSeconds;
        var session         = this.get('session');

        this.set('sessionExpireIn', sessionExpireIn);

        if (false === session.isAuthenticated) {
            return;
        }

        if (sessionExpireIn <= 60) {
            this.set('sessionWillExpire', true);
        } else {
            this.set('sessionWillExpire', false);
        }

        if (sessionExpireIn <= 0) {
            this.get('session').invalidate().then(
                null,
                function() {
                    // if invalidating the session failed, we refresh the
                    // application.
                    window.location.reload();
                }
            );
            return;
        }

        Ember.run.later(
            function() {
                self.set('lastSessionTick', new Date());
            },
            1000
        );
    }.observes('lastSessionTick').on('init'),

    /**
     * Check if a new version of sabre/katana is available or not.
     */
    checkVersion: function()
    {
        var self = this;

        $.getJSON(ENV.katana.base_url + 'system/versions').then(
            function(data) {
                self.set('newVersionAvailable', undefined !== data.next_versions);
            }
        );
    }.observes('session.isAuthenticated'),

    /**
     * Everything that must run after the applications really starts.
     */
    onAuthorized: function()
    {
        var self = this;

        // Change the UI.
        $('html').addClass('logged');

        // Start the session tick.
        Ember.run.later(
            function() {
                self.set('lastSessionTick', new Date());
            },
            1000
        );
    }.observes('authorized'),

    actions: {

        /**
         * Call our custom authenticator. If it succeeds, the application starts
         * to tick, else we ask the user to retry.
         */
        authenticate: function()
        {
            var self = this;
            this.set('submitting', true);

            var credentials = {
                username: this.get('username'),
                password: this.get('password')
            };

            this.get('session')
                .authenticate('authenticator:custom', credentials)
                .then(
                    function(message) {
                        self.set('valid',      true);
                        self.set('submitting', false);
                        self.set('authorized', true);
                    },
                    function(message) {
                        self.set('valid',      false);
                        self.set('submitting', false);
                        self.set('authorized', false);
                    }
                );
        }

    }

});

/**
 * Application view.
 */
Katana.ApplicationView = Ember.View.extend({

    didInsertElement: function()
    {
        this._super();

        Ember.run.scheduleOnce(
            'afterRender',
            this,
            function() {
                // Configure the modal behavior.
                $('.ui.modal').modal(
                    'setting',
                    {
                        closable  : false,
                        onDeny    : function() {
                            return false;
                        },
                        onApprove: function() {
                            return false;
                        }
                    }
                );

                // Dismiss message.
                $('body').on(
                    'click',
                    '.message .close',
                    function() {
                        $(this).closest('.message').remove();
                    }
                );
            }
        );

        // Check the inactivity of the user.
        var updateLastActivity = function() {
            Katana.lastActivity = new Date();
        };

        $(window).mousemove(updateLastActivity);
        $(window).click(updateLastActivity);
        $(window).keypress(updateLastActivity);
    }

});

/**
 * Users route.
 */
Katana.UsersRoute = Ember.Route.extend(SimpleAuth.AuthenticatedRouteMixin, {

    model: function(params)
    {
        return this.get('store').filter(
            'user',
            {},
            function(user) {
                return true;
            }
        );
    }

});

/**
 * Users controller.
 */
Katana.UsersController = Ember.Controller.extend({

    actions: {

        /**
         * Create a new user and start the editing mode.
         */
        requestCreating: function()
        {
            var record = this.get('store').createRecord(
                'user',
                {
                    username   : '',
                    displayName: 'Unnamed',
                    email      : '',
                    newPassword: null
                }
            );
            this.transitionToRoute(
                'users.user.profile',
                record.get('id'),
                {
                    queryParams: {
                        edit: 'true'
                    }
                }
            );
        }

    }

});

/**
 * User profile route.
 */
Katana.UsersUserProfileRoute = Ember.Route.extend(SimpleAuth.AuthenticatedRouteMixin, {

    model: function(params, transition)
    {
        return this.get('store').find('user', transition.params['users.user'].user_id);
    }

});

/**
 * User profile controller.
 */
Katana.UsersUserProfileController = Ember.Controller.extend({

    queryParams: ['edit'],

    /**
     * Whether the editing mode is asked or not.
     */
    edit: 'false',

    /**
     * If the editing mode is asked, this is an auto-editing.
     */
    autoEditing: function()
    {
        if ('true' === this.get('edit')) {
            this.send('requestEditing');
        }
    }.observes('edit'),

    /**
     * Whether the editing mode is active.
     */
    isEditing: false,

    /**
     * When we are editing, the application should be in the modal mode.
     */
    autoModal: function()
    {
        this.send(
            true === this.get('isEditing')
                ? 'requestModal'
                : 'cancelModal'
        );
    }.observes('isEditing'),

    /**
     * Username is editable only once: When creating the user.
     */
    isUsernameEditable: function()
    {
        return this.get('isEditing') && this.get('model').get('isNew');
    }.property('isEditing', 'model'),

    actions: {

        /**
         * Start the editing mode.
         */
        requestEditing: function()
        {
            this.set('isEditing', true);
        },

        /**
         * Cancel the editing mode. If the editing user is new (i.e. newly
         * created), then we remove it because it is equivalent to cancel the
         * creation of a user.
         */
        cancelEditing: function()
        {
            if (true !== this.get('isEditing')) {
                throw 'Cannot cancel a user editing that is not in editing mode.';
            }

            var model = this.get('model');

            // Newly created record.
            if (true === model.get('isNew')) {

                model.destroyRecord();
                this.set('isEditing', false);
                this.set('edit',      false);
                this.transitionToRoute('users');

                return;

            }

            model.rollback();
            this.set('isEditing', false);
            this.set('edit',      false);
        },

        /**
         * Save the modification of the user.
         */
        applyEditing: function()
        {
            var self = this;

            if (true !== this.get('isEditing')) {
                throw 'Cannot save the current user because it was not in the editing mode.';
            }

            this.get('model').validate().then(
                function() {
                    var model = self.get('model');

                    self.set('isEditing', false);
                    self.set('edit',      false);

                    model.save().then(
                        function() {
                            model.set('newPassword', null);
                            self.transitionToRoute(
                                'users.user.profile',
                                model.get('username')
                            );
                        }
                    );
                }
            );
        },

        /**
         * Ask to delete a user.
         */
        requestDeleting: function()
        {
            var self  = this;
            var model = this.get('model');

            this.send(
                'confirm',
                'remove user',
                'Delete the user',
                'Are you sure you want to delete ' +
                '<strong>' + model.get('displayName') + '</strong> ' +
                '(' + model.get('username') + ')?',
                function() {
                    self.send('applyDeleting');

                    return true;
                },
                function() {
                    return true;
                }
            );
        },

        /**
         * Really delete a user.
         */
        applyDeleting: function()
        {
            var self        = this;
            var model       = this.get('model');
            var username    = model.get('username');
            var displayName = model.get('displayName');

            model
                .destroyRecord()
                .then(
                    function() {
                        self.transitionToRoute('users');
                    },
                    function() {
                        self.send(
                            'alert',
                            'Cannot delete',
                            'An error occured while deleting ' +
                            '<strong>' + displayName + '</strong> ' +
                            '(' + username + '). ' +
                            'Probably because it is forbidden.'
                        );
                        self.get('model').rollback();
                    }
                );
        }

    }

});

/**
 * Abstract “DAV list” route. Parent of `UsersUserCalendarsRoute`,
 * `UsersUserAddressBooksRoute` and `UsersUserTasksRoute`.
 */
Katana._DavListRoute = Ember.Route.extend(SimpleAuth.AuthenticatedRouteMixin, {

    /**
     * Current user (from the dynamic fragment).
     */
    currentUser: null,

    model: function(params, transition)
    {
        this.set('currentUser', transition.params['users.user'].user_id);

        return this._model();
    },

    /**
     * The “real” `model` method that children must implement. It must return a
     * store.
     */
    _model: function() {
        throw 'Not implemented.';
    },

    /**
     * Reset the controller and set the current user.
     */
    setupController: function(controller, model)
    {
        this._super.apply(this, arguments);
        controller.set('currentUser', this.get('currentUser'));
    },

    actions: {

        /**
         * Force to refresh the model.
         */
        refreshModel: function()
        {
            this.refresh();
        }

    }

});

/**
 * Abstract “DAV list” controller. Parent of `UsersUserCalendarsController`,
 * `UsersUserAddressBooksController` and `UsersUserTasksController`.
 */
Katana._DavListController = Ember.Controller.extend({

    /**
     * Owner of the DAV list (aka. calendars, address books or task lists).
     */
    currentUser     : null,

    /**
     * Whether instructions should be shown or not.
     */
    showInstructions: false,

    actions: {

        /**
         * Request to show instructions.
         */
        requestInstructions: function()
        {
            this.set('showInstructions', true);
        },

        /**
         * Do not show instructions.
         */
        cancelInstructions: function()
        {
            this.set('showInstructions', false);
        }

    }

});

/**
 * Calendars route.
 */
Katana.UsersUserCalendarsRoute = Katana._DavListRoute.extend({

    _model: function() {
        return this.get('store').find(
            'calendar',
            {
                username: this.get('currentUser'),
                type    : 'vevent'
            }
        );
    },

});

/**
 * Calendars controller.
 */
Katana.UsersUserCalendarsController = Katana._DavListController;

/**
 * Address books route.
 */
Katana.UsersUserAddressBooksRoute = Katana._DavListRoute.extend({

    _model: function(params, transition)
    {
        return this.get('store').find(
            'addressBook',
            {
                username: this.get('currentUser')
            }
        );
    }

});

/**
 * Address books controller.
 */
Katana.UsersUserAddressBooksController = Katana._DavListController;

/**
 * Task lists route.
 */
Katana.UsersUserTasksRoute = Katana._DavListRoute.extend({

    _model: function()
    {
        return this.get('store').find(
            'calendar',
            {
                username: this.get('currentUser'),
                type    : 'vtodo'
            }
        );
    }

});

/**
 * Task lists controller.
 */
Katana.UsersUserTasksController = Katana._DavListController;

/**
 * Files route.
 */
Katana.UsersUserFilesRoute = Katana._DavListRoute.extend({

    _model: function()
    {
        return this.get('store').find(
            'file',
            {
                username: this.get('currentUser'),
            }
        );
    }

});

/**
 * Files controller.
 */
Katana.UsersUserFilesController = Katana._DavListController.extend({

    queryParams: ['directory'],

    /**
     * Current directory to list.
     */
    directory: '/',

    updateDirectory: function()
    {
        // protect directory format here

        this.set(
            'model',
            this.get('store').find(
                'file',
                {
                    username: this.get('currentUser'),
                    path    : this.get('directory')
                }
            )
        );
    }.observes('directory'),

    isRoot: function()
    {
        return '/' === this.get('directory');
    }.property('isRoot', 'directory'),

    parent: function()
    {
        var parts = this.get('directory').split('/');
        parts.pop();

        if (1 >= parts.length) {
            return '/';
        }

        return parts.join('/');
    }.property('parent', 'directory'),

    pathToBreadcrumb: function()
    {
        if (true === this.get('isRoot')) {
            return [];
        }

        var out = [];

        this.get('directory').split('/').reduce(
            function(previous, current) {
                var path = previous + '/' + current;

                out.push({
                    label: current,
                    path : path
                });

                return path;
            }
        );

        out[out.length - 1].path = null;

        return out;
    }.property('pathToBreadcrumb', 'directory')

});

/**
 * Settings route.
 */
Katana.SettingsRoute = Ember.Route.extend(SimpleAuth.AuthenticatedRouteMixin, {

    model: function()
    {
        return new Ember.RSVP.Promise(
            function(resolve, reject) {
                $.getJSON(
                    ENV.katana.base_url + 'system/configurations'
                ).done(function(data) {
                    resolve(
                        new (
                            Katana.Settings.extend({
                                'database_dsn'     : data.database.dsn,
                                'database_username': data.database.username,
                                'mail_address'     : data.mail.address,
                                'mail_port'        : data.mail.port,
                                'mail_username'    : data.mail.username,
                                'mail_password'    : data.mail.password
                            })
                        )
                    );
                });
            }
        );
    }

});

/**
 * Settings controller.
 */
Katana.SettingsController = Ember.Controller.extend({

    /**
     * Whether a request is loading.
     */
    loading: false,

    actions: {

        /**
         * Try to send a test mail.
         */
        requestTestMail: function()
        {
            var model = this.get('model');
            var self  = this;

            model.validate().then(
                function() {
                    self.set('loading', true);
                    $.getJSON(
                        ENV.katana.base_url + 'system/configurations' +
                        '?test=mail' +
                        '&payload=' + encodeURIComponent(JSON.stringify({
                            'transport': model.mail_address + ':' + model.mail_port,
                            'username' : model.mail_username,
                            'password' : model.mail_password
                        }))
                    ).then(
                        function() {
                            self.send(
                                'positiveAlert',
                                'Mail sent!',
                                'Now go check the mail inbox of the ' +
                                '<strong>' + model.mail_username + '</strong> ' +
                                'user.<br />' +
                                'Do not forget to save the configurations ' +
                                'if needed!'
                            );
                            self.set('loading', false);
                        },
                        function() {
                            self.send(
                                'alert',
                                'Mail not sent!',
                                'An error occured. ' +
                                'Maybe the configurations are not correct.'
                            );
                            self.set('loading', false);
                        }
                    );
                }
            );
        },

        /**
         * Save current mail configurations.
         */
        applyMail: function()
        {
            var model = this.get('model');
            var self  = this;

            model.validate().then(
                function() {
                    self.set('loading', true);
                    $.postJSON(
                        ENV.katana.base_url + 'system/configurations',
                        JSON.stringify({
                            'transport': model.mail_address + ':' + model.mail_port,
                            'username' : model.mail_username,
                            'password' : model.mail_password
                        })
                    ).done(
                        function() {
                            self.set('loading', false);
                        }
                    );
                }
            );
        }

    }

});

/**
 * About route.
 */
Katana.AboutRoute = Ember.Route.extend(SimpleAuth.AuthenticatedRouteMixin);

/**
 * User model.
 */
Katana.User = DS.Model.extend(KatanaValidatorMixin, {

    username   : DS.attr('string'),
    displayName: DS.attr('string'),
    email      : DS.attr('string'),
    newPassword: DS.attr('string'),

    calendars   : DS.hasMany('calendar'),
    addressBooks: DS.hasMany('addressBook'),
    files       : DS.hasMany('file'),

    validators: {

        username: function()
        {
            var defer    = Ember.RSVP.defer();
            var username = this.get('username');
            var id       = this.get('id');

            if (!username) {
                defer.reject({
                    id     : 'username_empty',
                    message: 'Username cannot be empty.'
                });
            } else {
                this.get('store').filter(
                    'user',
                    function(user) {
                        return user.get('id')       !== id &&
                               user.get('username') === username;
                    }
                ).then(function(sameUsers) {
                    if (0 === sameUsers.get('length')) {
                        defer.resolve(username);
                    } else {
                        defer.reject({
                            id     : 'username_unique',
                            message: 'Username must be unique.'
                        });
                    }
                });
            }

            return defer.promise;
        },

        displayName: function()
        {
            var defer       = Ember.RSVP.defer();
            var displayName = this.get('displayName');

            if (!displayName) {
                defer.reject({
                    id     : 'displayName_empty',
                    message: 'Display name cannot be empty.'
                });
            } else {
                defer.resolve(displayName);
            }

            return defer.promise;
        },

        email: function()
        {
            var defer = Ember.RSVP.defer();
            var email = this.get('email');

            if (!/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email)) {
                defer.reject({
                    id     : 'email_invalid',
                    message: 'Email is not syntactically valid.'
                });
            } else {
                defer.resolve(email);
            }

            return defer.promise;
        },

        newPassword: function()
        {
            var defer       = Ember.RSVP.defer();
            var newPassword = this.get('newPassword');

            if (true === this.get('isNew')) {
                if (!newPassword) {
                    defer.reject({
                        id     : 'newPassword_empty',
                        message: 'New password cannot be empty.'
                    });
                } else {
                    defer.resolve(newPassword);
                }
            } else {
                if (!newPassword) {
                    defer.resolve(null);
                } else {
                    defer.resolve(newPassword);
                }
            }

            return defer.promise;
        }

    }

});

/**
 * User adapter.
 */
Katana.UserAdapter = KatanaWebDAVPrincipalsAdapter;

/**
 * Calendar model.
 */
Katana.Calendar = DS.Model.extend(KatanaValidatorMixin, {

    calendarName: DS.attr('string'),
    type        : DS.attr('string'),
    displayName : DS.attr('string'),
    color       : DS.attr('string'),

    user        : DS.belongsTo('user'),

    cssColor: function()
    {
        return this.get('color').substring(0, 7);
    }.property('cssColor'),

    icsURL: function()
    {
        return KatanaWebDAV.getCalendarsURL() +
               this.get('user').get('username') + '/' +
               this.get('calendarName') + '/?export';
    }.property('icsURL'),

    calendarFilename: function()
    {
        return this.get('user').get('username') + '_' +
               this.get('calendarName') + '.ics';
    }.property('calendarFilename'),

    validators: {

        displayName: function()
        {
            var defer       = Ember.RSVP.defer();
            var displayName = this.get('displayName');

            if (!displayName) {
                defer.reject({
                    id     : 'displayName_empty',
                    message: 'Calendar name cannot be empty.'
                });
            } else {
                defer.resolve(displayName);
            }

            return defer.promise;
        }

    }

});

/**
 * Calendar adapter.
 */
Katana.CalendarAdapter = KatanaCalDAVAdapter;

/**
 * Address book model.
 */
Katana.AddressBook = DS.Model.extend(KatanaValidatorMixin, {

    addressBookName: DS.attr('string'),
    displayName    : DS.attr('string'),

    user           : DS.belongsTo('user'),

    vcfURL: function()
    {
        return KatanaWebDAV.getAddressBooksURL() +
               this.get('user').get('username') + '/' +
               this.get('addressBookName') + '/?export';
    }.property('vcfURL'),

    addressBookFilename: function()
    {
        return this.get('user').get('username') + '_' +
               this.get('addressBookName') + '.vcf';
    }.property('addressBookFilename'),

    validators: {

        displayName: function()
        {
            var defer       = Ember.RSVP.defer();
            var displayName = this.get('displayName');

            if (!displayName) {
                defer.reject({
                    id     : 'displayName_empty',
                    message: 'Address book name cannot be empty.'
                });
            } else {
                defer.resolve(displayName);
            }

            return defer.promise;
        }

    }

});

/**
 * Address book adapter.
 */
Katana.AddressBookAdapter = KatanaCardDAVAdapter;

/**
 * File model.
 */
Katana.File = DS.Model.extend(KatanaValidatorMixin, {

    filename    : DS.attr('string'),
    directory   : DS.attr('boolean'),
    pathname    : DS.attr('string'),
    size        : DS.attr('number'),
    lastModified: DS.attr('date'),

    user        : DS.belongsTo('user'),

    lastModifiedForHuman: function()
    {
        return moment(this.get('lastModified')).calendar();
    }.property('lastModifiedForHuman'),

    fileURL: function()
    {
        return KatanaWebDAV.getFilesURL() +
               this.get('user').get('username') +
               this.get('pathname');
    }.property('fileURL')

});

/**
 * File adapter.
 */
Katana.FileAdapter = KatanaWebDAVAdapter;

/**
 * Settings model.
 */
Katana.Settings = Ember.Object.extend(KatanaValidatorMixin, {

    validators: {

        mail_address: function()
        {
            var defer       = Ember.RSVP.defer();
            var mailAddress = this.get('mail_address');

            if (!mailAddress) {
                defer.reject({
                    id     : 'mailAddress_empty',
                    message: 'Mail address cannot be empty.'
                });
            } else {
                defer.resolve(mailAddress);
            }

            return defer.promise;
        },

        mail_port: function()
        {
            var defer    = Ember.RSVP.defer();
            var mailPort = this.get('mail_port');

            if (!mailPort) {
                defer.reject({
                    id     : 'mailPort_empty',
                    message: 'Mail port cannot be empty.'
                });
            } else if (parseInt(mailPort) < 0) {
                defer.reject({
                    id     : 'mailPort_negative',
                    message: 'Mail port cannot be negative.'
                });
            } else {
                defer.resolve(mailPort);
            }

            return defer.promise;
        },

        mail_username: function()
        {
            var defer        = Ember.RSVP.defer();
            var mailUsername = this.get('mail_username');

            if (!mailUsername) {
                defer.reject({
                    id     : 'mailUsername_empty',
                    message: 'Mail username cannot be empty.'
                });
            } else {
                defer.resolve(mailUsername);
            }

            return defer.promise;
        },

        mail_password: function()
        {
            var defer        = Ember.RSVP.defer();
            var mailPassword = this.get('mail_password');

            if (!mailPassword) {
                defer.reject({
                    id     : 'mailPassword_empty',
                    message: 'Mail password cannot be empty.'
                });
            } else {
                defer.resolve(mailPassword);
            }

            return defer.promise;
        },

    }

});

/**
 * The abstract <_dav-list /> component. Parent of <calendar-list /> and
 * <address-book-list />.
 */
Katana._DavListComponent = Ember.Component.extend(KatanaValidatorMixin, {

    /**
     */
    layoutName: 'components/_dav-list',

    /**
     * Basically `kind` as a literal string (for messages or the view).
     */
    subject   : null,

    /**
     * Whether the creating mode is active.
     */
    isCreating: false,

    /**
     * When we are creating, the application should be in the modal mode.
     */
    autoModal : function()
    {
        this.sendAction(
            true === this.get('isCreating')
                ? 'request-modal'
                : 'cancel-modal'
        );
    }.observes('isCreating'),

    /**
     * The new item name.
     */
    newItemName: null,

    /**
     * Auto-reset the data.
     */
    autoReset: function()
    {
        if (false === this.get('isCreating')) {
            this.set('newItemName', null);
            this.clearAllErrors();
            this.set('valid', true);
        }
    }.observes('isCreating'),

    /**
     * Compute a new random color for the new calendar each time the model
     * changes.
     */
    randomColor: function()
    {
        return '#' +
               Math.floor(Math.random() * 255).toString(16) +
               Math.floor(Math.random() * 255).toString(16) +
               Math.floor(Math.random() * 255).toString(16);
    }.property('model'),

    /**
     * Create a new record. Must be implemented by the children.
     */
    newRecord: function()
    {
        throw 'Not implemented.';
    },

    actions: {

        /**
         * Create a new item and start the editing mode.
         */
        requestCreating: function()
        {
            this.set('isCreating', true);
        },

        /**
         * Cancel the creating mode.
         */
        cancelCreating: function()
        {
            if (true !== this.get('isCreating')) {
                throw 'Cannot cancel an item creation (' + this.get('subject') + ') that is not in creating mode.';
            }

            this.set('isCreating', false);
        },

        /**
         * Save the new item.
         */
        applyCreating: function()
        {
            var self = this;

            this.validate().then(
                function() {
                    self.newRecord().save().then(
                        function() {
                            self.set('isCreating', false);
                            self.sendAction('refresh-model');
                        }
                    );
                }
            );
        }

    },

    validators: {

        newItemName: function()
        {
            var defer       = Ember.RSVP.defer();
            var newItemName = this.get('newItemName');

            if (true === this.get('isCreating') && !newItemName) {
                defer.reject({
                    id     : 'newItemName_empty',
                    message: 'New item name cannot be empty.'
                });
            } else {
                defer.resolve(newItemName);
            }

            return defer.promise;
        }

    }

});

/**
 * The <calendar-list /> component.
 */
Katana.CalendarListComponent = Katana._DavListComponent.extend({

    subject        : 'calendar',
    'current-user' : null,
    'calendar-type': null,

    newRecord: function()
    {
        return this.get('store').createRecord(
            'calendar',
            {
                calendarName: uuid.v4(),
                type        : this.get('calendar-type'),
                displayName : this.get('newItemName'),
                color       : this.get('randomColor').toUpperCase() + 'FF',
                // `user`, simplified
                username    : this.get('current-user')
            }
        );
    }

});

/**
 * The <calendar-item /> component.
 */
Katana.CalendarItemComponent = Ember.Component.extend({

    /**
     * Component root tag name.
     */
    tagName   : 'div',

    /**
     * Component root tag name classes.
     */
    classNames: ['item'],

    /**
     * Whether the editing mode is active.
     */
    isEditing : false,

    actions: {

        /**
         * Start the editing mode.
         */
        requestEditing: function()
        {
            this.set('isEditing', true);
        },

        /**
         * Cancel the editing mode and rollback the calendar.
         */
        cancelEditing: function()
        {
            if (true !== this.get('isEditing')) {
                throw 'Cannot cancel a calendar editing that is not in editing mode.';
            }

            this.get('model').rollback();
            this.set('isEditing', false);
        },

        /**
         * Save the modification of the calendar.
         */
        applyEditing: function()
        {
            var self = this;

            if (true !== this.get('isEditing')) {
                throw 'Cannot save the current calendar because it was not in the editing mode.';
            }

            this.get('model').validate().then(
                function() {
                    var model = self.get('model');

                    self.set('isEditing', false);
                    model.save();
                }
            );
        },

        /**
         * Ask to delete a calendar.
         */
        requestDeleting: function()
        {
            var self   = this;
            var model  = this.get('model');
            var object = 'vevent' === model.get('type') ? 'calendar' : 'task list';

            this.sendAction(
                'confirm',
                'trash outline',
                'Delete the ' + object,
                '<p>Are you sure you want to delete the ' +
                '<strong>' + model.get('displayName') + '</strong> ' + object + ' ' +
                '(owned by ' + model.get('user').get('username') + ')?</p>',
                function() {
                    self.send('applyDeleting');

                    return true;
                },
                function() {
                    return true;
                }
            );
        },

        /**
         * Really delelete a calendar.
         */
        applyDeleting: function()
        {
            this.model.destroyRecord();
        }

    }

});

/**
 * The <address-book-list /> component.
 */
Katana.AddressBookListComponent = Katana._DavListComponent.extend({

    subject        : 'address book',
    'current-user' : null,

    newRecord: function()
    {
        return this.get('store').createRecord(
            'addressBook',
            {
                addressBookName: uuid.v4(),
                displayName    : this.get('newItemName'),
                // `user`, simplified
                username       : this.get('current-user')
            }
        );
    }

});

/**
 * The <address-book-item /> component.
 */
Katana.AddressBookItemComponent = Ember.Component.extend({

    /**
     * Component root tag name.
     */
    tagName   : 'div',

    /**
     * Component root tag name classes.
     */
    classNames: ['item'],

    /**
     * Whether the editing mode is active.
     */
    isEditing : false,

    actions: {

        /**
         * Start the editing mode.
         */
        requestEditing: function()
        {
            this.set('isEditing', true);
        },

        /**
         * Cancel the editing mode and rollback the address book.
         */
        cancelEditing: function()
        {
            if (true !== this.get('isEditing')) {
                throw 'Cannot cancel an address book editing that is not in editing mode.';
            }

            this.get('model').rollback();
            this.set('isEditing', false);
        },

        /**
         * Save the modification of the calendar.
         */
        applyEditing: function()
        {
            var self = this;

            if (true !== this.get('isEditing')) {
                throw 'Cannot save the current address book because it was not in the editing mode.';
            }

            this.get('model').validate().then(
                function() {
                    var model = self.get('model');

                    self.set('isEditing', false);
                    model.save();
                }
            );
        },

        /**
         * Ask to delete an address book.
         */
        requestDeleting: function()
        {
            var self   = this;
            var model  = this.get('model');

            this.sendAction(
                'confirm',
                'trash outline',
                'Delete the address book',
                '<p>Are you sure you want to delete the ' +
                '<strong>' + model.get('displayName') + '</strong> address book ' +
                '(owned by ' + model.get('user').get('username') + ')?</p>',
                function() {
                    self.send('applyDeleting');

                    return true;
                },
                function() {
                    return true;
                }
            );
        },

        /**
         * Really delelete an address book.
         */
        applyDeleting: function()
        {
            this.model.destroyRecord();
        }

    }

});

jQuery.extend({

    postJSON: function(url, data, callback)
    {
        return jQuery.ajax({
            contentType: 'application/json; charset=utf-8',
            data       : data,
            dataType   : 'json',
            success    : callback,
            type       : 'POST',
            url        : url
        });
    }

});
