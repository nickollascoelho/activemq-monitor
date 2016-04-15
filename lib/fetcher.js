/*jshint esversion: 6,  node: true */
'use strict';

const config = require('dotenv').config();
const fetch = require('node-fetch');
const parseString = require('xml2js').parseString;
const Q = require('q');
const Host = require('./model/host');

const username = config.AMQ_SERVER_USERNAME;
const password = config.AMQ_SERVER_PASSWORD;
const auth = 'Basic ' + new Buffer(username + ':' + password).toString('base64');
const options = {
    headers: {
        'Authorization': auth
    }
};

const fetchServersXML = serverList => {
    const urlList = serverList.map(server => {
        let url = config.AMQ_SERVER_PROTOCOL + '://';
        url += server + ':' + config.AMQ_SERVER_PORT;
        url += '/admin/xml/queues.jsp';

        return url;
    });

    return Q.all(urlList.map(fetchXML));
};

const fetchXML = url =>
    fetch(url, options)
    .then(res => res.text())
    .then(xml => Q.nfcall(parseString, xml))
    .then(parsedXML => {
        const fqdn = url.match(/((\w*\.){2}\w{3})/g)[0];
        const hostname = fqdn.match(/(\w*){1}\./g)[0].replace('.', '');
        return parsedXML.queues.queue.reduce((host, queue) => {
            let q = {
                name: queue.$.name,
                stats: queue.stats[0].$
            };

            for (let a in q.stats) {
                if (typeof q.stats[a] !== 'number' && !isNaN(q.stats[a])) {
                    q.stats[a] = parseInt(q.stats[a]);
                }
            }

            host.queues.push(q);

            return host;
        }, {
            fqdn,
            hostname,
            queues: []
        });
    });

module.exports = {
    fetchServersXML
};
