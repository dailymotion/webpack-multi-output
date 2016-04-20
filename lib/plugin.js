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
    filename: 'bundle-[value].js',
    values: [],
    debug: false
  }, options);

  this.options.assets = _typeof(options.assets) === 'object' ? (0, _lodash4.default)(baseAssets, options.assets) : false;

  this.assets = [];
  this.assetsMap = {};
  this.chunkName = '';
  this.mainBundleName = false;

  this.re = /\[WebpackMultiOutput\]/;
}

WebpackMultiOutput.prototype.apply = function (compiler) {
  var _this = this,
      _arguments = arguments;

  compiler.plugin('compilation', function (compilation) {
    compilation.__webpackMultiOutput = {
      addAssets: function addAssets() {
        if (!_this.assets.length) {
          _this.mainBundleName = compilation.outputOptions.filename;
          _this.options.values.forEach(function (value) {
            var filename = _this.options.filename.replace('[value]', value);
            _this.assets.push(filename);
            compilation.assets[filename] = new _webpackSources.ConcatSource('/* WebpackMultiOutput */');
          });
        }
      }
    };

    if (!_this.options.values.length) {
      compilation.errors.push(new Error('[webpack-multi-output] Error: option "values" must be an array of length >= 1'));
    }

    compilation.plugin('optimize-chunk-assets', function (chunks, callback) {
      var langAsset = (0, _lodash2.default)(compilation.assets[_this.mainBundleName]);

      // fallback if the main bundle has [name]
      if (typeof langAsset === 'undefined') {
        var assets = compilation.assets;
        if (Object.keys(assets).length > 1) {
          var jsBundles = Object.keys(assets).filter(function (asset) {
            return _path2.default.extname(asset) === '.js' && _this.assets.indexOf(asset) === -1;
          });

          _this.mainBundleName = jsBundles[jsBundles.length - 1];
          langAsset = (0, _lodash2.default)(assets[_this.mainBundleName]);
        } else {
          // prevent errors in children compilations
          return callback();
        }
      }

      _this.assets.forEach(function (asset) {
        compilation.assets[asset] = langAsset;
      });

      var _c = chunks.length;
      var _cd = 0;

      chunks.forEach(function (chunk) {
        _this.chunkName = chunk.name;
        if (chunk.files.indexOf(_this.mainBundleName) !== -1) {
          Object.keys(compilation.assets).forEach(function (asset) {
            if (chunk.files.indexOf(asset) === -1) {
              _this.log('[WebpackMultiOutput] Add asset ' + asset);
              chunk.files.push(asset);
            }
          });
        }

        (0, _async.forEachOfLimit)(chunk.files, 5, function (file, k, cb) {
          if (_this.assets.indexOf(file) === -1) {
            return (0, _async.setImmediate)(cb);
          }

          var _source = new _webpackSources.ConcatSource(compilation.assets[file]);
          // crap
          var _parts = _path2.default.basename(file).replace(_path2.default.extname(file), '').split('-');
          var _value = _parts[_parts.length - 1];

          if (!_value) {
            return (0, _async.setImmediate)(cb);
          }

          var lines = _source.source().split('\n');

          (0, _async.mapLimit)(lines, 20, function (line, mapCb) {
            _this.replaceContent(line, _value, function (err, result) {
              mapCb(err, result);
            });
          }, function (err, resultLines) {
            var source = new _webpackSources.ConcatSource(resultLines.join('\n'));

            compilation.assets[file] = source;
            cb();
          });
        }, function () {
          _cd++;

          _cd === _c && callback();
        });
      });
    });

    compilation.plugin('optimize-assets', function (assets, callback) {
      (0, _async.forEachOfLimit)(_this.assets, 20, function (asset, k, cb) {
        var source = compilation.assets[asset];
        if (typeof source === 'undefined') {
          return (0, _async.setImmediate)(cb);
        }

        var filename = asset.replace(/\[(?:(\w+):)?contenthash(?::([a-z]+\d*))?(?::(\d+))?\]/ig, function () {
          return (0, _loaderUtils.getHashDigest)(source.source(), _arguments[1], _arguments[2], parseInt(_arguments[3], 10));
        }).replace('[name]', _this.chunkName);

        if (filename !== asset) {
          compilation.assets[filename] = source;
          delete compilation.assets[asset];
        }

        var ext = _path2.default.extname(filename);
        var basename = _path2.default.basename(filename, ext);
        var value = basename.split('-')[basename.split('-').length - 1];

        _this.assetsMap[value] = _defineProperty({}, _this.chunkName, {
          js: filename
        });

        cb();
      }, function () {
        callback();
      });
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
          _this.assetsMap[value][_this.chunkName][ext.replace('.', '')] = assetName;
        }
      }
    });

    if (/\[value\]/.test(_this.options.assets.filename)) {
      for (var value in _this.assetsMap) {
        var filePath = _path2.default.join(_this.options.assets.path, _this.options.assets.filename.replace('[value]', value));
        var content = _this.options.assets.prettyPrint ? JSON.stringify(_this.assetsMap[value], null, 2) : JSON.stringify(_this.assetsMap[value]);

        _fs2.default.writeFileSync(filePath, content, { flag: 'w' });
        _this.log('[WebpackMultiOutput] Asset file ' + filePath + ' written');
      }
    } else {
      var _filePath = _path2.default.join(_this.options.assets.path, _this.options.assets.filename);
      var _content = _this.options.assets.prettyPrint ? JSON.stringify(_this.assetsMap, null, 2) : JSON.stringify(_this.assetsMap);

      _fs2.default.writeFileSync(_filePath, _content, { flag: 'w' });
      _this.log('[WebpackMultiOutput] Asset file ' + _filePath + ' written');
    }

    callback();
  });
};

WebpackMultiOutput.prototype.getFilePath = function (string) {
  var filePathRe = /\[WebpackMultiOutput\] (.*?) \[WebpackMultiOutput\]/;
  var match = string.match(filePathRe);

  return match ? match[1] : '';
};

WebpackMultiOutput.prototype.replaceContent = function (source, value, callback) {
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

    _fs2.default.readFile(newResourcePath, 'utf-8', function (err, content) {
      if (err) {
        console.error(err);
        callback(err);
      }

      callback(null, 'module.exports = ' + content + ';');
    });
  });
};

WebpackMultiOutput.prototype.log = function (message) {
  this.options.debug && console.log(message);
};