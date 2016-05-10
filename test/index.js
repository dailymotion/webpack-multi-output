import fs from 'fs'
import path from 'path'
import {expect} from 'chai'
import webpack from 'webpack'
import ExtractTextPlugin from 'extract-text-webpack-plugin'
import {sync as pathExists} from 'path-exists'

import WebpackMultiOutputPlugin from '../src/plugin'
import WebpackMultiOutputLoader from '../src/loader'
const compiledLoader = require('../')
const compiledPlugin = require('../plugin')

const config = {
  entry: path.join(__dirname, 'src/index.js'),
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
      expect(instance.getFilePath('module.exports = "WebpackMultiOutput-/path/to/file.js-WebpackMultiOutput";')).to.equal('/path/to/file.js')
    })
  })

  describe('Webpack plugin', () => {
    const bundlePath = path.join(__dirname, 'dist/bundle.js')
    const bundlePathFR = path.join(__dirname, 'dist/fr.bundle.js')
    const bundlePathEN = path.join(__dirname, 'dist/en.bundle.js')

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
      const bundleExists = pathExists(bundlePath)
      const bundleExistsFR = pathExists(bundlePathFR)
      const bundleExistsEN = pathExists(bundlePathEN)

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
    const bundlePathFR = path.join(__dirname, 'dist-combine-plugins/fr.bundle.js')
    const bundlePathEN = path.join(__dirname, 'dist-combine-plugins/en.bundle.js')

    before(function(done) {
      this.timeout(4000)
      const altConfig = {
        ...config,
        context: path.join(__dirname, '..'),
        entry: path.join(__dirname, 'src/complex.js'),
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
          new webpack.optimize.OccurenceOrderPlugin(true),
          new webpack.optimize.UglifyJsPlugin({
            output: {
              comments: false
            },
            compressor: {
              warnings: false
            }
          }),
          new WebpackMultiOutputPlugin({
            values: ['fr', 'en'],
            debug: true,
            uglify: true,
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
      const bundleExists = pathExists(bundlePath)
      const cssBundlePathExists = pathExists(cssBundlePath)
      const bundleExistsFR = pathExists(bundlePathFR)
      const bundleExistsEN = pathExists(bundlePathEN)

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

  describe('Plugin combining and [name] and [hash]', () => {
    let bundlePath
    let bundlePathFR
    let bundlePathEN
    let bundlePathName
    let bundleCSSPathName
    const assetsPath = path.join(__dirname, 'dist-name-hash/name-hash-assets.json')

    before((done) => {
      const altConfig = {
        ...config,
        entry: {
          app: [path.join(__dirname, 'src/complex.js')],
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
          new ExtractTextPlugin('[name]-[contenthash].css'),
          new webpack.optimize.UglifyJsPlugin({
            output: {
              comments: false
            },
            compressor: {
              warnings: false
            }
          }),
          new WebpackMultiOutputPlugin({
            values: ['fr', 'en'],
            assets: {
              filename: 'name-hash-assets.json',
              path: path.join(__dirname, 'dist-name-hash'),
              prettyPrint: true,
            },
            uglify: true,
            debug: true,
            ultraDebug: true,
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
          return a.split('.')[0] === 'fr'
        })
        bundlePathFR = path.join(__dirname, `dist-name-hash/${frName}`)

        const enName = Object.keys(assets).find(a => {
          return a.split('.')[0] === 'en'
        })
        bundlePathName = enName
        bundlePathEN = path.join(__dirname, `dist-name-hash/${enName}`)

        bundleCSSPathName = Object.keys(assets).find(a => path.extname(a) === '.css')

        done()
      })
    })

    it('should produce a bundle for each value', () => {
      const bundleExists = pathExists(bundlePath)
      const bundleExistsFR = pathExists(bundlePathFR)
      const bundleExistsEN = pathExists(bundlePathEN)

      expect(bundleExists).to.be.true
      expect(bundleExistsFR).to.be.true
      expect(bundleExistsEN).to.be.true
    })

    it('should produce an asset file with all assets per language', () => {
      const assetsExists = pathExists(assetsPath)
      const assets = require(assetsPath)

      expect(assetsExists).to.be.true
      expect(assets).to.have.all.keys(['fr', 'en'])
      expect(assets.fr).to.have.all.keys(['app'])
      expect(assets.fr.app).to.have.all.keys(['js', 'css'])
    })

    it('should contain the complete path for assets in the asset file', () => {
      const assets = require(assetsPath)

      expect(assets.en.app.js).to.equal(`/static/${bundlePathName}`)
      expect(assets.en.app.css).to.equal(`/static/${bundleCSSPathName}`)
    })

    it('should produce a different hash for all bundles', () => {
      const assets = require(assetsPath)
      const frFilename = assets.fr.app.js.replace('fr.', '')
      const enFilename = assets.en.app.js.replace('en.', '')

      expect(frFilename).to.not.equal(enFilename)
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
    const bundlePathFR = path.join(__dirname, 'dist-assets-option/fr.bundle.js')
    const bundlePathEN = path.join(__dirname, 'dist-assets-option/en.bundle.js')

    const assetsPathFR = path.join(__dirname, 'dist-assets-option/assets/assets-fr.json')
    const assetsPathEN = path.join(__dirname, 'dist-assets-option/assets/assets-en.json')

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
            values: ['fr', 'en'],
            assets: {
              filename: 'assets-[value].json',
              path: path.join(__dirname, 'dist-assets-option/assets'),
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
      const bundleExists = pathExists(bundlePath)
      const bundleExistsFR = pathExists(bundlePathFR)
      const bundleExistsEN = pathExists(bundlePathEN)

      expect(bundleExists).to.be.true
      expect(bundleExistsFR).to.be.true
      expect(bundleExistsEN).to.be.true
    })

    it('should create an asset file for each value', () => {
      const assetsExistsFR = pathExists(assetsPathFR)
      const assetsExistsEN = pathExists(assetsPathEN)

      expect(assetsExistsFR).to.be.true
      expect(assetsExistsEN).to.be.true
    })
  })

  describe('Call stack test', () => {
    const languages = [
      'ar',
      'de',
      'el',
      'en',
      'en_GB',
      'en_US',
      'es',
      'fr',
      'id',
      'it',
      'ja',
      'ko',
      'ms',
      'nl',
      'pl',
      'pt_BR',
      'ro',
      'ru',
      'th',
      'tr',
      'vi',
      'zh',
      'zh_TW',
    ]

    it('should not crash', (done) => {
      const altConfig = {
        ...config,
        output: {
          path: path.resolve(__dirname, 'dist-call-stack'),
          filename: 'bundle.js',
          publicPath: '/static/',
        },
        plugins: [
          new webpack.DefinePlugin({
            __LOCALE__: `'fr'`,
          }),
          new WebpackMultiOutputPlugin({
            values: languages,
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
  })

  describe('Uglify and multiple replace', () => {
    before(done => {
      const altConfig = {
        ...config,
        entry: [path.join(__dirname, './src/multiple.js')],
        output: {
          path: path.resolve(__dirname, 'dist-multiple'),
          filename: 'bundle.js',
          publicPath: '/static/',
        },
        plugins: [
          new webpack.optimize.UglifyJsPlugin({
            output: {
              comments: false
            },
            compressor: {
              warnings: false
            }
          }),
          new WebpackMultiOutputPlugin({
            values: ['fr', 'en'],
            uglify: true,
            debug: true,
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

        done()
      })
    })

    it('should include all content', () => {
      const content = fs.readFileSync(path.join(__dirname, 'dist-multiple/en.bundle.js'), 'utf-8')

      expect(content).to.contain('This is a test translated')
      expect(content).to.contain('This is an anomaly. Disabled. What is true?')
    })
  })

  describe('Code splitting', () => {
    const mainBundlePathFR = path.join(__dirname, 'dist-splitting/fr.bundle.js')
    const mainBundlePathEN = path.join(__dirname, 'dist-splitting/en.bundle.js')
    const secondBundlePathFR = path.join(__dirname, 'dist-splitting/fr.1.bundle.js')
    const secondBundlePathEN = path.join(__dirname, 'dist-splitting/en.1.bundle.js')
    const momentBundlePath = path.join(__dirname, 'dist-splitting/2.bundle.js')
    const momentBundlePathEN = path.join(__dirname, 'dist-splitting/en.2.bundle.js')
    const momentBundlePathFR = path.join(__dirname, 'dist-splitting/fr.2.bundle.js')
    const assetsPath = path.join(__dirname, 'dist-splitting/assets/assets.json')

    before(function(done) {
      this.timeout(20000)
      const altConfig = {
        ...config,
        entry: [path.join(__dirname, 'src-splitting/app/index.js')],
        output: {
          path: path.resolve(__dirname, 'dist-splitting'),
          filename: 'bundle.js',
          publicPath: '/dist-splitting/',
          // chunkFilename: '[id].[chunkhash].bundle.js',
        },
        plugins: [
          new webpack.optimize.UglifyJsPlugin({
            output: {
              comments: false
            },
            compressor: {
              warnings: false
            }
          }),
          new WebpackMultiOutputPlugin({
            values: ['fr', 'en'],
            debug: true,
            ultraDebug: true,
            uglify: true,
            assets: {
              filename: 'assets.json',
              path: path.join(__dirname, 'dist-splitting/assets'),
              prettyPrint: true,
            },
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

        done()
      })
    })

    it('should create all bundles and chunks', () => {
      expect(pathExists(mainBundlePathFR)).to.be.true
      expect(pathExists(mainBundlePathEN)).to.be.true
      expect(pathExists(secondBundlePathFR)).to.be.true
      expect(pathExists(secondBundlePathEN)).to.be.true
    })

    it('should not create useless chunks', () => {
      expect(pathExists(momentBundlePath)).to.be.true
      expect(pathExists(momentBundlePathEN)).to.be.false
      expect(pathExists(momentBundlePathFR)).to.be.false
    })

    it('should contain the correct text', () => {
      expect(fs.readFileSync(mainBundlePathFR, 'utf-8')).to.contain('Ceci est un test')
      expect(fs.readFileSync(mainBundlePathEN, 'utf-8')).to.contain('This is a test translated')
      expect(fs.readFileSync(secondBundlePathFR, 'utf-8')).to.contain('I see through the eyes of the blind')
      expect(fs.readFileSync(secondBundlePathEN, 'utf-8')).to.contain('This is an anomaly. Disabled')
    })

    it('should create an asset file with the main bundles', () => {
      const assets = require(assetsPath)
      const expected = {
        en: {
          main: {
            js: '/dist-splitting/en.bundle.js',
          }
        },
        fr: {
          main: {
            js: '/dist-splitting/fr.bundle.js',
          }
        }
      }

      expect(assets).to.eql(expected)
    })
  })
})
