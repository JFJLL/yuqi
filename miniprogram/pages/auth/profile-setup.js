const api = require('../../services/api')

Page({
  data: {
    mobile: '',
    name: '',
    stores: [],
    storeIndex: -1,
    selectedStore: null,
    loading: true,
    submitting: false
  },

  async onLoad() {
    const user = api.getCurrentUser()
    if (api.hasCompletedProfile()) {
      wx.switchTab({ url: '/pages/home/index' })
      return
    }
    try {
      const stores = await api.getStoreOptions()
      this.setData({
        mobile: user.mobile,
        stores,
        storeIndex: stores.length ? 0 : -1,
        selectedStore: stores.length ? stores[0] : null,
        loading: false
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '门店加载失败', icon: 'none' })
    }
  },

  onNameInput(event) {
    this.setData({ name: event.detail.value })
  },

  onStoreChange(event) {
    const storeIndex = Number(event.detail.value)
    this.setData({ storeIndex, selectedStore: this.data.stores[storeIndex] })
  },

  async submitProfile() {
    const name = this.data.name.trim()
    const store = this.data.selectedStore
    if (name.length < 2) {
      wx.showToast({ title: '请填写真实姓名', icon: 'none' })
      return
    }
    if (!store) {
      wx.showToast({ title: '请选择所属门店', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    try {
      const result = await api.completeProfile({ name, storeId: store.id })
      getApp().globalData.currentUser = result.user
      wx.showToast({ title: `已关联${result.user.role}身份`, icon: 'success' })
      setTimeout(() => wx.switchTab({ url: '/pages/home/index' }), 500)
    } catch (error) {
      wx.showToast({ title: error.message || '关联失败，请重试', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
