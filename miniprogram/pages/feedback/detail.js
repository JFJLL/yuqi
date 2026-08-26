const api = require('../../services/api')

Page({
  data: {
    id: '',
    detail: null,
    submitting: false,
    isManager: false
  },

  onLoad(options) {
    this.setData({ id: options.id || '', isManager: api.getCurrentUser().role === '店长' })
    this.loadDetail()
  },

  async loadDetail() {
    try {
      const detail = await api.getFeedbackDetail(this.data.id)
      if (!detail) throw new Error('未找到该巡检问题')
      this.setData({ detail })
    } catch (error) {
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },

  openAppeal() {
    wx.navigateTo({ url: `/pages/appeal/create?feedbackId=${this.data.id}` })
  },

  remindStaff() {
    wx.showToast({ title: '已提醒店员处理', icon: 'success' })
  },

  markLearned() {
    wx.showModal({
      title: this.data.isManager ? '确认整改结果' : '确认完成整改',
      content: this.data.isManager ? '确认该店员已完成沟通复盘并落实整改要求？' : '确认已理解问题原因并按建议调整销售表达？',
      confirmText: this.data.isManager ? '确认通过' : '确认完成',
      confirmColor: '#126b59',
      success: async (result) => {
        if (!result.confirm) return
        this.setData({ submitting: true })
        await api.markFeedbackLearned(this.data.id)
        await this.loadDetail()
        this.setData({ submitting: false })
        wx.showToast({ title: '已完成整改', icon: 'success' })
      }
    })
  }
})
