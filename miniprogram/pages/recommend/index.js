const api = require('../../services/api')

Page({
  data: {
    modes: ['按病症', '按药品'],
    mode: '按病症',
    complaint: '干咳、咽痒，无明显发热',
    medicine: '',
    ages: ['成人', '儿童', '老年人'],
    ageIndex: 0,
    conditions: [
      { value: '高血压', checked: false },
      { value: '糖尿病', checked: false },
      { value: '孕哺期', checked: false },
      { value: '肝肾功能异常', checked: false },
      { value: '药物过敏', checked: false }
    ],
    currentMedication: '',
    result: null,
    generating: false,
    confirmed: false,
    errorMessage: ''
  },

  changeMode(event) {
    this.setData({ mode: event.currentTarget.dataset.mode, result: null, confirmed: false })
  },

  onComplaintInput(event) {
    this.setData({ complaint: event.detail.value })
  },

  onMedicineInput(event) {
    this.setData({ medicine: event.detail.value })
  },

  onAgeChange(event) {
    this.setData({ ageIndex: Number(event.detail.value), result: null, confirmed: false })
  },

  onConditionsChange(event) {
    const selected = event.detail.value
    const conditions = this.data.conditions.map((item) => ({
      value: item.value,
      checked: selected.indexOf(item.value) >= 0
    }))
    this.setData({ conditions, result: null, confirmed: false })
  },

  onMedicationInput(event) {
    this.setData({ currentMedication: event.detail.value })
  },

  async generate() {
    const query = this.data.mode === '按病症' ? this.data.complaint.trim() : this.data.medicine.trim()
    if (!query) {
      wx.showToast({ title: `请填写${this.data.mode === '按病症' ? '顾客主诉' : '药品名称'}`, icon: 'none' })
      return
    }

    const selectedConditions = this.data.conditions.filter((item) => item.checked).map((item) => item.value)
    this.setData({ generating: true, result: null, confirmed: false, errorMessage: '' })
    try {
      const result = await api.generateRecommendation({
        mode: this.data.mode,
        query,
        ageGroup: this.data.ages[this.data.ageIndex],
        conditions: selectedConditions,
        currentMedication: this.data.currentMedication.trim()
      })
      this.setData({ result, generating: false })
    } catch (error) {
      const errorMessage = error.message || '生成失败，请稍后重试'
      this.setData({ generating: false, errorMessage })
      wx.showToast({ title: '检索未完成', icon: 'none' })
    }
  },

  confirmChecks() {
    this.setData({ confirmed: true })
    wx.showToast({ title: '风险信息已确认', icon: 'success' })
  },

  submitSale() {
    if (!this.data.confirmed) {
      wx.showToast({ title: '请先确认风险问询', icon: 'none' })
      return
    }
    const reviewRequired = this.data.result.reviewRequired
    wx.showModal({
      title: reviewRequired ? '提交执业药师复核' : '确认采用该组合',
      content: reviewRequired
        ? '当前顾客存在需进一步核验的信息，提交后由执业药师确认禁忌、相互作用和用法用量。'
        : '确认后将记录本次推荐与实际采用情况，供门店经营分析使用。',
      confirmText: reviewRequired ? '提交复核' : '确认采用',
      confirmColor: '#126b59',
      success: (result) => {
        if (result.confirm) wx.showToast({ title: reviewRequired ? '已提交复核' : '已记录', icon: 'success' })
      }
    })
  },

  showSource(event) {
    const source = this.data.result.sources[Number(event.currentTarget.dataset.index)]
    if (!source) return
    wx.showModal({
      title: source.title,
      content: `${source.abstract}\n\n资料类型：${source.tag}`,
      cancelText: '关闭',
      confirmText: '复制链接',
      confirmColor: '#126b59',
      success: (result) => {
        if (result.confirm && source.url) wx.setClipboardData({ data: source.url })
      }
    })
  }
})
