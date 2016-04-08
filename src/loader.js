module.exports = function() {
  this.cacheable && this.cacheable()
  this._compilation.__webpackMultiOutput.addAssets()

  return `/* [WebpackMultiOutput] ${this.resourcePath} [WebpackMultiOutput] */`
}
