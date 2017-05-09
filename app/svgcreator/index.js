'use strict';
const phantom = require('phantom');

const svgDrawer = function(time, prevData, currData, singleVars, multiVars) {
    const ROW_HEIGHT = 40;
    const ROW_WIDTH = 5;
    const BOTTOM_BORDER = 1;

    const numOfRow = singleVars.length + multiVars.length;
    const timeInterval = time.end - time.start
    const svgContainer = document.getElementById("svg");
    const width = timeInterval * ROW_WIDTH;
    const height = numOfRow * ROW_HEIGHT;
    const paper = Raphael(svgContainer, width, height + BOTTOM_BORDER);

    paper.rect(0, 0, width, height + BOTTOM_BORDER)
        .attr({
            fill: '#fff',
            stroke: 'none'
        });

    var rowNum = 0;
    singleVars.forEach(function(value, index) {
        rowNum = (index + 1);
        if (prevData[value] == 0 && currData[value] == 1) {
            paper.path(["M", 0, ROW_HEIGHT * rowNum, "L", 0, (ROW_HEIGHT * rowNum) - ROW_HEIGHT / 2, "H", width]);
        } else if (prevData[value] == 1 && currData[value] == 0) {
            paper.path(["M", 0, (ROW_HEIGHT * rowNum) - ROW_HEIGHT / 2, "L", 0, ROW_HEIGHT * rowNum, "H", width]);
        } else if (prevData[value] && prevData[value] == currData[value]) {
            paper.path(["M", 0, (ROW_HEIGHT * rowNum) - ROW_HEIGHT / 2 * currData[value], "H", width]);
        }
    });

    rowNum = singleVars.length;
    multiVars.forEach(function(value, index) {
      rowNum = (rowNum + 1);
      if (prevData[value] == currData[value]) {
            paper.path(["M", 0, (ROW_HEIGHT * rowNum) - ROW_HEIGHT / 2, "L", width, (ROW_HEIGHT * rowNum) - ROW_HEIGHT / 2]);
            paper.path(["M", 0, ROW_HEIGHT * rowNum, "L", width, ROW_HEIGHT * rowNum]);
      } else if (prevData[value] != currData[value]){
         paper.path(["M", 0, (ROW_HEIGHT * rowNum) - ROW_HEIGHT / 2, "L", 4, ROW_HEIGHT * rowNum]);
         paper.path(["M", 0, ROW_HEIGHT * rowNum, "L", 4, (ROW_HEIGHT * rowNum) - ROW_HEIGHT / 2]);
         paper.path(["M", 4, (ROW_HEIGHT * rowNum) - ROW_HEIGHT / 2, "L", width, (ROW_HEIGHT * rowNum) - ROW_HEIGHT / 2]);
         paper.path(["M", 4, ROW_HEIGHT * rowNum, "L", width, ROW_HEIGHT * rowNum]);
        const currValue = (parseInt( currData[value], 2)).toString(16)
         paper.text(12, (ROW_HEIGHT * rowNum) - ROW_HEIGHT / 2 + 10, currValue).attr({ "font-weight": "bold", fill: "black", "font-size": 11 });
      }
    });


    return svgContainer.innerHTML;
}


let _ph;

const initialize = () => {
    return phantom.create().then(ph => {
        _ph = ph;
        return ph;
    }).catch(err => console.log(`Some error happened when ph was creating ${err}`));
}

const get = (time, prevData, currData, singleVars, multiVars) => {
    // console.log(time, prevData, currData)
    let _page;
    return _ph.createPage().then(page => {
        _page = page;
        return page.open('http://localhost:4000/svg.html');
    }).then(status => {
        return _page.evaluate(svgDrawer, time, prevData, currData, singleVars, multiVars);
    }).then(content => {
        // console.log(content);
        _page.close()
        return content;
    }).catch(err => console.log(`Some error happened when svg was creating ${err}`));
}

const destroyPh = () => {
    _ph.exit();
}

exports.initialize = initialize;
exports.get = get;

// process.on('exit', function () {
//   destroyPh();
//   console.log('About to exit.');
// });
