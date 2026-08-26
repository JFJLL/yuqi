/// <reference path="../pb_data/types.d.ts" />
// 1787500012_phase1_learning_training.js — 培训中心 8 大核心实体迁移

function fieldExists(collection, name) {
  try { return !!collection.fields.getByName(name) } catch (_) { return false }
}

function ensureField(collection, def) {
  if (fieldExists(collection, def.name)) return false
  collection.fields.add(new Field(def))
  return true
}

function ensureCollection(app, name, build) {
  let existing = null
  try { existing = app.findCollectionByNameOrId(name) } catch (_) { existing = null }
  if (existing) {
    const changed = build(existing, true)
    if (changed) app.save(existing)
    return existing
  }
  const collection = new Collection({
    type: "base",
    name,
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [],
  })
  build(collection, false)
  app.save(collection)
  return collection
}

migrate((app) => {
  let tenantId = ""
  try { tenantId = app.findCollectionByNameOrId("tenants").id } catch (_) {}
  let empId = ""
  try { empId = app.findCollectionByNameOrId("employees").id } catch (_) {}
  let storeId = ""
  try { storeId = app.findCollectionByNameOrId("stores").id } catch (_) {}

  // 1. learning_courses
  const coursesCol = ensureCollection(app, "learning_courses", (c) => {
    let changed = false
    if (tenantId) changed = ensureField(c, { name: "tenant", type: "relation", collectionId: tenantId, maxSelect: 1 }) || changed
    changed = ensureField(c, { name: "title", type: "text", required: true, max: 120 }) || changed
    changed = ensureField(c, { name: "category", type: "text", max: 60 }) || changed
    changed = ensureField(c, { name: "summary", type: "text", max: 500 }) || changed
    changed = ensureField(c, { name: "cover_url", type: "text", max: 300 }) || changed
    changed = ensureField(c, { name: "target_issue_types", type: "json" }) || changed
    changed = ensureField(c, { name: "status", type: "text", max: 30 }) || changed
    changed = ensureField(c, { name: "created", type: "autodate", onCreate: true }) || changed
    changed = ensureField(c, { name: "updated", type: "autodate", onCreate: true, onUpdate: true }) || changed
    return changed
  })

  // 2. learning_course_units
  ensureCollection(app, "learning_course_units", (c) => {
    let changed = false
    changed = ensureField(c, { name: "course", type: "relation", collectionId: coursesCol.id, maxSelect: 1 }) || changed
    changed = ensureField(c, { name: "title", type: "text", required: true, max: 120 }) || changed
    changed = ensureField(c, { name: "content_type", type: "text", max: 30 }) || changed
    changed = ensureField(c, { name: "content", type: "text", max: 10000 }) || changed
    changed = ensureField(c, { name: "duration_seconds", type: "number" }) || changed
    changed = ensureField(c, { name: "sort_order", type: "number" }) || changed
    changed = ensureField(c, { name: "created", type: "autodate", onCreate: true }) || changed
    changed = ensureField(c, { name: "updated", type: "autodate", onCreate: true, onUpdate: true }) || changed
    return changed
  })

  // 3. learning_tasks
  const tasksCol = ensureCollection(app, "learning_tasks", (c) => {
    let changed = false
    if (tenantId) changed = ensureField(c, { name: "tenant", type: "relation", collectionId: tenantId, maxSelect: 1 }) || changed
    changed = ensureField(c, { name: "course", type: "relation", collectionId: coursesCol.id, maxSelect: 1 }) || changed
    if (empId) changed = ensureField(c, { name: "employee", type: "relation", collectionId: empId, maxSelect: 1 }) || changed
    if (storeId) changed = ensureField(c, { name: "store", type: "relation", collectionId: storeId, maxSelect: 1 }) || changed
    changed = ensureField(c, { name: "source_issue", type: "text", max: 40 }) || changed
    changed = ensureField(c, { name: "due_at", type: "date" }) || changed
    changed = ensureField(c, { name: "status", type: "text", max: 30 }) || changed
    changed = ensureField(c, { name: "created", type: "autodate", onCreate: true }) || changed
    changed = ensureField(c, { name: "updated", type: "autodate", onCreate: true, onUpdate: true }) || changed
    return changed
  })

  // 4. learning_progress
  ensureCollection(app, "learning_progress", (c) => {
    let changed = false
    changed = ensureField(c, { name: "task", type: "relation", collectionId: tasksCol.id, maxSelect: 1 }) || changed
    if (empId) changed = ensureField(c, { name: "employee", type: "relation", collectionId: empId, maxSelect: 1 }) || changed
    changed = ensureField(c, { name: "course", type: "relation", collectionId: coursesCol.id, maxSelect: 1 }) || changed
    changed = ensureField(c, { name: "unit_index", type: "number" }) || changed
    changed = ensureField(c, { name: "progress_percent", type: "number" }) || changed
    changed = ensureField(c, { name: "completed_at", type: "date" }) || changed
    changed = ensureField(c, { name: "status", type: "text", max: 30 }) || changed
    changed = ensureField(c, { name: "created", type: "autodate", onCreate: true }) || changed
    changed = ensureField(c, { name: "updated", type: "autodate", onCreate: true, onUpdate: true }) || changed
    return changed
  })

  // 5. learning_exams
  const examsCol = ensureCollection(app, "learning_exams", (c) => {
    let changed = false
    changed = ensureField(c, { name: "course", type: "relation", collectionId: coursesCol.id, maxSelect: 1 }) || changed
    changed = ensureField(c, { name: "title", type: "text", required: true, max: 120 }) || changed
    changed = ensureField(c, { name: "pass_score", type: "number" }) || changed
    changed = ensureField(c, { name: "max_attempts", type: "number" }) || changed
    changed = ensureField(c, { name: "time_limit_minutes", type: "number" }) || changed
    changed = ensureField(c, { name: "version", type: "number" }) || changed
    changed = ensureField(c, { name: "created", type: "autodate", onCreate: true }) || changed
    changed = ensureField(c, { name: "updated", type: "autodate", onCreate: true, onUpdate: true }) || changed
    return changed
  })

  // 6. learning_questions
  ensureCollection(app, "learning_questions", (c) => {
    let changed = false
    changed = ensureField(c, { name: "exam", type: "relation", collectionId: examsCol.id, maxSelect: 1 }) || changed
    changed = ensureField(c, { name: "type", type: "text", max: 30 }) || changed
    changed = ensureField(c, { name: "stem", type: "text", required: true, max: 1000 }) || changed
    changed = ensureField(c, { name: "options_json", type: "json" }) || changed
    changed = ensureField(c, { name: "answer", type: "text", max: 200 }) || changed
    changed = ensureField(c, { name: "score", type: "number" }) || changed
    changed = ensureField(c, { name: "explanation", type: "text", max: 1000 }) || changed
    changed = ensureField(c, { name: "sort_order", type: "number" }) || changed
    changed = ensureField(c, { name: "created", type: "autodate", onCreate: true }) || changed
    changed = ensureField(c, { name: "updated", type: "autodate", onCreate: true, onUpdate: true }) || changed
    return changed
  })

  // 7. learning_exam_versions
  const examVersionsCol = ensureCollection(app, "learning_exam_versions", (c) => {
    let changed = false
    changed = ensureField(c, { name: "exam", type: "relation", collectionId: examsCol.id, maxSelect: 1 }) || changed
    changed = ensureField(c, { name: "version", type: "number" }) || changed
    changed = ensureField(c, { name: "snapshot_json", type: "json" }) || changed
    changed = ensureField(c, { name: "created", type: "autodate", onCreate: true }) || changed
    return changed
  })

  // 8. learning_attempts
  ensureCollection(app, "learning_attempts", (c) => {
    let changed = false
    changed = ensureField(c, { name: "task", type: "relation", collectionId: tasksCol.id, maxSelect: 1 }) || changed
    if (empId) changed = ensureField(c, { name: "employee", type: "relation", collectionId: empId, maxSelect: 1 }) || changed
    changed = ensureField(c, { name: "exam_version", type: "relation", collectionId: examVersionsCol.id, maxSelect: 1 }) || changed
    changed = ensureField(c, { name: "answers_json", type: "json" }) || changed
    changed = ensureField(c, { name: "score", type: "number" }) || changed
    changed = ensureField(c, { name: "passed", type: "bool" }) || changed
    changed = ensureField(c, { name: "submitted_at", type: "date" }) || changed
    changed = ensureField(c, { name: "created", type: "autodate", onCreate: true }) || changed
    return changed
  })
}, (app) => {
  return true
})
