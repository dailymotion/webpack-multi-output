module.exports = function() {
  this.cacheable && this.cacheable()

  return `/* [WebpackMultiOutput] ${this.resourcePath} [WebpackMultiOutput] */`
}
