/*jshint esversion: 6,  node: true */
'use strict';
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const hostSchema = new Schema({
    fqdn: String,
    hostname: String,
    queues: [{
        name: String,
        stats: {
          size: Number,
          consumerCount: Number,
          enqueueCount: Number,
          dequeueCount: Number
        }
    }]
});

const Host = mongoose.model('Host', hostSchema);

module.exports = Host;
