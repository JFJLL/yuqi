/// <reference path="../pb_data/types.d.ts" />
// 1787500016_phase1_video_learning_tasks.js — 扩展视频学习任务与通知字段

function fieldExists(collection, name) {
  try { return !!collection.fields.getByName(name) } catch (_) { return false }
}

function ensureField(collection, def) {
  if (fieldExists(collection, def.name)) return false
  collection.fields.add(new Field(def))
  return true
}

migrate((app) => {
  // 1. 扩展 learning_courses: 增加视频地址、视频时长、允许快进等配置
  try {
    const coursesCol = app.findCollectionByNameOrId("learning_courses")
    if (coursesCol) {
      let changed = false
      changed = ensureField(coursesCol, { name: "video_url", type: "text", max: 500 }) || changed
      changed = ensureField(coursesCol, { name: "video_duration", type: "number" }) || changed
      changed = ensureField(coursesCol, { name: "allow_seek", type: "bool" }) || changed
      if (changed) app.save(coursesCol)
    }
  } catch (err) {
    console.log("MIGRATE_COURSES_FAIL: " + String((err && err.message) || err))
  }

  // 2. 扩展 learning_tasks: 增加指定目标范围字段 (target_type, target_id, region 等)
  try {
    const tasksCol = app.findCollectionByNameOrId("learning_tasks")
    if (tasksCol) {
      let changed = false
      let regId = ""
      try { regId = app.findCollectionByNameOrId("regions").id } catch (_) {}
      if (regId) {
        changed = ensureField(tasksCol, { name: "region", type: "relation", collectionId: regId, maxSelect: 1 }) || changed
      }
      changed = ensureField(tasksCol, { name: "target_scope", type: "text", max: 30 }) || changed
      changed = ensureField(tasksCol, { name: "note", type: "text", max: 500 }) || changed
      changed = ensureField(tasksCol, { name: "video_progress_seconds", type: "number" }) || changed
      changed = ensureField(tasksCol, { name: "completed_at", type: "date" }) || changed
      if (changed) app.save(tasksCol)
    }
  } catch (err) {
    console.log("MIGRATE_TASKS_FAIL: " + String((err && err.message) || err))
  }
}, (app) => {
  return true
})
