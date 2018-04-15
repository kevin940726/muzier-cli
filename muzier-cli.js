#!/usr/bin/env node

'use strict';

require('dotenv').config();

require = require('esm')(module);

module.exports = require('./src');
