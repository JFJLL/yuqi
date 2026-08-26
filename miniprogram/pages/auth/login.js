const api = require('../../services/api')

Page({
  data: {
    agreed: false,
    loading: false
  },

  onLoad() {
    if (!api.hasSession()) return
    if (api.hasCompletedProfile()) wx.switchTab({ url: '/pages/home/index' })
    else wx.redirectTo({ url: '/pages/auth/profile-setup' })
  },

  toggleAgreement() {
    this.setData({ agreed: !this.data.agreed })
  },

  showAgreement() {
    wx.showModal({
      title: '用户服务与隐私说明',
      content: '系统仅处理员工身份、所属门店、设备绑定、巡检反馈和申诉所需信息。录音片段仅在申诉复核时按需调取。',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#126b59'
    })
  },

  async phoneLogin(event) {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读并同意服务与隐私说明', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    try {
      const loginResult = await new Promise((resolve, reject) => {
        wx.login({ success: resolve, fail: reject })
      })
      const result = await api.loginWithPhone({
        loginCode: loginResult.code || 'mock-login-code',
        phoneCode: event.detail.code || 'mock-phone-code'
      })
      getApp().globalData.currentUser = result.user
      if (result.requiresProfile) wx.navigateTo({ url: '/pages/auth/profile-setup' })
      else wx.switchTab({ url: '/pages/home/index' })
    } catch (error) {
      wx.showToast({ title: error.message || '登录失败，请重试', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
