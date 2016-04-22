/* @flow */

import fs from 'fs'
import path from 'path'
import mkdirp from 'mkdirp'
import clone from 'lodash.clone'
import merge from 'lodash.merge'
import {ConcatSource} from 'webpack-sources'
import {getHashDigest} from 'loader-utils'
import {forEachOfLimit, mapLimit, setImmediate as asyncSetImmediate} from 'async'

const baseAssets = {
  filename: 'assets.json',
  path: '.',
  prettyPrint: false,
}

export default function WebpackMultiOutput(options: Object = {}): void {
  this.options = merge({
    values: [],
    debug: false,
    ultraDebug: false,
    uglify: false,
  }, options)

  this.options.assets = typeof options.assets === 'object' ? merge(baseAssets, options.assets) : false

  this.assetsMap = {}
  this.chunkName = ''
  this.filePathRe = /WebpackMultiOutput-(.*?)-WebpackMultiOutput/
  this.filePathReG = /WebpackMultiOutput-(.*?)-WebpackMultiOutput/g
}
WebpackMultiOutput.prototype.apply = function(compiler: Object): void {
  compiler.plugin('compilation', (compilation: Object): void => {
    compilation.__webpackMultiOutput = true

    if (!this.options.values.length) {
      compilation.errors.push(new Error(`[webpack-multi-output] Error: option "values" must be an array of length >= 1`))
    }

    compilation.plugin('optimize-chunk-assets', (chunks: Array<Object>, callback: Function): void => {
      forEachOfLimit(chunks, 5, (chunk: Object, y: number, chunkCallback: Function) => {
        forEachOfLimit(chunk.files, 5, (file: string, k: number, fileCallback: Function) => {
          if (path.extname(file) !== '.js') {
            return asyncSetImmediate(fileCallback)
          }

          let _v = 0

          this.options.values.forEach(value => {
            const source = compilation.assets[file]
            const basename = path.basename(file, '.js')
            const filename = `${value}.${basename}.js`

            this.processSource(value, clone(source), (result) => {
              this.log(`Add asset ${filename}`)
              compilation.assets[filename] = result
              if (chunk.name) {
                this.chunkName = chunk.name
                this.assetsMap[value] = {
                  [chunk.name]: {
                    js: `${compilation.outputOptions.publicPath}${filename}`,
                  }
                }
              }

              _v++
              _v === this.options.values.length && fileCallback()
            })
          })
        }, () => {
          chunkCallback()
        })
      }, callback)
    })
  })

  compiler.plugin('after-emit', (compilation, callback) => {
    if (!this.options.assets) {
      return callback()
    }

    mkdirp.sync(this.options.assets.path)

    Object.keys(compilation.assets).forEach(assetName => {
      const ext = path.extname(assetName)
      if (ext !== '.js') {
        for (let value in this.assetsMap) {
          this.assetsMap[value][this.chunkName][ext.replace('.', '')] = `${compilation.outputOptions.publicPath}${assetName}`
        }
      }
    })

    if (/\[value\]/.test(this.options.assets.filename)) {
      for (let value in this.assetsMap) {
        const filePath = path.join(this.options.assets.path, this.options.assets.filename.replace('[value]', value))
        const content = this.options.assets.prettyPrint ? JSON.stringify(this.assetsMap[value], null, 2) : JSON.stringify(this.assetsMap[value])

        fs.writeFileSync(filePath, content, {flag: 'w'})
        this.log(`Asset file ${filePath} written`)
      }
    }
    else {
      const filePath = path.join(this.options.assets.path, this.options.assets.filename)
      const content = this.options.assets.prettyPrint ? JSON.stringify(this.assetsMap, null, 2) : JSON.stringify(this.assetsMap)

      fs.writeFileSync(filePath, content, {flag: 'w'})
      this.log(`Asset file ${filePath} written`)
    }

    callback()
  })
}

WebpackMultiOutput.prototype.getFilePath = function(string: string): string {
  const match = string.match(this.filePathRe)

  return match ? match[1] : ''
}

WebpackMultiOutput.prototype.processSource = function(value: string, source: Object, callback: Function): void {
  let _source = source.source()
  const replaces = []
  const matches = _source.match(this.filePathReG)

  forEachOfLimit(matches, 10, (match: string, k: number, cb: Function): void => {
    this.replaceContent(match, value, (err, result) => {
      replaces.push({source: match, replace: result})
      cb()
    })
  }, () => {
    replaces.forEach(replace => {
      _source = _source.replace(`"${replace.source}"`, replace.replace)
    })
    // Holy shit this feels so wrong.
    // this patches the require.ensure asset paths with the current value
    // so a xx.bundle.js loads a xx.[id].bundle.js
    _source = _source.replace('script.src = __webpack_require__.p', `script.src = __webpack_require__.p + "${value}."`)
    callback(new ConcatSource(_source))
  })
}

WebpackMultiOutput.prototype.replaceContent = function(source: string, value: string, callback: Function): void {
  const resourcePath = this.getFilePath(source)
  const ext = path.extname(resourcePath)
  const basename = path.basename(resourcePath, ext)

  let newResourcePath = resourcePath.replace(`${basename}${ext}`, `${value}${ext}`)

  fs.exists(newResourcePath, (exists) => {
    if (!exists) {
      newResourcePath = resourcePath
    }

    this.log(`Replacing content for ${newResourcePath}`, 'ultra')
    fs.readFile(newResourcePath, 'utf-8', (err, content) => {
      if (err) {
        console.error(err)
        callback(err)
      }

      if (this.options.uglify) {
        content = this.uglify(content)
      }

      callback(null, content)
    })
  })
}

WebpackMultiOutput.prototype.uglify = function(source: string): string {
  return JSON.stringify(JSON.parse(source))
}

WebpackMultiOutput.prototype.log = function(message: string, level: string = 'debug'): void {
  if (level === 'ultra') {
    return this.options.ultraDebug && console.log(`[WebpackMultiOutput] ${+new Date} - ${message}`)
  }

  this.options.debug && console.log(`[WebpackMultiOutput] ${message}`)
}
