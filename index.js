/*jshint esversion: 6 */
(function() {
    'use strict';

    const fetch = require('node-fetch');
    const parseString = require('xml2js').parseString;
    const config = require('dotenv').config();
    const Q = require('q');
    const AWS = require('aws-sdk');

    AWS.config.update({
        region: config.AWS_REGION
    });

    AWS.config.apiVersions = {
        cloudwatchlogs: '2014-03-28'
    };

    const cloudwatchlogs = new AWS.CloudWatchLogs();

    const username = config.AMQ_SERVER_USERNAME;
    const password = config.AMQ_SERVER_PASSWORD;
    const AWS_LOG_GROUP_NAME = config.AWS_LOG_GROUP_NAME;
    let AWS_LOG_STREAM_NAME = '';

    const auth = 'Basic ' + new Buffer(username + ':' + password).toString('base64');

    const fetchOptions = {
        headers: {
            'Authorization': auth
        }
    };

    const getQueues = (servers) => Q.all(servers.map(mapServerQueues));

    const mapServerQueues = (url) =>
        fetch(url, fetchOptions)
        .then((response) => response.text())
        .then((xml) => Q.nfcall(parseString, xml))
        .then((parsedXML) => parsedXML.queues.queue)
        .then((queues) => {
            queues = queues.reduce((obj, queue) => {
                let q = {
                    name: queue.$.name,
                    stats: queue.stats[0].$
                };

                for (let a in q.stats) {
                    if (typeof q.stats[a] !== 'number' && !isNaN(q.stats[a])) {
                        q.stats[a] = parseInt(q.stats[a]);
                    }
                }

                obj.queues.push(q);

                return obj;
            }, {
                FQDN: url.match(/((\w*\.){2}\w{3})/g)[0],
                queues: []
            });

            return queues;
        });

    const createLogStream = () => {
        const logStreamNamePrefix = () => {
            let prefix = new Date().toISOString();
            return prefix.replace(/-/g, '/').replace(/[:\.]/g, '');
        };

        AWS_LOG_STREAM_NAME = logStreamNamePrefix() + config.AWS_LOG_STREAM_NAME;

        const params = {
            logGroupName: AWS_LOG_GROUP_NAME,
            logStreamName: AWS_LOG_STREAM_NAME
        };

        return Q.ninvoke(cloudwatchlogs, 'createLogStream', params);
    };

    const createLogEvents = (servers) => {
        return servers.reduce((previous, current) => {
            previous = previous.concat(current.queues.map((queue) => ({
                message: JSON.stringify({
                    queue: {
                        host: current.FQDN,
                        name: queue.name,
                        stats: queue.stats
                    }
                }),
                timestamp: Date.now()
            })));

            return previous;
        }, []);
    };

    exports.handler = (event, context, callback) => {
        const servers = config.AMQ_SERVER_FARM.split(',');

        Q
            .all([getQueues(servers), createLogStream()])
            .spread((queues, logStream) => {
                const logEvents = createLogEvents(queues);
                const params = {
                    logEvents,
                    logGroupName: AWS_LOG_GROUP_NAME,
                    logStreamName: AWS_LOG_STREAM_NAME
                };
                return Q.ninvoke(cloudwatchlogs, 'putLogEvents', params);
            })
            .catch(err => callback ? callback(err, null) : console.log(err, err.stack))
            .done(() => callback ? callback(null, 'done') : console.log('done'));
    };

})();
