# Webpack Multi Output [![Build Status](https://travis-ci.com/dailymotion/webpack-multi-output.svg?token=BQpiDRDdVVk7MYBpasVF&branch=master)](https://travis-ci.com/dailymotion/webpack-multi-output)

Allows the creation of multiple bundles with one configuration.

## Installation

```shell
$ npm install dailymotion/webpack-multi-output
```

## Usage

Use the loader with the appropriate file extension you want, then use the plugin to define the values you want as output:

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
      filename: 'bundle-[value].js',
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

* `filename`: Filename template for the bundles that will be generate. Must contain `[value]` somewhere, default to `bundle-[value].js`
* `values`: The plugin will produce a bundle for each value given, appending the value to the bundle name. 

## Combining with other plugins

Depending on the plugins you want to use in parallel, be carefull where the order of your plugins in your configuration. The plugin performs the replacement of a comment in the code, so if you're using the `UglifyJsPlugin` plugin, you will want to place it in front of it, as `UglifyJsPlugin` will probably remove comments:

```
// ...
plugins: [
  // the define plugin will probably be in front
  new webpack.DefinePlugin({
    __DEV__: process.env.NODE_ENV == 'dev',
  }),
  new WebpackMultiOutputPlugin({
    values: ['en', 'fr', 'es']
  }),
  // uglify should be after as it removes comments
  new webpack.optimize.UglifyJsPlugin({
    output:{
      comments: false
    },
    compressor: {
      warnings: false
    }
  }),
]
```

### The following plugins are supported and tested in combination with `webpack-multi-output`:

* `DefinePlugin`
* `OccurenceOrderPlugin`
* `extract-text-webpack-plugin`

## Todo

* use `bundle_[value].js` in output, interpolate the value in plugin
* add check to be sure the plugin is used with the loader
