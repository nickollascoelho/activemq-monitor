/*jshint esversion: 6,  node: true */
'use strict';
const config = require('dotenv').config();
const mongoose = require('mongoose');

const dbUser = config.DB_USER;
const dbPassword = config.DB_PASSWORD;
const dbUrl = config.DB_URL;

const dbURI = 'mongodb://' + dbUser + ':' + dbPassword + '@' + dbUrl;

mongoose.connect(dbURI);

const conn = mongoose.connection;

module.exports = conn;
