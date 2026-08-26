const api = require('../../services/api')

Page({
  data: {
    user: null,
    isManager: false,
    overview: null,
    device: null,
    code: '',
    loading: true,
    submitting: false
  },

  onShow() {
    const user = api.getCurrentUser()
    const isManager = user.role === '店长'
    getApp().globalData.currentUser = user
    this.setData({ user, isManager })
    wx.setNavigationBarTitle({ title: isManager ? '门店工牌' : '我的设备' })
    if (isManager) this.loadStoreDevices()
    else this.loadDevice()
  },

  async loadStoreDevices() {
    try {
      const overview = await api.getStoreDeviceOverview()
      this.setData({ overview, loading: false })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '设备加载失败', icon: 'none' })
    }
  },

  async loadDevice() {
    const device = await api.getDevice()
    this.setData({ device, code: device ? device.code : '', loading: false })
  },

  onCodeInput(event) {
    this.setData({ code: event.detail.value.trim() })
  },

  scanCode() {
    wx.scanCode({
      scanType: ['qrCode', 'barCode'],
      success: (result) => this.setData({ code: result.result.trim() })
    })
  },

  bindDevice() {
    const code = this.data.code.trim()
    if (code.length < 8) {
      wx.showToast({ title: '请输入正确的设备码', icon: 'none' })
      return
    }
    wx.showModal({
      title: this.data.device ? '更换绑定设备' : '确认绑定设备',
      content: `设备码：${code}\n绑定门店：${getApp().globalData.currentUser.storeName}`,
      confirmText: '确认绑定',
      confirmColor: '#126b59',
      success: async (result) => {
        if (!result.confirm) return
        this.setData({ submitting: true })
        const device = await api.bindDevice(code)
        this.setData({ device, submitting: false })
        wx.showToast({ title: '绑定成功', icon: 'success' })
      }
    })
  },

  unbindDevice() {
    wx.showModal({
      title: '申请解绑设备',
      content: '解绑后新的巡检结果将不再归属到当前员工。',
      confirmText: '确认解绑',
      confirmColor: '#a92c35',
      success: async (result) => {
        if (!result.confirm) return
        await api.unbindDevice()
        this.setData({ device: null, code: '' })
        wx.showToast({ title: '已解绑', icon: 'success' })
      }
    })
  },

  copyCode() {
    wx.setClipboardData({ data: this.data.device.code })
  }
})
