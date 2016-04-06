/* @flow */

import fs from 'fs'
import path from 'path'
import merge from 'lodash.merge'

const re = /\[WebpackMultiOutput\]/

export default function WebpackMultiOutput(options: Object = {}): void {
  this.options = {
    values: options.values ? options.values : [],
  }
}

WebpackMultiOutput.prototype.apply = function(compiler: Object): void {
  compiler.plugin('compilation', compilation => {
    if (!this.options.values.length) {
      compilation.errors.push(new Error(`[webpack-multi-output] Error: option "values" must be an array of length >= 1`))
    }
  })

  compiler.plugin('emit', (compilation, callback) => {
    const outputName = compilation.options.output.filename

    const baseAsset = compilation.assets[outputName]

    // add asset for each value
    this.options.values.forEach(value => {
      const ext = path.extname(outputName)
      const filename = outputName.replace(ext, '')
      const langAssetName = `${filename}_${value}${ext}`
      const langAsset = merge({}, baseAsset)
      console.log(`[WebpackMultiOutput] Adding asset ${langAssetName}`)
      compilation.assets[langAssetName] = langAsset
    })

    let _assetIndex = -1

    for (let assetName in compilation.assets) {
      const asset = compilation.assets[assetName]
      for (let children in asset._source.children) {
        if (typeof asset._source.children[children].children !== 'undefined') {
          const chunks = asset._source.children[children].children
          chunks[chunks.length - 2].children.forEach((chunk, chunkIndex) => {
            if (typeof chunk === 'object') {
              if (chunk.children) {
                chunk.children.forEach((source, sourceIndex) => {
                  if (typeof source === 'object') {
                    const _value = source._source._source._source._value
                    const {result, newIndex} = this.replaceContent(_value, _assetIndex)
                    _assetIndex = newIndex

                    if (result !== _value) {
                      console.log(source)
                    }

                    // ;_;
                    compilation.assets[assetName]._source.children[children].children[chunks.length - 2].children[chunkIndex].children[sourceIndex]._source._source._source._value = result
                  }
                })
              }
            }
          })
        }
      }
    }

    callback()
  })
}

WebpackMultiOutput.prototype.replaceContent = function(source: string, index: number): Object {
  if (!re.test(source) || index < 0) {
    return {
      result: source,
      newIndex: index < 0 ? 0 : index,
    }
  }

  const resourcePath = source.replace('/* [WebpackMultiOutput]', '').replace('*/', '').replace(/\s/gi, '')
  const basename = path.basename(resourcePath)
  const ext = path.extname(basename)
  const language = basename.replace(ext, '')

  const newResourcePath = path.join(resourcePath.replace(basename, ''), `${this.options.values[index]}${ext}`)

  const result = `module.exports = ${fs.readFileSync(newResourcePath, 'utf-8')};`

  console.log('CHANGE')

  return {
    result,
    newIndex: index++,
  }
}
