const api = require('../../services/api')

Page({
  data: {
    filters: ['全部', '待处理', '高风险', '已完成'],
    activeFilter: '全部',
    feedbacks: [],
    loading: true,
    isManager: false,
    storeName: ''
  },

  onShow() {
    const user = api.getCurrentUser()
    const isManager = user.role === '店长'
    this.setData({ isManager, storeName: user.storeName })
    wx.setNavigationBarTitle({ title: isManager ? '门店问题' : '巡检反馈' })
    this.loadFeedbacks()
  },

  onPullDownRefresh() {
    this.loadFeedbacks().finally(() => wx.stopPullDownRefresh())
  },

  async loadFeedbacks() {
    try {
      const feedbacks = await api.getFeedbacks(this.data.activeFilter)
      this.setData({ feedbacks, loading: false })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },

  changeFilter(event) {
    this.setData({ activeFilter: event.currentTarget.dataset.value, loading: true })
    this.loadFeedbacks()
  },

  openDetail(event) {
    wx.navigateTo({ url: `/pages/feedback/detail?id=${event.currentTarget.dataset.id}` })
  }
})
