'use strict';

const path = require('path');
const join = path.join;
const dirname = path.dirname;
const rootDir = dirname(__dirname);
const srcDir = join(rootDir, 'app');
const publicDir = join(rootDir, 'public');
const verilogDir = join(rootDir, 'verilog');

module.exports = {
  dir : {
    src : srcDir,
    public: publicDir,
    verilog: verilogDir
  }
}