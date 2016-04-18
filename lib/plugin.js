'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = WebpackMultiOutput;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _lodash = require('lodash.clone');

var _lodash2 = _interopRequireDefault(_lodash);

var _webpackSources = require('webpack-sources');

var _loaderUtils = require('loader-utils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function WebpackMultiOutput() {
  var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  this.options = {
    filename: options.filename ? options.filename : 'bundle-[value].js',
    values: options.values ? options.values : []
  };

  this.assets = [];
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

      chunks.forEach(function (chunk) {
        _this.chunkName = chunk.name;
        if (chunk.files.indexOf(_this.mainBundleName) !== -1) {
          Object.keys(compilation.assets).forEach(function (asset) {
            if (chunk.files.indexOf(asset) === -1) {
              console.log('[WebpackMultiOutput] Add asset ' + asset);
              chunk.files.push(asset);
            }
          });
        }

        chunk.files.forEach(function (file) {
          if (_this.assets.indexOf(file) !== -1) {
            (function () {
              var _source = new _webpackSources.ConcatSource(compilation.assets[file]);
              // crap
              var _parts = _path2.default.basename(file).replace(_path2.default.extname(file), '').split('-');
              var _value = _parts[_parts.length - 1];

              if (_value) {
                var lines = _source.source().split('\n');

                lines = lines.map(function (line) {
                  return _this.replaceContent(line, _value);
                });

                var source = new _webpackSources.ConcatSource(lines.join('\n'));

                compilation.assets[file] = source;
              }
            })();
          }
        });
      });

      callback();
    });

    compilation.plugin('optimize-assets', function (assets, callback) {
      _this.assets.forEach(function (asset) {
        var source = compilation.assets[asset];
        if (typeof source !== 'undefined') {
          var filename = asset.replace(/\[(?:(\w+):)?contenthash(?::([a-z]+\d*))?(?::(\d+))?\]/ig, function () {
            return (0, _loaderUtils.getHashDigest)(source.source(), _arguments[1], _arguments[2], parseInt(_arguments[3], 10));
          }).replace('[name]', _this.chunkName);

          if (filename !== asset) {
            compilation.assets[filename] = source;
            delete compilation.assets[asset];
          }
        }
      });

      callback();
    });
  });
};

WebpackMultiOutput.prototype.getFilePath = function (string) {
  var filePathRe = /\[WebpackMultiOutput\] (.*?) \[WebpackMultiOutput\]/;
  var match = string.match(filePathRe);

  return match ? match[1] : '';
};

WebpackMultiOutput.prototype.replaceContent = function (source, value) {
  if (!this.re.test(source)) {
    return source;
  }

  var resourcePath = this.getFilePath(source);
  var ext = _path2.default.extname(resourcePath);
  var basename = _path2.default.basename(resourcePath, ext);

  var newResourcePath = _path2.default.join(resourcePath.replace('' + basename + ext, ''), '' + value + ext);

  if (!_fs2.default.existsSync(newResourcePath)) {
    newResourcePath = resourcePath;
  }

  return 'module.exports = ' + _fs2.default.readFileSync(newResourcePath, 'utf-8') + ';';
};