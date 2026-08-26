const api = require("../../../services/api")
Page({
  data: { taskId: "", task: null, course: null, units: [], progress: null, loading: true },
  onLoad(options) {
    this.setData({ taskId: options.id || "" })
  },
  onShow() {
    this.loadDetail()
  },
  async loadDetail() {
    try {
      const res = await api.getLearningTaskDetail(this.data.taskId)
      this.setData({ task: res.task, course: res.course, units: res.units || [], progress: res.progress, loading: false })
    } catch (e) {
      wx.showToast({ title: "加载失败", icon: "none" })
      this.setData({ loading: false })
    }
  },
  startUnit(e) {
    const unitId = e.currentTarget.dataset.unitId
    wx.navigateTo({ url: `/pages/learning/unit-study/index?taskId=${this.data.taskId}&unitId=${unitId}` })
  },
  goToExam() {
    wx.navigateTo({ url: `/pages/learning/exam/index?taskId=${this.data.taskId}` })
  },
  viewHistory() {
    wx.navigateTo({ url: `/pages/learning/exam-history/index?taskId=${this.data.taskId}` })
  }
})
