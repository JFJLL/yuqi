const api = require("../../../services/api")
Page({
  data: { taskId: "", paper: null, answers: {}, attemptId: "", submitting: false, loading: true },
  async onLoad(options) {
    this.setData({ taskId: options.taskId || "" })
    try {
      const paper = await api.getExamPaper(this.data.taskId)
      this.setData({ paper, attemptId: paper.attemptId || "", loading: false })
    } catch (e) {
      wx.showToast({ title: e.message || "试卷加载失败", icon: "none" })
      this.setData({ loading: false })
    }
  },
  selectOption(e) {
    const { qId, label } = e.currentTarget.dataset
    this.setData({ [`answers.${qId}`]: label })
  },
  async submitExam() {
    this.setData({ submitting: true })
    try {
      const res = await api.submitExam(this.data.taskId, this.data.answers, this.data.attemptId)
      wx.redirectTo({ url: `/pages/learning/exam-result/index?taskId=${this.data.taskId}&score=${res.score}&passed=${res.passed}&passScore=${res.passScore}` })
    } catch (e) {
      wx.showToast({ title: e.message || "提交失败", icon: "none" })
      this.setData({ submitting: false })
    }
  }
})
