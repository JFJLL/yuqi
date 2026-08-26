Page({
  data: { taskId: "", score: 0, passed: false, passScore: 80 },
  onLoad(options) {
    this.setData({
      taskId: options.taskId || "",
      score: Number(options.score || 0),
      passed: options.passed === "true",
      passScore: Number(options.passScore || 80)
    })
  },
  reExam() {
    wx.redirectTo({ url: `/pages/learning/exam/index?taskId=${this.data.taskId}` })
  },
  backHome() {
    wx.switchTab({ url: "/pages/learning/index" })
  }
})
