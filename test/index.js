import fs from 'fs'
import path from 'path'
import {expect} from 'chai'
import webpack from 'webpack'
import ExtractTextPlugin from 'extract-text-webpack-plugin'

import WebpackMultiOutputPlugin from '../src/plugin'
import WebpackMultiOutputLoader from '../src/loader'
const compiledLoader = require('../')
const compiledPlugin = require('../plugin')

import * as test from '../'

const config = {
  entry: path.join(__dirname, 'webpack/index.js'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
      },
      {
        test: /\.i18n$/,
        loader: 'WebpackMultiOutputLoader',
      },
    ],
  },
  resolveLoader: {
    alias: {
      WebpackMultiOutputLoader: path.join(__dirname, '../src/loader.js'),
    }
  },
  plugins: [
    new webpack.DefinePlugin({
      __LOCALE__: `'fr'`,
    }),
    new WebpackMultiOutputPlugin({
      filename: 'bundle-[value].js',
      values: ['fr', 'en'],
      debug: true,
    }),
  ],
}

describe('Webpack Multi Output', () => {
  it('should export a plugin', () => {
    expect(WebpackMultiOutputPlugin).to.be.a('function')
  })

  it('should export a loader', () => {
    expect(compiledLoader).to.be.a('function')
  })

  it('should export correctly when transpiled', () => {
    expect(compiledPlugin).to.be.a('function')
  })

  describe('Plugin regex checker', () => {
    let instance

    before(() => {
      instance = new WebpackMultiOutputPlugin({})
    })

    it('should export a function', () => {
      expect(instance.getFilePath).to.be.a('function')
    })

    it('should return the filename', () => {
      expect(instance.getFilePath('/* [WebpackMultiOutput] /path/to/file.js [WebpackMultiOutput] */')).to.equal('/path/to/file.js')
    })
  })

  describe('Webpack plugin', () => {
    const bundlePath = path.join(__dirname, 'dist/bundle.js')
    const bundlePathFR = path.join(__dirname, 'dist/bundle-fr.js')
    const bundlePathEN = path.join(__dirname, 'dist/bundle-en.js')

    before((done) => {
      webpack(config, (err, stats) => {
        if (err) {
          return done(err)
        }

        if (stats.hasErrors()) {
          return done(new Error(stats.toString()))
        }

        done()
      })
    })

    it('should produce a bundle for each value', () => {
      const bundleExists = fs.existsSync(bundlePath)
      const bundleExistsFR = fs.existsSync(bundlePathFR)
      const bundleExistsEN = fs.existsSync(bundlePathEN)

      expect(bundleExists).to.be.true
      expect(bundleExistsFR).to.be.true
      expect(bundleExistsEN).to.be.true
    })

    it('should include the appropriate content for value FR', done => {
      fs.readFile(bundlePathFR, 'utf-8', (err, content) => {
        if (err) {
          return done(err)
        }

        expect(content).to.contain('Ceci est un test')
        done()
      })
    })

    it('should include the appropriate content for value EN', done => {
      fs.readFile(bundlePathEN, 'utf-8', (err, content) => {
        if (err) {
          return done(err)
        }

        expect(content).to.contain('This is a test translated')
        done()
      })
    })
  })

  describe('Plugin combining', () => {
    const bundlePath = path.join(__dirname, 'dist-combine-plugins/bundle.js')
    const cssBundlePath = path.join(__dirname, 'dist-combine-plugins/style.css')
    const bundlePathFR = path.join(__dirname, 'dist-combine-plugins/bundle-fr.js')
    const bundlePathEN = path.join(__dirname, 'dist-combine-plugins/bundle-en.js')

    before(function(done) {
      this.timeout(4000)
      const altConfig = {
        ...config,
        context: path.join(__dirname, '..'),
        entry: path.join(__dirname, 'webpack/complex.js'),
        output: {
          path: path.resolve(__dirname, 'dist-combine-plugins'),
          filename: 'bundle.js',
          publicPath: '/static/',
        },
        module: {
          loaders: [
            ...config.module.loaders,
            {
              test: /\.css$/,
              loader: ExtractTextPlugin.extract('style-loader', 'css'),
            }
          ]
        },
        plugins: [
          new webpack.DefinePlugin({
            __LOCALE__: `'fr'`,
          }),
          new WebpackMultiOutputPlugin({
            filename: 'bundle-[value].js',
            values: ['fr', 'en'],
            debug: true,
          }),
          new webpack.optimize.OccurenceOrderPlugin(true),
          new webpack.optimize.UglifyJsPlugin({
            output: {
              comments: false
            },
            compressor: {
              warnings: false
            }
          }),
          new ExtractTextPlugin('style.css'),
        ],
      }

      webpack(altConfig, (err, stats) => {
        if (err) {
          return done(err)
        }

        if (stats.hasErrors()) {
          return done(new Error(stats.toString()))
        }

        done()
      })
    })

    it('should produce a bundle for each value with other plugins', () => {
      const bundleExists = fs.existsSync(bundlePath)
      const cssBundlePathExists = fs.existsSync(cssBundlePath)
      const bundleExistsFR = fs.existsSync(bundlePathFR)
      const bundleExistsEN = fs.existsSync(bundlePathEN)

      expect(bundleExists).to.be.true
      expect(cssBundlePathExists).to.be.true
      expect(bundleExistsFR).to.be.true
      expect(bundleExistsEN).to.be.true
    })

    it('should include the appropriate content for value FR', done => {
      fs.readFile(bundlePathFR, 'utf-8', (err, content) => {
        if (err) {
          return done(err)
        }

        expect(content).to.contain('Ceci est un test')
        done()
      })
    })

    it('should include the appropriate content for value EN', done => {
      fs.readFile(bundlePathEN, 'utf-8', (err, content) => {
        if (err) {
          return done(err)
        }

        expect(content).to.contain('This is a test translated')
        done()
      })
    })

    it('should have minified the assets with UglifyJsPlugin', done => {
      fs.readFile(bundlePathEN, 'utf-8', (err, content) => {
        if (err) {
          return done(err)
        }

        expect(content).to.not.contain('// webpackBootstrap')
        done()
      })
    })
  })

  describe('Plugin combining and [name], [contenthash]', () => {
    let bundlePath
    let bundlePathFR
    let bundlePathEN
    const assetsPath = path.join(__dirname, 'dist-name-hash/name-hash-assets.json')

    before((done) => {
      const altConfig = {
        ...config,
        entry: {
          app: [path.join(__dirname, 'webpack/complex.js')],
        },
        output: {
          path: path.resolve(__dirname, 'dist-name-hash'),
          filename: '[name]-[hash].js',
          publicPath: '/static/',
        },
        module: {
          loaders: [
            ...config.module.loaders,
            {
              test: /\.css$/,
              loader: ExtractTextPlugin.extract('style-loader', 'css'),
            }
          ]
        },
        plugins: [
          new webpack.DefinePlugin({
            __LOCALE__: `'fr'`,
          }),
          new WebpackMultiOutputPlugin({
            filename: '[name]-[contenthash]-[value].js',
            values: ['fr', 'en'],
            assets: {
              filename: 'name-hash-assets.json',
              path: path.join(__dirname, 'dist-name-hash'),
              prettyPrint: true,
            },
            debug: true,
          }),
          new ExtractTextPlugin('[name]-[contenthash].css'),
          new webpack.optimize.UglifyJsPlugin({
            output: {
              comments: false
            },
            compressor: {
              warnings: false
            }
          }),
        ],
      }

      webpack(altConfig, (err, stats) => {
        if (err) {
          return done(err)
        }

        if (stats.hasErrors()) {
          return done(new Error(stats.toString()))
        }

        bundlePath = path.join(__dirname, `dist-name-hash/app-${stats.hash}.js`)
        const assets = stats.compilation.assets

        const frName = Object.keys(assets).find(a => {
          const chunks = a.split('-')
          return chunks[0] === 'app' && chunks[chunks.length - 1] === 'fr.js'
        })
        bundlePathFR = path.join(__dirname, `dist-name-hash/${frName}`)

        const enName = Object.keys(assets).find(a => {
          const chunks = a.split('-')
          return chunks[0] === 'app' && chunks[chunks.length - 1] === 'en.js'
        })
        bundlePathEN = path.join(__dirname, `dist-name-hash/${enName}`)

        done()
      })
    })

    it('should produce a bundle for each value', () => {
      const bundleExists = fs.existsSync(bundlePath)
      const bundleExistsFR = fs.existsSync(bundlePathFR)
      const bundleExistsEN = fs.existsSync(bundlePathEN)

      expect(bundleExists).to.be.true
      expect(bundleExistsFR).to.be.true
      expect(bundleExistsEN).to.be.true
    })

    it('should produce an asset file with all assets per language', () => {
      const assetsExists = fs.existsSync(assetsPath)
      const assets = require(assetsPath)

      expect(assetsExists).to.be.true
      expect(assets).to.have.all.keys(['fr', 'en'])
      expect(assets.fr).to.have.all.keys(['app'])
      expect(assets.fr.app).to.have.all.keys(['js', 'css'])
    })

    it('should include the appropriate content for value FR', done => {
      fs.readFile(bundlePathFR, 'utf-8', (err, content) => {
        if (err) {
          return done(err)
        }

        expect(content).to.contain('Ceci est un test')
        done()
      })
    })

    it('should include the appropriate content for value EN', done => {
      fs.readFile(bundlePathEN, 'utf-8', (err, content) => {
        if (err) {
          return done(err)
        }

        expect(content).to.contain('This is a test translated')
        done()
      })
    })

    it('should have minified the assets with UglifyJsPlugin', done => {
      fs.readFile(bundlePathEN, 'utf-8', (err, content) => {
        if (err) {
          return done(err)
        }

        expect(content).to.not.contain('// webpackBootstrap')
        done()
      })
    })
  })

  describe('Multiple asset files', () => {
    const bundlePath = path.join(__dirname, 'dist-assets-option/bundle.js')
    const bundlePathFR = path.join(__dirname, 'dist-assets-option/bundle-fr.js')
    const bundlePathEN = path.join(__dirname, 'dist-assets-option/bundle-en.js')

    const assetsPathFR = path.join(__dirname, 'dist-assets-option/assets-fr.json')
    const assetsPathEN = path.join(__dirname, 'dist-assets-option/assets-en.json')

    before((done) => {
      const altConfig = {
        ...config,
        output: {
          path: path.resolve(__dirname, 'dist-assets-option'),
          filename: 'bundle.js',
          publicPath: '/static/',
        },
        plugins: [
          new WebpackMultiOutputPlugin({
            filename: 'bundle-[value].js',
            values: ['fr', 'en'],
            assets: {
              filename: 'assets-[value].json',
              path: path.join(__dirname, 'dist-assets-option'),
              prettyPrint: true,
            },
            debug: true,
          }),
        ]
      }

      webpack(altConfig, (err, stats) => {
        if (err) {
          return done(err)
        }

        if (stats.hasErrors()) {
          return done(new Error(stats.toString()))
        }

        done()
      })
    })

    it('should produce a bundle for each value', () => {
      const bundleExists = fs.existsSync(bundlePath)
      const bundleExistsFR = fs.existsSync(bundlePathFR)
      const bundleExistsEN = fs.existsSync(bundlePathEN)

      expect(bundleExists).to.be.true
      expect(bundleExistsFR).to.be.true
      expect(bundleExistsEN).to.be.true
    })

    it('should create an asset file for each value', () => {
      const assetsExistsFR = fs.existsSync(assetsPathFR)
      const assetsExistsEN = fs.existsSync(assetsPathEN)

      expect(assetsExistsFR).to.be.true
      expect(assetsExistsEN).to.be.true
    })
  })
})
