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
      values: ['en', 'fr', 'es']
    })
  ]
}
```

This will produce a `bundle.js` and a bundle for each value given to the plugin (`[value].bundle.js`). The imported file will be replaced by a file with the filename changed to the value. Example because this sentence is not clear at all:

```js
// your code
var translations = require(`./i18n/en.i18n`)
```

With the configuration above, this will produce three bundles: `en.bundle.js` with `translations` being the content of `./i18n/en.i18n`, `fr.bundle.js` with the content of `./i18n/fr.i18n` and `es.bundle.js` with the content of `./i18n/es.i18n`.

### Code splitting

Using `require.ensure()`? No problem. If the module you require needs also require some `.i18n` files (following the example above), the plugin will also create multiple versions for all given values. And all bundles will load the appropriate chunks: for example, the bundle `fr.bundle.js` will load the chunk `fr.1.bundle.js`.

## Options

* `values`: The plugin will produce a bundle for each value given, appending the value to the bundle name. 
* `assets`: See the [documentation below](#assets).
* `uglify`: If you're using this module for json, enable this option to minify it. See [Uglify](#uglify) for more informations.
* `debug`: Log when the plugin adds an asset. Default to `false`

## Assets

The [assets-webpack-plugin](https://github.com/kossnocorp/assets-webpack-plugin) doesn't really understand what we're doing here. So to replace it you have an option to get a similar json file with assets, mapped with the values:

```js
// webpack config
new WebpackMultiOutputPlugin({
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

### Multiple assets files

If you need an asset file per value, just use `[value]` in the `filename` option:

```js
new WebpackMultiOutputPlugin({
  values: ['en', 'fr'],
  assets {
    filename: '[value].json',
    path: path.join(__dirname, 'dist'),
    prettyPrint: true,
  }
})
```

This will create a `en.json` and a `fr.json`, each one with their corresponding assets.

## Uglify

Depending on the plugins you want to use in parallel, be carefull where the order of your plugins in your configuration. 

The plugin performs a replacement in the code. If you want to use the Uglify plugin in parallel **and** the files you are requiring are json, you can use the `uglify` option so the json content will be minified. This will give you a huge perf boost when bundling as uglify will run only once.

If you are not using `webpack-multi-output` to require something else than json, make sure to use the Uglify plugin **after** so the code replaced will be minified.

```js
// ...
plugins: [
  // the define plugin will probably be in front
  new webpack.DefinePlugin({
    __DEV__: process.env.NODE_ENV == 'dev',
  }),
  new webpack.optimize.UglifyJsPlugin({
    output:{
      comments: false
    },
    compressor: {
      warnings: false
    }
  }),
  new WebpackMultiOutputPlugin({
    values: ['en', 'fr', 'es'],
    uglify: true,
  }),
]
```

### The following plugins are supported and tested in combination with `webpack-multi-output`:

* `DefinePlugin`
* `OccurenceOrderPlugin`
* `UglifyJsPlugin`
* `extract-text-webpack-plugin`

## Explanation of how things work

See [What](./what.md) for informations about what the plugin is doing and how.
