/*jshint esversion: 6 */
(function() {
    'use strict';

    const fetch = require('node-fetch');
    const parseString = require('xml2js').parseString;
    const config = require('dotenv').config();
    const Q = require('Q');
    const AWS = require('aws-sdk');

    AWS.config.update({
        region: process.env.AWS_REGION
    });

    AWS.config.apiVersions = {
        cloudwatch: '2010-08-01'
    };

    const cloudwatch = new AWS.CloudWatch();

    const username = process.env.AMQ_SERVER_USERNAME;
    const password = process.env.AMQ_SERVER_PASSWORD;

    const auth = 'Basic ' + new Buffer(username + ':' + password).toString('base64');
    const fetchOptions = {
        headers: {
            'Authorization': auth
        }
    };



    exports.handler = (event, context, callback) => {
        const servers = process.env.AMQ_SERVER_FARM.split(',');

        getQueues(servers).then((serversQueues) => {
            console.log('result: ' + JSON.stringify(serversQueues, null, 2));
        });
    };

    const getQueues = (servers) => Q.all(servers.map(mapServerQueues));

    const mapServerQueues = (url) =>
        fetch(url, fetchOptions)
        .then((response) => response.text())
        .then((xml) => Q.nfcall(parseString, xml))
        .then((parsedXML) => parsedXML.queues.queue)
        .then((queues) => {
            queues = queues.reduce((obj, queue) => {
                obj.queues.push({
                    name: queue.$.name,
                    stats: queue.stats[0].$
                });
                return obj;
            }, {
                server: url.match(/((\w*\.){2}\w{3})/g)[0],
                url: url,
                queues: []
            });

            return queues;
        })
        .catch((err) => console.log(err, err.stack));

})();

exports.handler();
