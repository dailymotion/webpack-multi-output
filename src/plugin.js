/* @flow */

import fs from 'fs'
import path from 'path'
import clone from 'lodash.clone'
import {ConcatSource, RawSource, OriginalSource} from 'webpack-sources'

const re = /\[WebpackMultiOutput\]/

export default function WebpackMultiOutput(options: Object = {}): void {
  this.options = {
    filename: options.filename ? options.filename : 'bundle-[value].js',
    values: options.values ? options.values : [],
  }

  this.assets = []
  this.mainBundleName = false
}

export function getFilePath(string: string): string {
  const filePathRe = /\[WebpackMultiOutput\] (.*?) \[WebpackMultiOutput\]/
  const match = string.match(filePathRe)

  return match ? match[1] : ''
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
            compilation.assets[filename] = new ConcatSource(
              new RawSource('/* [WebpackMultiOutput] */'),
              new OriginalSource('/* [WebpackMultiOutput] */', 'webpack-multi-output.js')
            )
          })
        }
      }
    }

    if (!this.options.values.length) {
      compilation.errors.push(new Error(`[webpack-multi-output] Error: option "values" must be an array of length >= 1`))
    }

    compilation.plugin('optimize-chunk-assets', (chunks: Array<Object>, callback: Function): void => {
      const langAsset = clone(compilation.assets[this.mainBundleName])

      // prevent errors in children compilations
      if (typeof langAsset === 'undefined') {
        return callback()
      }

      this.assets.forEach(asset => {
        compilation.assets[asset] = langAsset
      })

      chunks.forEach(chunk => {
        if (chunk.files.indexOf(this.mainBundleName) !== -1) {
          Object.keys(compilation.assets).forEach(asset => {
            if (chunk.files.indexOf(asset) === -1) {
              console.log(`[WebpackMultiOutput] Add asset ${asset}`)
              chunk.files.push(asset)
            }
          })
        }

        chunk.files.forEach(file => {
          if (this.assets.indexOf(file) !== -1) {
            const _source = new ConcatSource(compilation.assets[file])
            const _value = path.basename(file).replace(path.extname(file), '').split('-')[1]

            if (_value) {
              let lines = _source.source().split('\n')

              lines = lines.map(line => {
                return this.replaceContent(line, _value)
              })

              compilation.assets[file] = new ConcatSource(
                new RawSource(lines.join('\n')),
                new OriginalSource(lines.join('\n'), 'webpack-multi-output.js')
              )
            }
          }
        })
      })

      callback()
    })
  })
}

WebpackMultiOutput.prototype.replaceContent = function(source: string, value: string): string {
  if (!re.test(source)) {
    return source
  }

  const resourcePath = getFilePath(source)
  const basename = path.basename(resourcePath)
  const ext = path.extname(basename)
  const language = basename.replace(ext, '')

  let newResourcePath = path.join(resourcePath.replace(basename, ''), `${value}${ext}`)

  if (!fs.existsSync(newResourcePath)) {
    newResourcePath = resourcePath
  }

  return `module.exports = ${fs.readFileSync(newResourcePath, 'utf-8')};`
}
