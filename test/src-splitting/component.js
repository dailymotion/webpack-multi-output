var translations = require(`./i18n/en-component.i18n`).default

export default class Component {
  render() {
    return `
      <p>${translations.locale_data.messages['one'][1]}</p>
      <p>${translations.locale_data.messages['two'][1]}</p>
    `
  }
}
