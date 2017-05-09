'use strict';
var kue = require('kue'),
    queue = kue.createQueue();
var io = require('socket.io-emitter')({
    host: '127.0.0.1',
    port: 6379
});
const svg = require('svgcreator')
svg.initialize();

queue.process('valuesQueue', (job, done) => {
    const jobData = job.data;
    // console.log(jobData.time, jobData.prev['"'], jobData.curr['"'])
    handleSection(jobData.time, jobData.prev, jobData.curr,
        jobData.singleVars, jobData.multiVars, done);
});

const handleSection = (time, prevData, currData, singleVars, multiVars, done) => {
    console.log(time.start, time.end);
    // console.log(prevData['"'], currData['"']);
    // console.log(singleVars, multiVars)
    return svg.get(time, prevData, currData, singleVars, multiVars).then(svg => {
        io.emit('data', {time, svg});
        // console.log(`svg for ${time.end} created`)
        done();
    })
}
