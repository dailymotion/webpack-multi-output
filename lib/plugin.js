'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

exports.default = WebpackMultiOutput;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

var _lodash = require('lodash.clone');

var _lodash2 = _interopRequireDefault(_lodash);

var _lodash3 = require('lodash.merge');

var _lodash4 = _interopRequireDefault(_lodash3);

var _webpackSources = require('webpack-sources');

var _loaderUtils = require('loader-utils');

var _async = require('async');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var baseAssets = {
  filename: 'assets.json',
  path: '.',
  prettyPrint: false
};

function WebpackMultiOutput() {
  var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  this.options = (0, _lodash4.default)({
    values: [],
    debug: false,
    ultraDebug: false,
    uglify: false
  }, options);

  this.options.assets = _typeof(options.assets) === 'object' ? (0, _lodash4.default)(baseAssets, options.assets) : false;

  this.assets = [];
  this.assetsMap = {};
  this.assetsValue = {};
  this.chunkName = '';
  this.mainBundleName = false;

  this.re = /WebpackMultiOutput-/;
}

WebpackMultiOutput.prototype.apply = function (compiler) {
  var _this = this;

  compiler.plugin('compilation', function (compilation) {
    compilation.__webpackMultiOutput = true;

    if (!_this.options.values.length) {
      compilation.errors.push(new Error('[webpack-multi-output] Error: option "values" must be an array of length >= 1'));
    }

    compilation.plugin('optimize-chunk-assets', function (chunks, callback) {
      (0, _async.forEachOfLimit)(chunks, 5, function (chunk, y, chunkCallback) {
        // crappppppp
        _this.chunkName = chunk.name;
        (0, _async.forEachOfLimit)(chunk.files, 5, function (file, k, fileCallback) {
          if (_path2.default.extname(file) !== '.js') {
            return fileCallback();
          }

          var _v = 0;

          _this.options.values.forEach(function (value) {
            var source = compilation.assets[file];
            var basename = _path2.default.basename(file, '.js');
            var filename = value + '.' + basename + '.js';

            _this.processSource(value, (0, _lodash2.default)(source), function (result) {
              _this.log('Add asset ' + filename);
              compilation.assets[filename] = result;
              _this.assetsMap[value] = _defineProperty({}, _this.chunkName, {
                js: '' + compilation.outputOptions.publicPath + filename
              });

              _v++;
              _v === _this.options.values.length && fileCallback();
            });
          });
        }, function () {
          chunkCallback();
        });
      }, callback);
    });
  });

  compiler.plugin('after-emit', function (compilation, callback) {
    if (!_this.options.assets) {
      return callback();
    }

    _mkdirp2.default.sync(_this.options.assets.path);

    Object.keys(compilation.assets).forEach(function (assetName) {
      var ext = _path2.default.extname(assetName);
      if (ext !== '.js') {
        for (var value in _this.assetsMap) {
          _this.assetsMap[value][_this.chunkName][ext.replace('.', '')] = '' + compilation.outputOptions.publicPath + assetName;
        }
      }
    });

    if (/\[value\]/.test(_this.options.assets.filename)) {
      for (var value in _this.assetsMap) {
        var filePath = _path2.default.join(_this.options.assets.path, _this.options.assets.filename.replace('[value]', value));
        var content = _this.options.assets.prettyPrint ? JSON.stringify(_this.assetsMap[value], null, 2) : JSON.stringify(_this.assetsMap[value]);

        _fs2.default.writeFileSync(filePath, content, { flag: 'w' });
        _this.log('Asset file ' + filePath + ' written');
      }
    } else {
      var _filePath = _path2.default.join(_this.options.assets.path, _this.options.assets.filename);
      var _content = _this.options.assets.prettyPrint ? JSON.stringify(_this.assetsMap, null, 2) : JSON.stringify(_this.assetsMap);

      _fs2.default.writeFileSync(_filePath, _content, { flag: 'w' });
      _this.log('Asset file ' + _filePath + ' written');
    }

    callback();
  });
};

WebpackMultiOutput.prototype.getFilePath = function (string) {
  var filePathRe = /WebpackMultiOutput-(.*?)-WebpackMultiOutput/;
  var match = string.match(filePathRe);

  return match ? match[1] : '';
};

WebpackMultiOutput.prototype.processSource = function (value, source, callback) {
  var _this2 = this;

  var lines = source.source().split('\n');

  (0, _async.mapLimit)(lines, 20, function (line, mapCb) {
    _this2.replaceContent(line, value, function (err, result) {
      mapCb(err, result);
    });
  }, function (err, resultLines) {
    var source = new _webpackSources.ConcatSource(resultLines.join('\n'));
    callback(source);
  });
};

WebpackMultiOutput.prototype.replaceContent = function (source, value, callback) {
  var _this3 = this;

  if (!this.re.test(source)) {
    return (0, _async.setImmediate)(function () {
      callback(null, source);
    });
  }

  var resourcePath = this.getFilePath(source);
  var ext = _path2.default.extname(resourcePath);
  var basename = _path2.default.basename(resourcePath, ext);

  var newResourcePath = resourcePath.replace('' + basename + ext, '' + value + ext);

  _fs2.default.exists(newResourcePath, function (exists) {
    if (!exists) {
      newResourcePath = resourcePath;
    }

    _this3.log('Replacing content for ' + newResourcePath, 'ultra');
    _fs2.default.readFile(newResourcePath, 'utf-8', function (err, content) {
      if (err) {
        console.error(err);
        callback(err);
      }

      if (_this3.options.uglify) {
        content = _this3.uglify(content);
      }

      source = source.replace('"WebpackMultiOutput-' + resourcePath + '-WebpackMultiOutput"', content);

      callback(null, source);
    });
  });
};

WebpackMultiOutput.prototype.uglify = function (source) {
  return JSON.stringify(JSON.parse(source));
};

WebpackMultiOutput.prototype.log = function (message) {
  var level = arguments.length <= 1 || arguments[1] === undefined ? 'debug' : arguments[1];

  if (level === 'ultra') {
    return this.options.ultraDebug && console.log('[WebpackMultiOutput] ' + +new Date() + ' - ' + message);
  }

  this.options.debug && console.log('[WebpackMultiOutput] ' + message);
};