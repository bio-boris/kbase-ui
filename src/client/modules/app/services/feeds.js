define([
    'lib/feeds',
    'kb_lib/lang'
], (
    feeds,
    lang
) => {
    'use strict';

    class FeedsService {
        constructor({ params }) {
            this.runtime = params.runtime;

            // TODO: move to service config.
            this.monitoringInterval = 10000;

            this.monitorRunning = false;
            this.monitoringRunCount = 0;
            this.monitoringErrorCount = 0;
        }

        start() {
            // if logged in, populate and start monitoring for feeds notifications
            if (this.runtime.service('session').getAuthToken()) {
                return this.startupFeedsMonitoring();
            } else {
                console.warn('session not authorized, not ');
            }

            // listen for login and out events...
            this.runtime.receive('session', 'loggedin', () => {
                this.startFeedsMonitoring();
            });

            this.runtime.receive('session', 'loggedout', () => {
                this.stopFeedsMonitoring();
            });

            this.runtime.db().set('feeds', {
                notifications: null,
                error: null
            });
        }

        stop() {
            return;
        }

        startFeedsMonitoring() {
            this.monitorRunning = true;
            this.monitoringLoop();
        }

        monitoringLoop() {
            if (this.monitoringTimer) {
                return;
            }

            const monitoringJob = () => {
                const feedsClient = new feeds.FeedsClient({
                    url: this.runtime.config('services.Feeds.url'),
                    token: this.runtime.service('session').getAuthToken()
                });
                return feedsClient.getNotifications()
                    .then((notifications) => {
                        // are notifications different than the last time?
                        const currentNotifications = this.runtime.db().get('feeds.notifications');
                        // only way is a deep equality comparison

                        if (lang.isEqual(currentNotifications, notifications)) {
                            return;
                        }

                        this.runtime.db().set('feeds', {
                            notifications: notifications,
                            error: null
                        });

                        return notifications;
                    })
                    .catch((err) => {
                        console.error('ERROR', err.message);
                        this.runtime.db().set('feeds', {
                            error: err.message
                        });
                    });
            };

            const loop = () => {
                this.monitoringTimer = window.setTimeout(() => {
                    monitoringJob()
                        .then(() => {
                            this.monitoringRunCount += 1;
                            if (this.monitorRunning) {
                                loop();
                            }
                        })
                        .catch((err) => {
                            this.monitoringErrorCount += 1;
                            console.error('ERROR', err);
                        });
                }, this.monitoringInterval);
            };

            monitoringJob()
                .then(() => {
                    loop();
                })
                .catch((err) => {
                    console.error('Error', err);
                });
        }

        stopFeedsMonitoring() {
            this.monitorRunning = true;
            window.clearTimeout(this.monitoringTimer);
            this.monitoringTimer = null;
        }

        pluginHandler() {

        }
    }

    return { ServiceClass: FeedsService };
});