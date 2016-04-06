import fs from 'fs'
import path from 'path'
import {expect} from 'chai'
import webpack from 'webpack'
import WebpackMultiOutputPlugin, {getFilePath} from '../src/plugin'
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
    new webpack.DefinePlugin({
      __LOCALE__: `'fr'`,
    }),
    new WebpackMultiOutputPlugin({
      values: ['fr', 'en']
    }),
  ],
}

describe('Webpack Multi Output', () => {
  it('should export a plugin', () => {
    expect(WebpackMultiOutputPlugin).to.be.a('function')
  })

  it('should export a loader', () => {
    expect(WebpackMultiOutputLoader).to.be.a('function')
  })

  describe('Regex', () => {
    it('should export a function', () => {
      expect(getFilePath).to.be.a('function')
    })

    it('should return the filename', () => {
      expect(getFilePath('/* [WebpackMultiOutput] /path/to/file.js [WebpackMultiOutput] */')).to.equal('/path/to/file.js')
    })
  })

  describe('Webpack plugin', () => {
    const bundlePath = path.join(__dirname, 'dist/bundle.js')
    const bundlePathFR = path.join(__dirname, 'dist/bundle_fr.js')
    const bundlePathEN = path.join(__dirname, 'dist/bundle_en.js')

    before((done) => {
      webpack(config, () => {
        done()
      })
    })

    it('should produce a bundle', () => {
      const bundleExists = fs.existsSync(bundlePath)
      const bundleExistsFR = fs.existsSync(bundlePathFR)
      const bundleExistsEN = fs.existsSync(bundlePathEN)

      expect(bundleExists).to.be.false
      expect(bundleExistsFR).to.be.true
      expect(bundleExistsEN).to.be.true
    })

    it('should include the appropriate content', done => {
      fs.readFile(bundlePathFR, 'utf-8', (err, content) => {
        expect(content).to.contain('Ceci est un test')
        done()
      })
    })

    it('should include the appropriate content', done => {
      fs.readFile(bundlePathEN, 'utf-8', (err, content) => {
        expect(content).to.contain('This is a test translated')
        done()
      })
    })
  })

  describe('keepOriginal', () => {
    const bundlePath = path.join(__dirname, 'dist-alt/bundle.js')
    const bundlePathFR = path.join(__dirname, 'dist-alt/bundle_fr.js')
    const bundlePathEN = path.join(__dirname, 'dist-alt/bundle_en.js')

    before((done) => {
      const altConfig = {
        ...config,
        output: {
          path: path.resolve(__dirname, 'dist-alt'),
          filename: 'bundle.js',
        },
        plugins: [
          new webpack.DefinePlugin({
            __LOCALE__: `'fr'`,
          }),
          new WebpackMultiOutputPlugin({
            values: ['fr', 'en'],
            keepOriginal: true,
          }),
        ],
      }

      webpack(altConfig, () => {
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
  })
})
