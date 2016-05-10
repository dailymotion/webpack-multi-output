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

var _crypto = require('crypto');

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

var _lodash = require('lodash.clone');

var _lodash2 = _interopRequireDefault(_lodash);

var _lodash3 = require('lodash.merge');

var _lodash4 = _interopRequireDefault(_lodash3);

var _webpackSources = require('webpack-sources');

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

  this.addedAssets = [];
  this.assetsMap = {};
  this.chunksMap = {};
  this.chunkName = '';
  this.chunkHash = '';
  this.filePathRe = /WebpackMultiOutput-(.*?)-WebpackMultiOutput/;
  this.filePathReG = /WebpackMultiOutput-(.*?)-WebpackMultiOutput/g;
}

WebpackMultiOutput.prototype.apply = function (compiler) {
  var _this = this;

  compiler.plugin('compilation', function (compilation) {
    compilation.__webpackMultiOutput = true;

    if (_path2.default.extname(compilation.outputOptions.filename) === '.js' && !_this.needsHash) {
      _this.needsHash = /\[hash\]/.test(compilation.outputOptions.filename);
    }

    if (!_this.options.values.length) {
      compilation.errors.push(new Error('[webpack-multi-output] Error: option "values" must be an array of length >= 1'));
    }

    compilation.plugin('optimize-chunk-assets', function (chunks, callback) {
      (0, _async.forEachOfLimit)(chunks, 5, function (chunk, y, chunkCallback) {
        (0, _async.forEachOfLimit)(chunk.files, 5, function (file, k, fileCallback) {
          if (_path2.default.extname(file) !== '.js') {
            return (0, _async.setImmediate)(fileCallback);
          }

          var source = compilation.assets[file];

          if (!_this.filePathReG.test(source.source())) {
            _this.log('Ignoring asset ' + file + ', no replacement to process', 'ultra');
            return (0, _async.setImmediate)(fileCallback);
          }

          var _v = 0;

          _this.options.values.forEach(function (value) {
            var basename = _path2.default.basename(file, '.js');
            var filename = value + '.' + basename + '.js';

            _this.processSource(value, (0, _lodash2.default)(source), function (result) {
              _this.log('Add asset ' + filename);
              compilation.assets[filename] = result;
              _this.chunksMap[chunk.id] = true;
              _this.addedAssets.push({ value: value, filename: filename, name: chunk.name });
              if (chunk.name) {
                if (_this.needsHash) {
                  _this.chunkHash = compilation.getStats().hash;
                }
                _this.chunkName = chunk.name;
                _this.addToAssetsMap(value, chunk.name, '' + compilation.outputOptions.publicPath + filename);
              }

              _v++;
              _v === _this.options.values.length && fileCallback();
            });
          });
        }, chunkCallback);
      }, callback);
    });

    compilation.plugin('optimize-assets', function (assets, callback) {
      var length = _this.chunkHash.length;

      (0, _async.forEachOfLimit)(_this.addedAssets, 5, function (_ref, index, assetCallback) {
        var value = _ref.value;
        var filename = _ref.filename;
        var name = _ref.name;

        var source = _this.replaceChunkMap(compilation.assets[filename]);

        if (!_this.needsHash) {
          compilation.assets[filename] = source;
          return (0, _async.setImmediate)(assetCallback);
        }

        var fileHash = (0, _crypto.createHash)('md5').update(source.source()).digest('hex').substr(0, length);
        var newFilename = filename.replace(_this.chunkHash, fileHash);

        _this.log('Update hash in filename for ' + filename + ' -> ' + newFilename, 'ultra');

        if (filename !== newFilename) {
          compilation.assets[newFilename] = source;
          delete compilation.assets[filename];
          _this.addToAssetsMap(value, name, '' + compilation.outputOptions.publicPath + newFilename);
        }

        assetCallback();
      }, callback);
    });

    compilation.mainTemplate.plugin('jsonp-script', function (_) {
      var source = _.split('\n');

      var chunkIdModifier = 'var webpackMultiOutputGetChunkId = function(chunkId) {\n        var map = {__WEBPACK_MULTI_OUTPUT_CHUNK_MAP__:2};\n        return map[chunkId] ? \'__WEBPACK_MULTI_OUTPUT_VALUE__.\' + chunkId : chunkId;\n      };\n      ';

      source[source.length - 1] = source[source.length - 1].replace('chunkId', 'webpackMultiOutputGetChunkId(chunkId)');
      source.splice(source.length - 1, 0, chunkIdModifier);

      return source.join('\n');
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
  var match = string.match(this.filePathRe);

  return match ? match[1] : '';
};

WebpackMultiOutput.prototype.processSource = function (value, source, callback) {
  var _this2 = this;

  var _source = source.source();
  var replaces = [];
  var matches = _source.match(this.filePathReG);

  (0, _async.forEachOfLimit)(matches, 10, function (match, k, cb) {
    _this2.replaceContent(match, value, function (err, result) {
      replaces.push({ source: match, replace: result });
      cb();
    });
  }, function () {
    replaces.forEach(function (replace) {
      _source = _source.replace('"' + replace.source + '"', replace.replace);
    });

    _source = _source.replace(/__WEBPACK_MULTI_OUTPUT_VALUE__/g, value);

    callback(new _webpackSources.ConcatSource(_source));
  });
};

WebpackMultiOutput.prototype.replaceContent = function (source, value, callback) {
  var _this3 = this;

  var resourcePath = this.getFilePath(source);
  var ext = _path2.default.extname(resourcePath);
  var basename = _path2.default.basename(resourcePath, ext);

  var newResourcePath = resourcePath.replace('' + basename + ext, '' + value + ext);

  _fs2.default.access(newResourcePath, function (err) {
    if (err) {
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

      callback(null, content);
    });
  });
};

WebpackMultiOutput.prototype.uglify = function (source) {
  return JSON.stringify(JSON.parse(source));
};

WebpackMultiOutput.prototype.replaceChunkMap = function (source) {
  this.log('Replacing chunk map ' + JSON.stringify(this.chunksMap), 'ultra');
  return new _webpackSources.ConcatSource(source.source().replace(/\{__WEBPACK_MULTI_OUTPUT_CHUNK_MAP__:2\}/, JSON.stringify(this.chunksMap)));
};

WebpackMultiOutput.prototype.addToAssetsMap = function (value, name, filePath) {
  this.assetsMap[value] = _defineProperty({}, name, {
    js: filePath
  });
};

WebpackMultiOutput.prototype.log = function (message) {
  var level = arguments.length <= 1 || arguments[1] === undefined ? 'debug' : arguments[1];

  if (level === 'ultra') {
    return this.options.ultraDebug && console.log('[WebpackMultiOutput] ' + +new Date() + ' - ' + message);
  }

  this.options.debug && console.log('[WebpackMultiOutput] ' + message);
};