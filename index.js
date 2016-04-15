/*jshint esversion: 6,  node: true */
'use strict';

/*
 * To be used in AWS Lambda
 */

exports.handler = (event, context, callback) => {
    require('./bin/worker').work().catch(err => callback(err, null)).done(() => callback(null, true));
};
