"use strict";

module.exports = function () {
  this.cacheable && this.cacheable();
  if (!this._compilation.__webpackMultiOutput) {
    throw new Error("\"webpack-multi-output\" loader is used without the corresponding plugin,\nrefer to https://github.com/dailymotion/webpack-multi-output for the usage example");
  }

  return "exports.default = \"WebpackMultiOutput-" + this.resourcePath + "-WebpackMultiOutput\";";
};