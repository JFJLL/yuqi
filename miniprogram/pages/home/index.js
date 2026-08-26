const api = require('../../services/api')

Page({
  data: {
    loading: true,
    dashboard: null
  },

  onShow() {
    this.loadDashboard()
  },

  onPullDownRefresh() {
    this.loadDashboard().finally(() => wx.stopPullDownRefresh())
  },

  async loadDashboard() {
    try {
      const dashboard = await api.getDashboard()
      this.setData({ dashboard, loading: false })
      wx.setNavigationBarTitle({ title: dashboard.isManager ? '门店总览' : '今日巡检' })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },

  goFeedback() {
    wx.switchTab({ url: '/pages/feedback/index' })
  },

  goRecommend() {
    wx.switchTab({ url: '/pages/recommend/index' })
  },

  goLearning() {
    wx.switchTab({ url: '/pages/learning/index' })
  },

  goDevice() {
    wx.navigateTo({ url: '/pages/device/index' })
  },

  openLatest() {
    const item = this.data.dashboard && this.data.dashboard.latestFeedback
    if (item) wx.navigateTo({ url: `/pages/feedback/detail?id=${item.id}` })
  }
})
