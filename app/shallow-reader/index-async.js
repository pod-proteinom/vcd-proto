'use strict';

const conf = require('config');

const Promise = require('bluebird');
const openFile = Promise.promisify(require('fs').open);
const readFile = Promise.promisify(require('fs').read);
const closeFile = Promise.promisify(require('fs').close);
const fileStat = Promise.promisify(require('fs').stat);

const DEF_SECTION_SIZE = 500;
const DUMP_SECTION_SIZE = 500;
const VALUE_SECTION_SIZE = 1 * 224;

const readDefSection = fd => {
    let buf = new Buffer(DEF_SECTION_SIZE);
    const read = readFile(fd, buf, 0, DEF_SECTION_SIZE, 0);
    return Promise.join(read, () => buf).then(buf => {
        const readedBuf = buf.toString();
        const END_OF_DEF_SECTION = '$enddefinitions $end';
        const defSection = readedBuf.split(END_OF_DEF_SECTION)[0];
        const scopeStart = defSection.match(/\$scope/);
        const scopeStartIndex = scopeStart.index;
        // const scopes = getScopes(defSection, scopeStartIndex);
        // console.log(scopes)
        const defSectionSize = Buffer.byteLength(defSection + END_OF_DEF_SECTION, 'utf-8');
        // console.log(defSection);
        // console.log(defSectionSize);
        return defSectionSize;
    });
}

const getScopes = (defSection, indexToStart) => {
    const scopes = defSection.slice(indexToStart, defSection.length);
    const scopesByLine = scopes.split('\r\n');

    let modules = [];
    scopesByLine.forEach(line => {
        if (/\$scope module/.test(line)) {
            const moduleName = line.match(/\$scope module (\w+) \$end/)[1];
            modules.push({ name: moduleName, vars: {} });
            return;
        }

        if (/\$var/.test(line)) {
            const variable = line.match(/\$var (wire|reg) (\d+) (.) (\w+) .*\$end/)
            const type = variable[1];
            const size = variable[2];
            const sym = variable[3];
            const name = variable[4];
            // console.log(sym, name, type, size);
            modules[modules.length - 1].vars[sym] = {
                name,
                type,
                size
            };
            return;
        }
    });

    return modules;
}

const readDumpSection = (fd, size, defSectionSize) => {
    let buf = new Buffer(DUMP_SECTION_SIZE);
    const read = readFile(fd, buf, 0, DUMP_SECTION_SIZE, defSectionSize);
    return Promise.join(read, () => buf).then(buf => {
        const bufStr = buf.toString();
        const start = bufStr.match(/#(\d+)\r\n\$dumpvars/);
        const end = bufStr.match(/\$end\r\n#(\d+)/);

        const endOfDumpSection = '$end';
        const splittedReadedData = bufStr.split(endOfDumpSection)[0];
        const dumpSection = splittedReadedData + endOfDumpSection;
        let result = {};
        const values = dumpSection.match(/\$dumpvars([^]+)\$end/);
        if (values != null) {
            const splittedValues = values[1].split('\r\n');
            // console.log(splittedValues)
            for (let i = 0; i < splittedValues.length; i++) {
                const value = splittedValues[i];

                if (/b([x\d]+) (.)/.test(value)) {
                    const varWithValue = value.match(/b([x\d]+) (.)/);
                    result[varWithValue[2]] = varWithValue[1];
                } else if (/([01])(.)/.test(value)) {
                    const varWithValue = value.match(/([01])(.)/);
                    result[varWithValue[2]] = varWithValue[1];
                }
            }
            // console.log(result)
        }


        const dumpSectionSize = Buffer.byteLength(dumpSection, 'utf-8');
        // console.log(dumpSection);
        if (start != null) {
            // console.log(end)
            reader.data[start[1]] = {
                    end: end[1],
                    startValues: result,
                    position: defSectionSize,
                    sectionSize: Buffer.byteLength(splittedReadedData + end[0], 'utf-8')
                }
                // console.log(start[1])
                // console.log(end[1])
        }
        // console.log(dumpSectionSize);
        return { size: dumpSectionSize, values: result };
    });
}

const readValuesSection = (file, position, valuesSectionSize, values) => {
    return readValueSection(file.desc, position, VALUE_SECTION_SIZE, values)
        .then(res => {
            const startValues = Object.assign({}, res.startValues);
            // console.log(res
            reader.data[res.time.start] = {
                // console.log(startValues)
                end: res.time.end,
                startValues: startValues,
                position: position,
                sectionSize: res.sectionSize
            }

            position += res.size;
            valuesSectionSize -= res.size;

            values = Object.assign({}, res.endValues)

            if (VALUE_SECTION_SIZE > valuesSectionSize) {
                return readValueSection(file.desc, position, valuesSectionSize, values)
                    .then(lastSection => {
                        // console.log(lastSection.time.start, lastSection.time.end);
                        // console.log(lastSection.startValues['"']);
                        reader.data[lastSection.time.start] = {
                            end: lastSection.time.end,
                            startValues: lastSection.startValues,
                            position: position,
                            sectionSize: lastSection.sectionSize
                        }

                        return lastSection;
                    });
            } else if (valuesSectionSize > 0) {
                return readValuesSection(file, position, valuesSectionSize, values);
            }
        });
}

const readValueSection = (fd, position, sectionSize, values) => {
    let readedData = new Buffer(sectionSize);
    const read = readFile(fd, readedData, 0, sectionSize, position);
    return read.then(readedDataSize => readShallowValueSection(readedData, values))
        .catch(err => console.log(err));

}

const readShallowValueSection = (readedData, values) => {
    const assumedSection = readedData.toString();
    const isLastSection = VALUE_SECTION_SIZE > readedData.length;

    let startValues = Object.assign({}, values);
    let endValues = {};
    let signalToCheck = {};
    for (const signal in startValues) {
        const regexp = "\\d+\\" + signal;
        if ((new RegExp(regexp)).test(assumedSection)) {
            signalToCheck[signal] = '';
        } else {
            endValues[signal] = startValues[signal];
        }
    }

    let firstOccurenceIndex = -1;
    let timeEndOfSection = -1;
    let currentSignal;

    for (let i = assumedSection.length; i > 0; i--) {
        if (firstOccurenceIndex == -1 && assumedSection[i] == '#' && /\d/.test(assumedSection[i + 1])) {
            firstOccurenceIndex = i;
            continue;
        }

        if (assumedSection[i] == '#' && /\d/.test(assumedSection[i + 1]) && timeEndOfSection == -1) {
            timeEndOfSection = i;
            break;
        };
    }

    for (let i = timeEndOfSection - 1; i > 0; i--) {
        if (currentSignal) {
            if (assumedSection[i] != '\n') {
                endValues[currentSignal] = assumedSection[i] + endValues[currentSignal];
            } else {
                delete signalToCheck[currentSignal];
                currentSignal = null;
            }
            continue;
        }

        if (assumedSection[i] in signalToCheck && (assumedSection[i - 1] == ' ' || /\d/.test(assumedSection[i - 1]))) {
            currentSignal = assumedSection[i];
            endValues[currentSignal] = '';
            continue;
        }

        if (timeEndOfSection != -1 && Object.keys(signalToCheck).length === 0) {
            break;
        }
    }

    let sectionEndTime = '';
    if (isLastSection) {
        const sectionStartTime = assumedSection.match(/#(\d+)/)[1];
        for (let i = firstOccurenceIndex + 1; i < assumedSection.length; i++) {
            if (/\d/.test(assumedSection[i])) {
                sectionEndTime += assumedSection[i];
            } else {
                break;
            }
        }
        // console.log(sectionStartTime, sectionEndTime);
        // console.log('Time:', sectionStartTime, sectionEndTime)
        // console.log(startValues['"'], endValues['"']);
        return {
            sectionSize: assumedSection.length,
            time: { start: sectionStartTime, end: sectionEndTime },
            startValues,
            endValues
        };
    } else {
        // console.log(section)
        const sectionStartTime = assumedSection.match(/#(\d+)/)[1];
        for (let i = timeEndOfSection + 1; i < assumedSection.length; i++) {
            if (/\d/.test(assumedSection[i])) {
                sectionEndTime += assumedSection[i];
            } else {
                break;
            }
        }

        const ss = assumedSection.substr(0, timeEndOfSection - 1);
        const size = Buffer.byteLength(ss, 'utf-8');


        const section = assumedSection.substr(0, firstOccurenceIndex - 1);
        const sectionSize = Buffer.byteLength(section, 'utf-8');

        // console.log(sectionStartTime, sectionEndTime);
        // console.log(assumedSection[timeEndOfSection], assumedSection[timeEndOfSection + 1])
        // console.log(assumedSection[firstOccurenceIndex], assumedSection[firstOccurenceIndex + 1])
        // console.log('Time:', sectionStartTime, sectionEndTime)
        // console.log(startValues['"'], endValues['"']);

        return {
            sectionSize,
            time: { start: sectionStartTime, end: sectionEndTime },
            startValues,
            endValues,
            size
        };
    }
}

let reader = {};

const read = name => {
    const join = require('path').join;
    reader.path = join(conf.dir.verilog, name);
    reader.data = {};

    let file = {};
    let headSectionsSize = 0;
    const startDate = new Date();
    return Promise.join(openFile(reader.path, 'r'), fileStat(reader.path), (fd, stat) => {
            file.desc = fd;
            file.size = stat.size;
            return fd;
        }).then(readDefSection)
        .then(defSectionSize => {
            headSectionsSize += defSectionSize;
            return readDumpSection(file.desc, file.size, defSectionSize);
        })
        .then(dumpSection => {
            headSectionsSize += dumpSection.size;
            const valuesSectionSize = file.size - headSectionsSize;
            return readValuesSection(file, headSectionsSize, valuesSectionSize, dumpSection.values);
        })
        .then(data => {
            // console.log(data.time.start)
            // console.log(data.time.end)
            const io = require('io').io();
            io.emit('plot.length', { time: data.time.end });
            return data.time.end;
        })
        .then(() => closeFile(file.desc))
        .then(() => console.log('The time was spent:', new Date() - startDate))
        .catch(err => console.log(err));
}

exports.read = read;
exports.reader = reader;

// read('date.vcd')
