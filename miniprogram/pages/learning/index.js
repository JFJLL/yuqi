const api = require('../../services/api')

Page({
  data: {
    tasks: [],
    completedCount: 0
  },

  onShow() {
    this.loadTasks()
  },

  async loadTasks() {
    const tasks = await api.getLearningTasks()
    this.setData({
      tasks,
      completedCount: tasks.filter((item) => item.progress >= 100).length
    })
  },

  continueTask(event) {
    const id = event.currentTarget.dataset.id
    const task = this.data.tasks.find((item) => item.id === id)
    if (!task) return
    wx.navigateTo({
      url: `/pages/learning/course-detail/index?id=${id}`
    })
  }
})
