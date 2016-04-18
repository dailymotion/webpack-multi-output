# Webpack Multi Output [![Build Status](https://travis-ci.com/dailymotion/webpack-multi-output.svg?token=BQpiDRDdVVk7MYBpasVF&branch=master)](https://travis-ci.com/dailymotion/webpack-multi-output)

Allows the creation of multiple bundles with one configuration. Kinda like the [multi-compiler](https://github.com/webpack/webpack/tree/master/examples/multi-compiler) but where it concerns imports of a specific file extension. And obviously this module gives you crazy performance and will reduce your bundling time compared to the multi-compiler.

## Installation

```shell
$ npm install dailymotion/webpack-multi-output
```

## Usage

Use the loader with the appropriate file extension you want, then use the plugin to define the values you want as output:

```js
import WebpackMultiOutputPlugin from 'webpack-multi-output/plugin'

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
        loader: 'webpack-multi-output',
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

* `filename`: Filename template for the bundles that will be generated. Must contain `[value]` somewhere, default to `bundle-[value].js`. Can contain `[contenthash]`.
* `values`: The plugin will produce a bundle for each value given, appending the value to the bundle name. 
* `assets`: See the [documentation below](#assets).
* `debug`: Log when the plugin adds an asset. Default to `false`

## Assets

The [assets-webpack-plugin](https://github.com/kossnocorp/assets-webpack-plugin) doesn't really understand what we're doing here. So to replace it you have an option to get a similar json file with assets, mapped with the values:

```js
// webpack config
new WebpackMultiOutputPlugin({
  filename: 'bundle-[value].js',
  values: ['en', 'fr'],
  assets: {
    filename: 'assets.json',
    path: path.join(__dirname, 'dist'),
    prettyPrint: true,
  }
})
```

This configuration will output:

```json
{
  "en": {
    "app": {
      "js": "bundle-fr.js"
    }
  },
  "en": {
    "app": {
      "js": "bundle-en.js"
    }
  }
}
```

## Combining with other plugins

Depending on the plugins you want to use in parallel, be carefull where the order of your plugins in your configuration. The plugin performs the replacement of a comment in the code, so if you're using the `UglifyJsPlugin` plugin, you will want to place it in front of it, as `UglifyJsPlugin` will probably remove comments:

```js
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
* `UglifyJsPlugin`
* `extract-text-webpack-plugin`

## Todo

* fix language detection in the filename
* make it work with multiple entries

Bonus:

* make it work with sourcemap
