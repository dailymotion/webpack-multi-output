'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = WebpackMultiOutput;
exports.getFilePath = getFilePath;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _lodash = require('lodash.clone');

var _lodash2 = _interopRequireDefault(_lodash);

var _webpackSources = require('webpack-sources');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var re = /\[WebpackMultiOutput\]/;

function WebpackMultiOutput() {
  var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  this.options = {
    values: options.values ? options.values : [],
    keepOriginal: options.keepOriginal ? true : false
  };
}

function getFilePath(string) {
  var filePathRe = /\[WebpackMultiOutput\] (.*?) \[WebpackMultiOutput\]/;
  var match = string.match(filePathRe);

  return match ? match[1] : '';
}

WebpackMultiOutput.prototype.apply = function (compiler) {
  var _this = this;

  compiler.plugin('compilation', function (compilation) {
    if (!_this.options.values.length) {
      compilation.errors.push(new Error('[webpack-multi-output] Error: option "values" must be an array of length >= 1'));
    }

    compilation.plugin('optimize-chunk-assets', function (chunks, callback) {
      var outputName = compilation.options.output.filename;
      var baseAsset = compilation.assets[outputName];
      var langAsset = (0, _lodash2.default)(baseAsset);

      // add asset for each value
      _this.options.values.forEach(function (value) {
        var ext = _path2.default.extname(outputName);
        var filename = outputName.replace(ext, '');
        var langAssetName = filename + '_' + value + ext;
        console.log('[WebpackMultiOutput] Adding asset ' + langAssetName);
        compilation.assets[langAssetName] = langAsset;
      });

      if (!_this.options.keepOriginal) {
        delete compilation.assets[outputName];
      }

      chunks.forEach(function (chunk) {
        Object.keys(compilation.assets).forEach(function (asset) {
          if (chunk.files.indexOf(asset) === -1) {
            chunk.files.push(asset);
          }
        });

        chunk.files.forEach(function (file) {
          var _source = new _webpackSources.ConcatSource(compilation.assets[file]);
          var _value = _path2.default.basename(file).replace(_path2.default.extname(file), '').split('_')[1];

          if (_value) {
            var lines = _source.source().split('\n');

            lines = lines.map(function (line) {
              return _this.replaceContent(line, _value);
            });

            compilation.assets[file] = new _webpackSources.ConcatSource(lines.join('\n'));
          }
        });
      });
      callback();
    });
  });
};

WebpackMultiOutput.prototype.replaceContent = function (source, value) {
  if (!re.test(source)) {
    return source;
  }

  var resourcePath = getFilePath(source);
  var basename = _path2.default.basename(resourcePath);
  var ext = _path2.default.extname(basename);
  var language = basename.replace(ext, '');

  var newResourcePath = _path2.default.join(resourcePath.replace(basename, ''), '' + value + ext);

  if (!_fs2.default.existsSync(newResourcePath)) {
    newResourcePath = resourcePath;
  }

  return 'module.exports = ' + _fs2.default.readFileSync(newResourcePath, 'utf-8') + ';';
};