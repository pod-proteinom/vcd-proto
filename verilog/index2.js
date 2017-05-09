'use strict';

const Promise = require('bluebird');
const openFile = Promise.promisify(require('fs').open);
const readFile = Promise.promisify(require('fs').read);
const closeFile = Promise.promisify(require('fs').close);
const fileStat = Promise.promisify(require('fs').stat);

const DEF_SECTION_SIZE = 1000;
const DUMP_SECTION_SIZE = 500;

const readDefSection = fd => {
    let buf = new Buffer(DEF_SECTION_SIZE);
    const read = readFile(fd, buf, 0, DEF_SECTION_SIZE, 0);
    return Promise.join(read, () => buf).then(buf => {
        const bufStr = buf.toString();
        const endOfDefSection = '$enddefinitions $end';
        const defSection = bufStr.split(endOfDefSection)[0] + endOfDefSection;
        const defSectionSize = Buffer.byteLength(defSection, 'utf-8');
        // console.log(defSection);
        // console.log(defSectionSize);
        return defSectionSize;
    });
}

const readDumpSection = (fd, size, defSectionSize) => {
    let buf = new Buffer(DUMP_SECTION_SIZE);
    const read = readFile(fd, buf, 0, DUMP_SECTION_SIZE, defSectionSize);
    return Promise.join(read, () => buf).then(buf => {
        const bufStr = buf.toString();
        const start = bufStr.match(/(#\d+)\r\n\$dumpvars/);
        const end = bufStr.match(/\$end\r\n(#\d+)/);

        if (start != null) {
            console.log(start[1])
            console.log(end[1])
        }

        const endOfDumpSection = '$end';
        const dumpSection = bufStr.split(endOfDumpSection)[0] + endOfDumpSection;

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
        // console.log(dumpSectionSize);
        return { size: dumpSectionSize, values: result };
    });
}

// const readValueSection = (fd, position, sectionSize, values) => {
//     let buf = new Buffer(sectionSize);
//     const read = readFile(fd, buf, 0, sectionSize, position);
//     return Promise.join(read, () => buf).then(buf => {
//         const bufStr = buf.toString();
//         let firstOccurenceIndex = -1;
//         let timeEndOfSection;
//         for (let i = bufStr.length - 1; i > 0; i--) {
//             if (bufStr[i] == '#') {
//                 if (firstOccurenceIndex != -1) {
//                     timeEndOfSection = i;
//                     break;
//                 } else {
//                     firstOccurenceIndex = i;
//                 }
//             }
//         }
//         // console.log(bufStr[timeEndOfSection + 3])
//         // console.log(firstOccurenceIndex)
//         const valueSection = bufStr.substr(0, firstOccurenceIndex);
//         const valueSectionStartTime = bufStr.match(/#\d+/)[0];
//         let valueSectionEndTime = '#';
//         for (let i = timeEndOfSection + 1; i < valueSection.length; i++) {
//             if (/\d/.test(valueSection[i])) {
//                 valueSectionEndTime += valueSection[i];
//             } else {
//                 break;
//             }
//         }

//         const sectionSize = Buffer.byteLength(valueSection, 'utf-8');
//         // console.log(valueSection);
//         // console.log(valueSectionStartTime)
//         // console.log(valueSectionEndTime)

//         return sectionSize;
//     });

// }

const readValueSection = (fd, position, sectionSize, values) => {
    let buf = new Buffer(sectionSize);
    const read = readFile(fd, buf, 0, sectionSize, position);
    return Promise.join(read, () => buf).then(buf => {
        const bufStr = buf.toString();
        let firstOccurenceIndex = -1;
        let timeEndOfSection;
        for (let i = bufStr.length - 1; i > 0; i--) {
            if (bufStr[i] == '#') {
                if (firstOccurenceIndex != -1) {
                    timeEndOfSection = i;
                    break;
                } else {
                    firstOccurenceIndex = i;
                }
            }
        }
        // console.log(bufStr[timeEndOfSection + 3])
        // console.log(firstOccurenceIndex)
        const valueSection = bufStr.substr(0, firstOccurenceIndex);
        const valueSectionStartTime = bufStr.match(/#\d+/)[0];
        let valueSectionEndTime = '#';
        for (let i = timeEndOfSection + 1; i < valueSection.length; i++) {
            if (/\d/.test(valueSection[i])) {
                valueSectionEndTime += valueSection[i];
            } else {
                break;
            }
        }

        const sectionSize = Buffer.byteLength(valueSection, 'utf-8');
        // console.log(valueSection);
        // console.log(valueSectionStartTime)
        // console.log(valueSectionEndTime)

        return sectionSize;
    });

}

const readLastValueSection = (fd, position, sectionSize, values) => {
    let buf = new Buffer(sectionSize);
    const read = readFile(fd, buf, 0, sectionSize, position);
    return Promise.join(read, () => buf).then(buf => {
        const valueSection = buf.toString();
        let timeEndOfSection;
        for (let i = valueSection.length - 1; i > 0; i--) {
            if (valueSection[i] == '#') {
                timeEndOfSection = i;
                break;
            }
        }

        const valueSectionStartTime = valueSection.match(/#\d+/)[0];
        let valueSectionEndTime = '#';
        for (let i = timeEndOfSection + 1; i < valueSection.length; i++) {
            if (/\d/.test(valueSection[i])) {
                valueSectionEndTime += valueSection[i];
            } else {
                break;
            }
        }

        const sectionSize = Buffer.byteLength(valueSection, 'utf-8');
        // console.log(valueSection);
        console.log(valueSectionStartTime)
        console.log(valueSectionEndTime)

        return sectionSize;
    });

}

const readValuesSection = (fileDesc, fileSize, valuesSectionSize, values) => {
    const defaultSize = valuesSectionSize / 10;
    const position = fileSize - valuesSectionSize;
    return readValues(fileDesc, fileSize, valuesSectionSize, position, defaultSize, values);
}

const readValues = (fileDesc, fileSize, sectionsSize, position, defaultSize, values) => {
    return readValueSection(fileDesc, position, defaultSize, values)
        .then(sectionSize => {
            // console.log(sectionSize)
            // console.log(fileSize)
            const remainsSectionsSize = sectionsSize - sectionSize;
            position += sectionSize;
            if (defaultSize > remainsSectionsSize) {
                return readLastValueSection(fileDesc, position, remainsSectionsSize, values);
            } else if (remainsSectionsSize > 0) {
                return readValues(fileDesc, fileSize, remainsSectionsSize, position, defaultSize, values);
            }
        })
}

const read = path => {
    let fileDesc;
    let fileSize;
    let sectionsSize = 0;

    return Promise.join(openFile(path, 'r'), fileStat(path), (fd, stat) => {
            fileDesc = fd;
            fileSize = stat.size;
            return fd;
        }).then(readDefSection)
        .then(defSectionSize => {
            sectionsSize += defSectionSize;
            return readDumpSection(fileDesc, fileSize, defSectionSize);
        }).then(dumpSection => {
            sectionsSize += dumpSection.size;
            return readValuesSection(fileDesc, fileSize, (fileSize - sectionsSize), dumpSection.values);
        }).then(() => closeFile(fileDesc));
}

read('date8n.vcd')
