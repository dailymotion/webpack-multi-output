/* @flow */

import fs from 'fs'
import path from 'path'
import clone from 'lodash.clone'
import {ConcatSource} from 'webpack-sources'

const re = /\[WebpackMultiOutput\]/

export default function WebpackMultiOutput(options: Object = {}): void {
  this.options = {
    values: options.values ? options.values : [],
    keepOriginal: options.keepOriginal ? true : false,
  }
}

export function getFilePath(string: string): string {
  const filePathRe = /\[WebpackMultiOutput\] (.*?) \[WebpackMultiOutput\]/
  const match = string.match(filePathRe)

  return match ? match[1] : ''
}

WebpackMultiOutput.prototype.apply = function(compiler: Object): void {
  compiler.plugin('compilation', (compilation: Object): void => {
    if (!this.options.values.length) {
      compilation.errors.push(new Error(`[webpack-multi-output] Error: option "values" must be an array of length >= 1`))
    }

    compilation.plugin('optimize-chunk-assets', (chunks: Array<Object>, callback: Function): void => {
      const outputName = compilation.options.output.filename
      const baseAsset = compilation.assets[outputName]
      const langAsset = clone(baseAsset)

      // add asset for each value
      this.options.values.forEach((value: string): void => {
        const ext = path.extname(outputName)
        const filename = outputName.replace(ext, '')
        const langAssetName = `${filename}_${value}${ext}`
        console.log(`[WebpackMultiOutput] Adding asset ${langAssetName}`)
        compilation.assets[langAssetName] = langAsset
      })

      if (!this.options.keepOriginal) {
        delete compilation.assets[outputName]
      }

      chunks.forEach(chunk => {
        Object.keys(compilation.assets).forEach(asset => {
          if (chunk.files.indexOf(asset) === -1) {
            chunk.files.push(asset)
          }
        })

        chunk.files.forEach(file => {
          const _source = new ConcatSource(compilation.assets[file])
          const _value = path.basename(file).replace(path.extname(file), '').split('_')[1]

          if (_value) {
            let lines = _source.source().split('\n')

            lines = lines.map(line => {
              return this.replaceContent(line, _value)
            })

            compilation.assets[file] = new ConcatSource(lines.join('\n'))
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
