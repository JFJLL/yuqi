const api = require('../../services/api')

Page({
  data: {
    profile: null
  },

  onShow() {
    this.loadProfile()
  },

  async loadProfile() {
    const profile = await api.getProfile()
    profile.avatarText = profile.user.name ? profile.user.name.substring(0, 1) : '员'
    this.setData({ profile })
  },

  goDevice() {
    wx.navigateTo({ url: '/pages/device/index' })
  },

  goFeedback() {
    wx.switchTab({ url: '/pages/feedback/index' })
  },

  openAppeal(event) {
    const id = event.currentTarget.dataset.feedbackId
    if (id) wx.navigateTo({ url: `/pages/feedback/detail?id=${id}` })
  },

  contactManager() {
    const manager = this.data.profile.manager
    wx.showModal({
      title: '联系店长',
      content: manager ? `${this.data.profile.user.storeName}店长：${manager.name}\n电话：${manager.mobile}` : '暂未配置门店店长，请联系企业管理员。',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#126b59'
    })
  },

  rebindProfile() {
    wx.showModal({
      title: '重新关联员工档案',
      content: '重新关联后需要再次填写姓名并选择所属门店。',
      confirmText: '重新关联',
      confirmColor: '#126b59',
      success: async (result) => {
        if (!result.confirm) return
        await api.resetProfileLink()
        getApp().globalData.currentUser = api.getCurrentUser()
        wx.reLaunch({ url: '/pages/auth/profile-setup' })
      }
    })
  }
})
