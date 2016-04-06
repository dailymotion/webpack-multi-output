module.exports = function(source) {
  this.cacheable && this.cacheable()

  return `/* [WebpackMultiOutput] ${this.resourcePath} */`
}
