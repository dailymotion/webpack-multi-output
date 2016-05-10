# What

A annoying explanation where I try to be clear about what is going on here.

This documentation is for version 2.0.2.

## Configuration

This is the hypothetical configuration that is used for this documentation.

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
      values: ['en', 'fr', 'es'],
      assets: {
        filename: 'assets.json',
        path: path.join(__dirname, 'dist'),
        prettyPrint: true,
      },
      uglify: true,
    })
  ]
}
```

## The Loader

The loader is very simple: it replaces any require for the given file extension in the configuration by a short code, containing the path to the file required. [See the code](https://github.com/dailymotion/webpack-multi-output/blob/135f1a5b2068425cb92c58d383b37b841391f5c7/src/loader.js#L8)

### Example

Input code:

```js
const translations = require('hello.i18n')
```

Output:

```js
exports.default = "WebpackMultiOutput-/path/to/file/hello.i18n-WebpackMultiOutput";
```

## The Plugin

The plugin is a wee bit more complicated. Here is the basic idea of how the webpack compilation goes with the plugin and the loader:

* webpack resolves files and dependencies.
* when webpack loads a `.i18n` file, it receives the code showed above.
* webpack wants to produce a `bundle.js` chunk. The plugin will duplicate this chunk to produce all the bundles we want: `en.bundle.js`, `fr.bundle.js` and `es.bundle.js`. This is done in the `optimize-chunk-assets` phase of the compilation. [See the code](https://github.com/dailymotion/webpack-multi-output/blob/135f1a5b2068425cb92c58d383b37b841391f5c7/src/plugin.js#L48).
* now for all bundles we've created, we need to replace the require we've transformed with the loader with the actual content of the file we want:
  * in `en.bundle.js` we replace `exports.default = "WebpackMultiOutput-/path/to/file/hello.i18n-WebpackMultiOutput";` by the content of `/path/to/file/en.i18n`
  * in `fr.bundle.js` we replace `exports.default = "WebpackMultiOutput-/path/to/file/hello.i18n-WebpackMultiOutput";` by the content of `/path/to/file/fr.i18n`
  * in `es.bundle.js` we replace `exports.default = "WebpackMultiOutput-/path/to/file/hello.i18n-WebpackMultiOutput";` by the content of `/path/to/file/es.i18n`

And voila! Now for more details:

### optimize-chunk-assets

* [line 49](https://github.com/dailymotion/webpack-multi-output/blob/135f1a5b2068425cb92c58d383b37b841391f5c7/src/plugin.js#L49) This part lets us iterate through all the chunks webpack is processing. This way, for each chunk (actually for each files of a chunk), we create all the versions we want.
* [line 57](https://github.com/dailymotion/webpack-multi-output/blob/135f1a5b2068425cb92c58d383b37b841391f5c7/src/plugin.js#L57) we check if we have something to replace in the chunk. if not, we don't produce multiple assets.
* [line 64](https://github.com/dailymotion/webpack-multi-output/blob/135f1a5b2068425cb92c58d383b37b841391f5c7/src/plugin.js#L64) we iterate through the values given in the configuration to create a new asset for each value.
* [line 68](https://github.com/dailymotion/webpack-multi-output/blob/135f1a5b2068425cb92c58d383b37b841391f5c7/src/plugin.js#L68) we process the newly created asset. This uses the [processSource](https://github.com/dailymotion/webpack-multi-output/blob/135f1a5b2068425cb92c58d383b37b841391f5c7/src/plugin.js#L176) method, which will replace all content that we have to replace.

### jsonp-script

This (undocumented) hook for plugins is what is used to generate the code to lazy load chunks. It [basically creates the script to create script tags](https://github.com/webpack/webpack/blob/006d59500de0493c4096d5d4cecd64eb12db2b95/lib/JsonpMainTemplatePlugin.js#L31). We are hacking into it so we can add the version of the asset to match the main bundle. To be more clear: let's say we load `bundle.js`. If we use code-splitting, a `1.bundle.js` will be created. Whenever it's necessary, `bundle.js` will create a new script tag to load `1.bundle.js`. Simple.

Now, we're not using `bundle.js` but `fr.bundle.js` we need to load `fr.1.bundle.js`. To do that, we add a little function to add the correct prefix, and we also need to give the correct hash for the bundle (if we're using hashes in the filenames).

* [line 117](https://github.com/dailymotion/webpack-multi-output/blob/135f1a5b2068425cb92c58d383b37b841391f5c7/src/plugin.js#L120) The function we add in the script.
* [line 191](https://github.com/dailymotion/webpack-multi-output/blob/135f1a5b2068425cb92c58d383b37b841391f5c7/src/plugin.js#L191) `__WEBPACK_MULTI_OUTPUT_VALUE__` is replaced by the value of the asset in the `optimize-chunk-assets` hook.
* [line 229](https://github.com/dailymotion/webpack-multi-output/blob/135f1a5b2068425cb92c58d383b37b841391f5c7/src/plugin.js#L229) `__WEBPACK_MULTI_OUTPUT_CHUNK_MAP__` is replaced by a map of the chunks and their hash in the `optimize-assets` hook.

### optimize-assets

* [line 94](https://github.com/dailymotion/webpack-multi-output/blob/135f1a5b2068425cb92c58d383b37b841391f5c7/src/plugin.js#L94) we iterate through the assets we've created to finish some stuff that we want to do once all plugins are done doing their stuff.
* [line 95](https://github.com/dailymotion/webpack-multi-output/blob/135f1a5b2068425cb92c58d383b37b841391f5c7/src/plugin.js#L95) replace the chunk map. See [jsonp-script](#jsonp-script).
* [line 102](https://github.com/dailymotion/webpack-multi-output/blob/135f1a5b2068425cb92c58d383b37b841391f5c7/src/plugin.js#L102) we replace the hash for each assets so the hash are made from their actual content.

### after-emit

We used to use the [assets-webpack-plugin](https://github.com/kossnocorp/assets-webpack-plugin) to have a json file with our assets. Sadly, this plugin does not understand when there is multiple assets of the same extension so we had to replace it. This is done in the `after-emit` hook.

* [line 140](https://github.com/dailymotion/webpack-multi-output/blob/135f1a5b2068425cb92c58d383b37b841391f5c7/src/plugin.js#L140) we iterate through the assets of the compilation, the create the asset file(s).
* [line 150](https://github.com/dailymotion/webpack-multi-output/blob/135f1a5b2068425cb92c58d383b37b841391f5c7/src/plugin.js#L150) if the assets filename in the configuration contains `[value]`, for example `[value].assets.json`, we will create an asset file for each value. So in this case we'll have `en.assets.json`, `fr.assets.json` and `es.assets.json`.
* [line 158](https://github.com/dailymotion/webpack-multi-output/blob/135f1a5b2068425cb92c58d383b37b841391f5c7/src/plugin.js#L158) if not, we'll have one asset file with all the files for all languages.

## Misc

Random details and stuffs in the plugin or learned writing the plugin.

* [line 38](https://github.com/dailymotion/webpack-multi-output/blob/135f1a5b2068425cb92c58d383b37b841391f5c7/src/plugin.js#L38) here we set a simple property on the compilation object. This allows us to make sure the developers are not using the loader without the plugin, which would make no sense. The check is [done here in the loader](https://github.com/dailymotion/webpack-multi-output/blob/135f1a5b2068425cb92c58d383b37b841391f5c7/src/loader.js#L3).
* [line 102](https://github.com/dailymotion/webpack-multi-output/blob/135f1a5b2068425cb92c58d383b37b841391f5c7/src/plugin.js#L102) the way we create the hash for the chunks is a bit lazy. The hash stuff in webpack actually has options to specify which algorithm and encoding you want to use, and the [loader-utils](https://github.com/webpack/loader-utils) package [provides a method](https://github.com/webpack/loader-utils/blob/master/index.js#L220) to get the hash from the content (used in the [extract-text-webpack-plugin](https://github.com/webpack/extract-text-webpack-plugin/blob/a5996652713ce9804575993b45cbae8dbbdfcf1a/index.js#L303) for example). But getting a simple hash just like that is enough (for now at least).
* [line 225](https://github.com/dailymotion/webpack-multi-output/blob/135f1a5b2068425cb92c58d383b37b841391f5c7/src/plugin.js#L225) since json is not modified with code minification, the function is pretty simple.
* If you write tests for a webpack loader of plugin, [make sure to check for errors returned by webpack](https://github.com/dailymotion/webpack-multi-output/commit/97524d9fc1bcf12e0176317213ae8968bfad2994). Because even when throwing errors, webpack may produce your bundle. Never assume that because your bundles are here means everything went fine.
