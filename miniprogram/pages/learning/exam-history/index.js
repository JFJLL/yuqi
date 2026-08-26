const api = require("../../../services/api")
Page({
  data: { taskId: "", attempts: [] },
  async onLoad(options) {
    this.setData({ taskId: options.taskId || "" })
    try {
      const res = await api.getExamAttempts(this.data.taskId)
      this.setData({ attempts: res.items || [] })
    } catch (_) {}
  }
})
