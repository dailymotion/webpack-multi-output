/* @flow */

import fs from 'fs'
import path from 'path'
import mkdirp from 'mkdirp'
import clone from 'lodash.clone'
import merge from 'lodash.merge'
import {ConcatSource} from 'webpack-sources'
import {getHashDigest} from 'loader-utils'

const baseAssets = {
  filename: 'assets.json',
  path: '.',
  prettyPrint: false,
}

export default function WebpackMultiOutput(options: Object = {}): void {
  this.options = merge({
    filename: 'bundle-[value].js',
    values: [],
    debug: false,
  }, options)

  this.options.assets = typeof options.assets === 'object' ? merge(baseAssets, options.assets) : false

  this.assets = []
  this.assetsMap = {}
  this.chunkName = ''
  this.mainBundleName = false

  this.re = /\[WebpackMultiOutput\]/
}

WebpackMultiOutput.prototype.apply = function(compiler: Object): void {
  compiler.plugin('compilation', (compilation: Object): void => {
    compilation.__webpackMultiOutput = {
      addAssets: () => {
        if (!this.assets.length) {
          this.mainBundleName = compilation.outputOptions.filename
          this.options.values.forEach(value => {
            const filename = this.options.filename.replace('[value]', value)
            this.assets.push(filename)
            compilation.assets[filename] = new ConcatSource('/* WebpackMultiOutput */')
          })
        }
      }
    }

    if (!this.options.values.length) {
      compilation.errors.push(new Error(`[webpack-multi-output] Error: option "values" must be an array of length >= 1`))
    }

    compilation.plugin('optimize-chunk-assets', (chunks: Array<Object>, callback: Function): void => {
      let langAsset = clone(compilation.assets[this.mainBundleName])

      // fallback if the main bundle has [name]
      if (typeof langAsset === 'undefined') {
        const assets = compilation.assets
        if (Object.keys(assets).length > 1) {
          const jsBundles = Object.keys(assets).filter(asset => {
            return path.extname(asset) === '.js' && this.assets.indexOf(asset) === -1
          })

          this.mainBundleName = jsBundles[jsBundles.length - 1]
          langAsset = clone(assets[this.mainBundleName])
        }
        else {
          // prevent errors in children compilations
          return callback()
        }
      }

      this.assets.forEach(asset => {
        compilation.assets[asset] = langAsset
      })

      chunks.forEach(chunk => {
        this.chunkName = chunk.name
        if (chunk.files.indexOf(this.mainBundleName) !== -1) {
          Object.keys(compilation.assets).forEach(asset => {
            if (chunk.files.indexOf(asset) === -1) {
              this.log(`[WebpackMultiOutput] Add asset ${asset}`)
              chunk.files.push(asset)
            }
          })
        }

        chunk.files.forEach(file => {
          if (this.assets.indexOf(file) !== -1) {
            const _source = new ConcatSource(compilation.assets[file])
            // crap
            const _parts = path.basename(file).replace(path.extname(file), '').split('-')
            const _value = _parts[_parts.length - 1]

            if (_value) {
              let lines = _source.source().split('\n')

              lines = lines.map(line => {
                return this.replaceContent(line, _value)
              })

              const source = new ConcatSource(lines.join('\n'))

              compilation.assets[file] = source
            }
          }
        })
      })

      callback()
    })

    compilation.plugin('optimize-assets', (assets: Object, callback: Function): void => {
      this.assets.forEach((asset: string): void => {
        const source = compilation.assets[asset]
        if (typeof source !== 'undefined') {
          const filename = asset.replace(/\[(?:(\w+):)?contenthash(?::([a-z]+\d*))?(?::(\d+))?\]/ig, () => {
            return getHashDigest(source.source(), arguments[1], arguments[2], parseInt(arguments[3], 10))
          }).replace('[name]', this.chunkName)

          if (filename !== asset) {
            compilation.assets[filename] = source
            delete compilation.assets[asset]
          }

          const ext = path.extname(filename)
          const basename = path.basename(filename, ext)
          const value = basename.split('-')[basename.split('-').length - 1]

          this.assetsMap[value] = {
            [this.chunkName]: {
              js: filename,
            }
          }
        }
      })

      callback()
    })
  })

  compiler.plugin('after-emit', (compilation, callback) => {
    if (this.options.assets) {
      mkdirp.sync(this.options.assets.path)

      Object.keys(compilation.assets).forEach(assetName => {
        const ext = path.extname(assetName)
        if (ext !== '.js') {
          for (let value in this.assetsMap) {
            this.assetsMap[value][this.chunkName][ext.replace('.', '')] = assetName
          }
        }
      })

      if (/\[value\]/.test(this.options.assets.filename)) {
        for (let value in this.assetsMap) {
          const filePath = path.join(this.options.assets.path, this.options.assets.filename.replace('[value]', value))
          const content = this.options.assets.prettyPrint ? JSON.stringify(this.assetsMap[value], null, 2) : JSON.stringify(this.assetsMap[value])

          fs.writeFile(filePath, content, {flag: 'w'}, (err) => {
            if (err) {
              console.error(err)
            }
            this.log(`[WebpackMultiOutput] Asset file ${filePath} written`)
          })
        }
      }
      else {
        const filePath = path.join(this.options.assets.path, this.options.assets.filename)
        const content = this.options.assets.prettyPrint ? JSON.stringify(this.assetsMap, null, 2) : JSON.stringify(this.assetsMap)

        fs.writeFile(filePath, content, {flag: 'w'}, (err) => {
          if (err) {
            console.error(err)
          }
          this.log(`[WebpackMultiOutput] Asset file ${filePath} written`)
        })
      }
    }

    callback()
  })
}

WebpackMultiOutput.prototype.getFilePath = function(string: string): string {
  const filePathRe = /\[WebpackMultiOutput\] (.*?) \[WebpackMultiOutput\]/
  const match = string.match(filePathRe)

  return match ? match[1] : ''
}

WebpackMultiOutput.prototype.replaceContent = function(source: string, value: string): string {
  if (!this.re.test(source)) {
    return source
  }

  const resourcePath = this.getFilePath(source)
  const ext = path.extname(resourcePath)
  const basename = path.basename(resourcePath, ext)

  let newResourcePath = resourcePath.replace(`${basename}${ext}`, `${value}${ext}`)

  if (!fs.existsSync(newResourcePath)) {
    newResourcePath = resourcePath
  }

  return `module.exports = ${fs.readFileSync(newResourcePath, 'utf-8')};`
}

WebpackMultiOutput.prototype.log = function(message: string): void {
  this.options.debug && console.log(message)
}
