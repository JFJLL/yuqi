const api = require('../../services/api')

Page({
  data: {
    feedbackId: '',
    feedback: null,
    reason: '',
    requestRecording: true,
    attachments: [],
    submitting: false
  },

  onLoad(options) {
    this.setData({ feedbackId: options.feedbackId || '' })
    this.loadFeedback()
  },

  async loadFeedback() {
    const feedback = await api.getFeedbackDetail(this.data.feedbackId)
    this.setData({ feedback })
  },

  onReasonInput(event) {
    this.setData({ reason: event.detail.value })
  },

  onRecordingChange(event) {
    this.setData({ requestRecording: event.detail.value })
  },

  chooseEvidence() {
    wx.chooseMedia({
      count: 3 - this.data.attachments.length,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (result) => {
        const additions = result.tempFiles.map((item) => item.tempFilePath)
        this.setData({ attachments: this.data.attachments.concat(additions).slice(0, 3) })
      }
    })
  },

  removeAttachment(event) {
    const index = Number(event.currentTarget.dataset.index)
    const attachments = this.data.attachments.filter((item, itemIndex) => itemIndex !== index)
    this.setData({ attachments })
  },

  async submit() {
    const reason = this.data.reason.trim()
    if (reason.length < 10) {
      wx.showToast({ title: '请至少填写 10 个字的申诉说明', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    try {
      await api.submitAppeal({
        feedbackId: this.data.feedbackId,
        reason,
        requestRecording: this.data.requestRecording,
        attachments: this.data.attachments
      })
      wx.showModal({
        title: '申诉已提交',
        content: '店长复核后会通过消息通知你。申请的沟通片段仅用于本次复核。',
        showCancel: false,
        confirmText: '知道了',
        confirmColor: '#126b59',
        success: () => wx.navigateBack({ delta: 2 })
      })
    } catch (error) {
      wx.showToast({ title: error.message || '提交失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
