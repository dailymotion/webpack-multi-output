var translations = require(`./i18n/${__LOCALE__}.i18n`)
var other = require('./other')

// Dumb code but it's just for tests
export default function() {
  const foo = 1 + 1

  return translations.locale_data.messages['This is a test'][1]
}
