var sio = require('socket.io');
var redis = require('socket.io-redis');
const conf = require('config');

var io = null;

exports.io = function() {
    return io;
};

exports.initialize = function(server) {
    io = sio(server);

    io.adapter(redis({
        host: '127.0.0.1',
        port: 6379
    }));


    io.on('connection', function(socket) {
        socket.on('projects.load', function() {
            const Promise = require('bluebird');
            const readdir = Promise.promisify(require('fs').readdir);
            const path = require('path');
            return readdir(conf.dir.verilog).then(files => {
                const vcdFiles = files.filter(file => path.extname(file) === '.vcd');
                socket.emit('projects.list', {files: vcdFiles});
            });
        });

        socket.on('init', function(data) {
            console.log('init was emited', data.name);
            const shallowRead = require('shallow-reader').read;
            return shallowRead(data.name);
        })

        socket.on('vars.set', function(data) {
            require('deep-reader').setVariables(data);
            socket.emit('vars.setted');
        });

        socket.on('plot.load', function(data) {
            console.log('load was emited ', data.from, data.to)
            const readSections = require('deep-reader').readSections;
            return readSections(data.from, data.to);
        });

        const svg = require('svgcreator')
        svg.initialize();
        socket.on('svg', function(data) {
            return svg.get(data.time, data.prevData, data.currData).then(svg => {
                io.emit('data', { time: data.time, svg });
                // console.log(`svg for ${time.end} created`)
            })
        });
    });
};