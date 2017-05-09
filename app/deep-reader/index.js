'use strict';

const Promise = require('bluebird');
const openFile = Promise.promisify(require('fs').open);
const readFile = Promise.promisify(require('fs').read);
const closeFile = Promise.promisify(require('fs').close);
const fileStat = Promise.promisify(require('fs').stat);

const kue = require('kue');
const queue = kue.createQueue();

const reader = require('shallow-reader').reader;

let variables;
const setVariables = (data) => {
    variables = data;
}

const readSections = (start, end) => {
    let file = {};
    let headSectionsSize = 0;
    const startDate = new Date();
    return Promise.join(openFile(reader.path, 'r'), fileStat(reader.path), (fd, stat) => {
            file.desc = fd;
            file.size = stat.size;
            return fd;
        }).then((fd) => findAppropriateSection(fd, start, end))
        .then(sections => {
            return Promise.all(sections);
        })
        .then(() => closeFile(file.desc))
        .then(() => console.log('The time was spent for get:', new Date() - startDate))
        .catch(err => console.log(err));
}

const findAppropriateSection = (fd, start, end) => {
    let neededSections = [];
    for (const startTime in reader.data) {
        const endTime = reader.data[startTime].end;
        if ((start >= startTime && start < endTime) || (end >= startTime && end < endTime) ||
            (startTime < end && endTime > start)) {
            // console.log(startTime, endTime)
            neededSections.push(getSectionData(fd, reader.data[startTime].position,
                reader.data[startTime].sectionSize, reader.data[startTime].startValues, start, end))
            if (endTime >= end) {
                break;
            }
        }
    }
    // console.log('neededSections size ' + neededSections.length)
    return neededSections;
}

const getSectionData = (fd, position, sectionSize, values, start, end) => {
    let readedData = new Buffer(sectionSize);
    const read = readFile(fd, readedData, 0, sectionSize, position);
    return read.then(readedDataSize => readDeepValueSection(readedData, values, start, end))
        .catch(err => console.log(err));
}

const readDeepValueSection = (readedData, values, startPoint, endPoint) => {
    let valuesSection = readedData.toString().split('\r\n');
    valuesSection.push('');
    let start = -1;
    let end = -1;
    let prev = Object.assign({}, values);
    let curr = Object.assign({}, values);


    for (let str of valuesSection) {
        if (start != -1 && end != -1) {
            // console.log(start, end);
            // console.log(prev, curr)
            if (start >= endPoint) {
                break;
            }

            let prevData = Object.assign({}, prev);
            let currData = Object.assign({}, curr);

            if (start >= startPoint) {
                let job = queue.create('valuesQueue', {
                    from: 'readedSection',
                    time: { start, end },
                    prev: prevData,
                    curr: currData,
                    singleVars: variables.singleVars,
                    multiVars: variables.multiVars
                }).attempts().removeOnComplete(true).save(err => {
                    if (err) throw err;
                    // console.log(`Job ${job.id} saved to the queue.`);
                });
            }

            for (let key in curr) {
                prev[key] = curr[key];
            }
            start = end;
            end = -1;
        }

        const timeVal = /#(\d+)/;
        if (timeVal.test(str)) {
            const val = str.match(timeVal);
            if (start == -1) {
                start = val[1];
            } else {
                end = val[1];
            }
            continue;
        }

        const binValues = /b([x\d]+) (.)/;
        const simValues = /([01])(.)/;
        if (binValues.test(str)) {
            const varWithValue = str.match(binValues);
            curr[varWithValue[2]] = varWithValue[1];
        } else if (simValues.test(str)) {
            const varWithValue = str.match(simValues);
            curr[varWithValue[2]] = varWithValue[1];
        }
    }

    return readedData.length;
}


exports.readSections = readSections;
exports.setVariables = setVariables;