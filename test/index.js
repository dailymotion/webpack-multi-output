import fs from 'fs'
import path from 'path'
import {expect} from 'chai'
import webpack from 'webpack'
import WebpackMultiOutputPlugin from '../src/plugin'
import WebpackMultiOutputLoader from '../src/loader'

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
    new WebpackMultiOutputPlugin({
      values: ['fr', 'en']
    }),
    new webpack.DefinePlugin({
      __LOCALE__: `'fr'`,
    })
  ],
}

const bundlePath = path.join(__dirname, 'dist/bundle.js')
const bundlePathFR = path.join(__dirname, 'dist/bundle_fr.js')
const bundlePathEN = path.join(__dirname, 'dist/bundle_en.js')

describe('Webpack Multi Output', () => {
  it('should export a plugin', () => {
    expect(WebpackMultiOutputPlugin).to.be.a('function')
  })

  it('should export a loader', () => {
    expect(WebpackMultiOutputLoader).to.be.a('function')
  })

  describe('Webpack plugin', () => {
    before((done) => {
      webpack(config, () => {
        done()
      })
    })

    it('should produce a bundle', () => {
      const bundleExists = fs.existsSync(bundlePath)
      const bundleExistsFR = fs.existsSync(bundlePathFR)
      const bundleExistsEN = fs.existsSync(bundlePathEN)

      expect(bundleExists).to.be.true
      expect(bundleExistsFR).to.be.true
      expect(bundleExistsEN).to.be.true
    })

    it('should include the appropriate content', done => {
      const contentFR = fs.readFile(bundlePathFR, 'utf-8', (err, content) => {
        expect(content).to.contain('Ceci est un test')
        done()
      })
    })

    it('should include the appropriate content', done => {
      const contentFR = fs.readFile(bundlePathEN, 'utf-8', (err, content) => {
        expect(content).to.contain('This is a test translated')
        done()
      })
    })
  })
})
