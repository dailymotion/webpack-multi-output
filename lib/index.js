'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _loader = require('./loader');

Object.defineProperty(exports, 'WebpackMultiOutputLoader', {
  enumerable: true,
  get: function get() {
    return _interopRequireDefault(_loader).default;
  }
});

var _plugin = require('./plugin');

Object.defineProperty(exports, 'WebpackMultiOutputPlugin', {
  enumerable: true,
  get: function get() {
    return _interopRequireDefault(_plugin).default;
  }
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }