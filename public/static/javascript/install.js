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

(function(scope) {
    var Katana = scope.Katana = Ember.Application.create();

    Katana.ApplicationController = Ember.Controller.extend({

        valid          : false,
        invalidBaseUrl : false,
        invalidPassword: null,
        invalidEmail   : null,
        origin         : window.location.origin,
        baseUrl        : function()
        {
            return window.location.pathname.replace(/\/+[^\/]*$/, '/') + 'server.php/';
        }.property(),
        password        : '',
        passwordBis     : null,
        email           : '',
        emailBis        : null,
        databaseDriver  : 'sqlite',
        databaseHost    : '',
        databasePort    : 3306,
        databaseName    : '',
        databaseUsername: '',
        databasePassword: '',
        databaseError   : null,
        submitting      : false,

        showMySQLPanel  : false,

        onDatabaseDriver: function()
        {
            this.set('showMySQLPanel', 'mysql' === this.get('databaseDriver'));
            this.validate();

            return;
        }.observes('databaseDriver'),

        validate: function()
        {
            var verdict = true;

            verdict = verdict && (false === this.get('invalidBaseUrl'));
            verdict = verdict && (false === this.get('invalidPassword'));
            verdict = verdict && (false === this.get('invalidEmail'));

            if ('mysql' === this.get('databaseDriver')) {
                verdict = verdict && (false === this.get('invalidDatabase'));
                verdict = verdict && (this.get('databaseHost'));
                verdict = verdict && (this.get('databasePort'));
                verdict = verdict && (this.get('databaseName'));
                verdict = verdict && (this.get('databaseUsername'));
            }

            this.set('valid', verdict);

            return;
        },

        validateBaseUrl: function()
        {
            var self = this;
            $
                .postJSON('?/baseurl', this.get('baseUrl'))
                .done(function(verdict) {

                    self.set('invalidBaseUrl', true !== verdict);
                    self.validate();

                    return;

                });

            return;
        }.observes('baseUrl'),

        validatePassword: function()
        {
            var self = this;

            if (null === this.get('passwordBis')) {
                return;
            }

            var password    = encodeURIComponent(this.get('password'));
            var passwordBis = encodeURIComponent(this.get('passwordBis'));
            $
                .postJSON('?/password', password + passwordBis)
                .done(function(verdict) {

                    self.set('invalidPassword', true !== verdict);
                    self.validate();

                    return;

                });

            return;
        }.observes('password', 'passwordBis'),

        validateEmail: function()
        {
            var self = this;

            if (null === this.get('emailBis')) {
                return;
            }

            var email    = this.get('email');
            var emailBis = this.get('emailBis');
            $
                .postJSON('?/email', email + emailBis)
                .done(function(verdict) {

                    self.set('invalidEmail', true !== verdict);
                    self.validate();

                    return;

                });

            return;
        }.observes('email', 'emailBis'),

        validateDatabase: function()
        {
            var self = this;
            $
                .postJSON(
                    '?/database',
                    JSON.stringify({
                        driver  : this.get('databaseDriver'),
                        host    : this.get('databaseHost'),
                        port    : this.get('databasePort'),
                        name    : this.get('databaseName'),
                        username: this.get('databaseUsername'),
                        password: this.get('databasePassword')
                    })
                )
                .done(function(verdict) {

                    self.set('invalidDatabase', true !== verdict);
                    self.set('databaseError',   null);

                    if (true !== verdict && verdict.error) {
                        self.set('databaseError', verdict.error);
                    }

                    self.validate();

                });
        }.observes(
            'databaseHost',
            'databasePort',
            'databaseName',
            'databaseUsername',
            'databasePassword'
        ),

        actions: {
            submit: function()
            {
                this.set('submitting', true);

                var baseUrl        = this.get('baseUrl');
                var databaseDriver = this.get('databaseDriver');
                var isMySQL        = 'mysql' === databaseDriver;

                var source = new EventSource(
                    '?/install/' +
                    encodeURIComponent(
                        JSON.stringify({
                            baseurl : baseUrl,
                            email   : this.get('email'),
                            password: this.get('password'),
                            database: {
                                driver  : databaseDriver,
                                host    : isMySQL ? this.get('databaseHost')     : '',
                                port    : isMySQL ? this.get('databasePort')     : '',
                                name    : isMySQL ? this.get('databaseName')     : '',
                                username: isMySQL ? this.get('databaseUsername') : '',
                                password: isMySQL ? this.get('databasePassword') : ''
                            }
                        })
                    )
                );
                source.addEventListener(
                    'step',
                    function(evt) {
                        var data = JSON.parse(evt.data);

                        if (-1 === data.percent || 100 === data.percent) {
                            source.close();
                        }

                        if (-1 === data.percent) {
                            $('#progress').addClass('error');
                        } else {
                            $('#progress').progress({
                                percent: data.percent
                            });
                        }

                        $('#progress .label').text(data.message);

                        if (100 === data.percent) {
                            setTimeout(
                                function() {
                                    window.location = window.location.pathname.replace(/\/+[^\/]*$/, '/') + 'admin.php';
                                },
                                3000
                            );
                        }
                    }
                );
            }
        }
    });

    Katana.ApplicationView = Ember.View.extend({

        didInsertElement: function()
        {
            this._super();

            var controller = this.get('controller');

            Ember.run.scheduleOnce('afterRender', this, function() {
                $('.ui.radio.checkbox').checkbox();
                $('#progress').progress();
            });

            $('[name="database_driver"]').on(
                'change',
                function(evt) {
                    controller.set('databaseDriver', evt.target.value);
                }
            );

            return;
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
})(window);
