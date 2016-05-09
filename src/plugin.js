/* @flow */

import fs from 'fs'
import path from 'path'
import {createHash} from 'crypto'
import mkdirp from 'mkdirp'
import clone from 'lodash.clone'
import merge from 'lodash.merge'
import {ConcatSource} from 'webpack-sources'
import {forEachOfLimit, setImmediate as asyncSetImmediate} from 'async'

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

  this.addedAssets = []
  this.assetsMap = {}
  this.chunksMap = {}
  this.chunkName = ''
  this.chunkHash = ''
  this.filePathRe = /WebpackMultiOutput-(.*?)-WebpackMultiOutput/
  this.filePathReG = /WebpackMultiOutput-(.*?)-WebpackMultiOutput/g
}

WebpackMultiOutput.prototype.apply = function(compiler: Object): void {
  compiler.plugin('compilation', (compilation: Object): void => {
    compilation.__webpackMultiOutput = true

    if (path.extname(compilation.outputOptions.filename) === '.js' && !this.needsHash) {
      this.needsHash = /\[hash\]/.test(compilation.outputOptions.filename)
    }

    if (!this.options.values.length) {
      compilation.errors.push(new Error(`[webpack-multi-output] Error: option "values" must be an array of length >= 1`))
    }

    compilation.plugin('optimize-chunk-assets', (chunks: Array<Object>, callback: Function): void => {
      forEachOfLimit(chunks, 5, (chunk: Object, y: number, chunkCallback: Function) => {
        forEachOfLimit(chunk.files, 5, (file: string, k: number, fileCallback: Function) => {
          if (path.extname(file) !== '.js') {
            return asyncSetImmediate(fileCallback)
          }

          const source: Object = compilation.assets[file]

          if (!this.filePathReG.test(source.source())) {
            this.log(`Ignoring asset ${file}, no replacement to process`, 'ultra')
            return asyncSetImmediate(fileCallback)
          }

          let _v = 0

          this.options.values.forEach(value => {
            const basename = path.basename(file, '.js')
            const filename = `${value}.${basename}.js`

            this.processSource(value, clone(source), (result) => {
              this.log(`Add asset ${filename}`)
              compilation.assets[filename] = result
              this.chunksMap[chunk.id] = true
              this.addedAssets.push({value, filename, name: chunk.name})
              if (chunk.name) {
                if (this.needsHash) {
                  this.chunkHash = compilation.getStats().hash
                }
                this.chunkName = chunk.name
                this.addToAssetsMap(value, chunk.name, `${compilation.outputOptions.publicPath}${filename}`)
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

    compilation.plugin('optimize-assets', (assets: Object, callback: Function): void => {
      const length = this.chunkHash.length

      forEachOfLimit(this.addedAssets, 5, ({value, filename, name}, index, assetCallback) => {
        const source = this.replaceChunkMap(compilation.assets[filename])

        if (!this.needsHash) {
          compilation.assets[filename] = source
          return asyncSetImmediate(assetCallback)
        }

        const fileHash = createHash('md5').update(source.source()).digest('hex').substr(0, length)
        const newFilename = filename.replace(this.chunkHash, fileHash)

        this.log(`Update hash in filename for ${filename} -> ${newFilename}`, 'ultra')

        if (filename !== newFilename) {
          compilation.assets[newFilename] = source
          delete compilation.assets[filename]
          this.addToAssetsMap(value, name, `${compilation.outputOptions.publicPath}${newFilename}`)
        }

        assetCallback()
      }, callback)
    })

    compilation.mainTemplate.plugin('jsonp-script', (_: string): string => {
      const source = _.split('\n')

      const chunkIdModifier = `var webpackMultiOutputGetChunkId = function(chunkId) {
        var map = {__WEBPACK_MULTI_OUTPUT_CHUNK_MAP__:2};
        return map[chunkId] ? '__WEBPACK_MULTI_OUTPUT_VALUE__.' + chunkId : chunkId;
      };
      `

      source[source.length - 1] = source[source.length - 1].replace('chunkId', 'webpackMultiOutputGetChunkId(chunkId)')
      source.splice(source.length - 1, 0, chunkIdModifier)

      return source.join('\n')
    })
  })

  compiler.plugin('after-emit', (compilation: Object, callback: Function): void => {
    if (!this.options.assets) {
      return callback()
    }

    mkdirp.sync(this.options.assets.path)

    Object.keys(compilation.assets).forEach((assetName: string): void => {
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

    _source = _source.replace(/__WEBPACK_MULTI_OUTPUT_VALUE__/g, value)

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

WebpackMultiOutput.prototype.replaceChunkMap = function(source: Object): string {
  this.log(`Replacing chunk map ${JSON.stringify(this.chunksMap)}`, 'ultra')
  return new ConcatSource(source.source().replace(/\{__WEBPACK_MULTI_OUTPUT_CHUNK_MAP__:2\}/, JSON.stringify(this.chunksMap)))
}

WebpackMultiOutput.prototype.addToAssetsMap = function(value: string, name: string, filePath: string): void {
  this.assetsMap[value] = {
    [name]: {
      js: filePath,
    },
  }
}

WebpackMultiOutput.prototype.log = function(message: string, level: string = 'debug'): void {
  if (level === 'ultra') {
    return this.options.ultraDebug && console.log(`[WebpackMultiOutput] ${+new Date} - ${message}`)
  }

  this.options.debug && console.log(`[WebpackMultiOutput] ${message}`)
}
