# Webpack Multi Output

**Work in progress**

Allows the creation of multiple bundles with one configuration.

## Usage

Use the loader with the appropriate file extension you want:

```js
import {WebpackMultiOutputLoader, WebpackMultiOutputPlugin} from 'webpack-multi-output'

module.exports = {
  // ...
  module: {
    loaders: [
      {
        test: /\.json$/,
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

## Todo

* use `bundle_[lang].js` in output, interpolate the value in plugin
* test with a bunch of plugins
