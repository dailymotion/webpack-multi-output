var translations = require(`./i18n/en.i18n`).default

export default class App {
  time = false

  render() {
    require.ensure([], require => {
      const Component = require('./../component').default
      const content = new Component()

      document.querySelector('#root').innerHTML = `
        <div class="row">
          <div class="col-lg-12">
            <h1 class="title">${translations.locale_data.messages['This is a test'][1]}</h1>
            <button class="btn btn-primary time">Show me the time</button>
            <h2>${this.time ? this.time : ''}</h2>
            ${content.render()}
          </div>
        </div>
      `

      this.didMount()
    })
  }

  didMount() {
    document.querySelector('.time').addEventListener('click', () => {
      this.showTime()
    }, false)
  }

  showTime() {
    require.ensure([], require => {
      const moment = require('moment')
      this.time = moment.utc().toString()
      this.render()
    })
  }
}

const app = new App()
app.render()
