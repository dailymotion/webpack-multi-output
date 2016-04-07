# Webpack Multi Output [![Build Status](https://travis-ci.com/dailymotion/webpack-multi-output.svg?token=BQpiDRDdVVk7MYBpasVF&branch=master)](https://travis-ci.com/dailymotion/webpack-multi-output)

**Work in progress**

Allows the creation of multiple bundles with one configuration.

## Usage

Use the loader with the appropriate file extension you want:

```js
import {WebpackMultiOutputLoader, WebpackMultiOutputPlugin} from 'webpack-multi-output'

module.exports = {
  entry: path.join(__dirname, 'src/index.js'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  module: {
    loaders: [
      {
        test: /\.i18n$/,
        loader: 'WebpackMultiOutputLoader',
      }
    ]
  },
  plugins: [
    new WebpackMultiOutputPlugin({
      values: ['en', 'fr', 'es']
    })
  ]
}
```

This will produce a `bundle.js` and a bundle for each value given to the plugin (`bundle_[value].js`). The imported file will be replaced by a file with the filename changed to the value. Example because this sentence is not clear at all:

```js
// this import
var translations = require(`./i18n/en.i18n`)

// will be transformed in the content of `./i18n/fr.i18n` for bundle_fr.js
```

## Options

* `values`: The plugin will produce a bundle for each value given, appending the value to the bundle name. 
* `keepOriginal`: By default the plugin will remove the basic `bundle.js` file to only keep the versions created by the plugin. Set to true to keep it (default to false).

## Todo

* use `bundle_[lang].js` in output, interpolate the value in plugin
* test with a bunch of plugins
