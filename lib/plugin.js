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
    filename: options.filename ? options.filename : 'bundle-[value].js',
    values: options.values ? options.values : []
  };

  this.assets = [];
  this.mainBundleName = false;
}

function getFilePath(string) {
  var filePathRe = /\[WebpackMultiOutput\] (.*?) \[WebpackMultiOutput\]/;
  var match = string.match(filePathRe);

  return match ? match[1] : '';
}

WebpackMultiOutput.prototype.apply = function (compiler) {
  var _this = this;

  compiler.plugin('compilation', function (compilation) {
    compilation.__webpackMultiOutput = {
      addAssets: function addAssets() {
        if (!_this.assets.length) {
          _this.mainBundleName = compilation.outputOptions.filename;
          _this.options.values.forEach(function (value) {
            var filename = _this.options.filename.replace('[value]', value);
            _this.assets.push(filename);
            compilation.assets[filename] = new _webpackSources.ConcatSource(new _webpackSources.RawSource('/* [WebpackMultiOutput] */'), new _webpackSources.OriginalSource('/* [WebpackMultiOutput] */', 'webpack-multi-output.js'));
          });
        }
      }
    };

    if (!_this.options.values.length) {
      compilation.errors.push(new Error('[webpack-multi-output] Error: option "values" must be an array of length >= 1'));
    }

    compilation.plugin('optimize-chunk-assets', function (chunks, callback) {
      var langAsset = (0, _lodash2.default)(compilation.assets[_this.mainBundleName]);

      // prevent errors in children compilations
      if (typeof langAsset === 'undefined') {
        return callback();
      }

      _this.assets.forEach(function (asset) {
        compilation.assets[asset] = langAsset;
      });

      chunks.forEach(function (chunk) {
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
              var _value = _path2.default.basename(file).replace(_path2.default.extname(file), '').split('-')[1];

              if (_value) {
                var lines = _source.source().split('\n');

                lines = lines.map(function (line) {
                  return _this.replaceContent(line, _value);
                });

                compilation.assets[file] = new _webpackSources.ConcatSource(new _webpackSources.RawSource(lines.join('\n')), new _webpackSources.OriginalSource(lines.join('\n'), 'webpack-multi-output.js'));
              }
            })();
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