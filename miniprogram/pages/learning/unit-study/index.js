const api = require("../../../services/api")
Page({
  data: { taskId: "", unitId: "", unit: null, course: null, submitting: false },
  async onLoad(options) {
    this.setData({ taskId: options.taskId || "", unitId: options.unitId || "" })
    const res = await api.getLearningTaskDetail(this.data.taskId)
    const unit = (res.units || []).find((u) => u.id === this.data.unitId) || res.units?.[0]
    this.setData({ unit, course: res.course })
  },
  async markComplete() {
    this.setData({ submitting: true })
    try {
      await api.updateLearningUnitProgress(this.data.taskId, this.data.unitId)
      wx.showToast({ title: "本节已完成", icon: "success" })
      setTimeout(() => wx.navigateBack(), 1200)
    } catch (e) {
      wx.showToast({ title: e.message || "更新失败", icon: "none" })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
