var translations = require(`./i18n/en.i18n`).default

export default class App {
  render() {
    require.ensure([], (require) => {
      const Component = require('./../component').default
      const content = new Component()

      document.querySelector('#root').innerHTML = `
        <div>
          <h1>${translations.locale_data.messages['This is a test'][1]}</h1>
          ${content.render()}
        </div>
      `
    })
  }
}

const app = new App()
app.render()
