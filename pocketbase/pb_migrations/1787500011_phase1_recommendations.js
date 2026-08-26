/// <reference path="../pb_data/types.d.ts" />
// 1787500011_phase1_recommendations.js — 荐药业务记录集合

function fieldExists(collection, name) {
  try {
    return !!collection.fields.getByName(name)
  } catch (_) {
    return false
  }
}

function ensureField(collection, def) {
  if (fieldExists(collection, def.name)) return false
  collection.fields.add(new Field(def))
  return true
}

function ensureCollection(app, name, build) {
  let existing = null
  try {
    existing = app.findCollectionByNameOrId(name)
  } catch (_) {
    existing = null
  }
  if (existing) {
    const changed = build(existing, true)
    if (changed) app.save(existing)
    return existing
  }
  const collection = new Collection({
    type: "base",
    name,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
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

  ensureCollection(app, "recommendations", (c) => {
    let changed = false
    if (tenantId) changed = ensureField(c, { name: "tenant", type: "relation", collectionId: tenantId, maxSelect: 1 }) || changed
    if (empId) changed = ensureField(c, { name: "employee", type: "relation", collectionId: empId, maxSelect: 1 }) || changed
    if (storeId) changed = ensureField(c, { name: "store", type: "relation", collectionId: storeId, maxSelect: 1 }) || changed
    changed = ensureField(c, { name: "query", type: "text", required: true, max: 500 }) || changed
    changed = ensureField(c, { name: "result_json", type: "json" }) || changed
    changed = ensureField(c, { name: "safety", type: "text", max: 50 }) || changed
    changed = ensureField(c, { name: "source_count", type: "number" }) || changed
    changed = ensureField(c, { name: "sync_status", type: "text", max: 50 }) || changed
    changed = ensureField(c, { name: "occurred_at", type: "date" }) || changed
    changed = ensureField(c, { name: "created", type: "autodate", onCreate: true }) || changed
    changed = ensureField(c, { name: "updated", type: "autodate", onCreate: true, onUpdate: true }) || changed
    return changed
  })
}, (app) => {
  return true
})
