'use strict';
const conf = require('config');
const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('io').initialize(server);


app.use(express.static(conf.dir.public));

app.get('/', function(req, res) {
    res.sendFile(join(conf.dir.public, 'index.html'));
});

server.listen(4000, function () {
  console.log('App listening on port 4000!');
});

