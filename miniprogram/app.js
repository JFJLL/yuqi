const api = require('./services/api')
const config = require('./config')

App({
  globalData: {
    currentUser: null,
    useMock: config.useMock
  },

  onLaunch() {
    if (config.wiseDiagTransport === 'cloud' && wx.cloud) {
      wx.cloud.init({ traceUser: true })
    }
    this.globalData.currentUser = api.getCurrentUser()
  }
})
