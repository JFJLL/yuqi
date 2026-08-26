/// <reference path="../pb_data/types.d.ts" />
// 1787500010_phase1_regions_stores_fields.js — 扩展 regions / stores 管理字段

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

migrate((app) => {
  const regions = app.findCollectionByNameOrId("regions")
  if (regions) {
    let changed = false
    changed = ensureField(regions, { name: "manager_name", type: "text", max: 60 }) || changed
    changed = ensureField(regions, { name: "manager_mobile", type: "text", max: 30 }) || changed
    changed = ensureField(regions, { name: "status", type: "text", max: 20 }) || changed
    if (changed) app.save(regions)
  }

  const stores = app.findCollectionByNameOrId("stores")
  if (stores) {
    let changed = false
    changed = ensureField(stores, { name: "code", type: "text", max: 60 }) || changed
    changed = ensureField(stores, { name: "status", type: "text", max: 20 }) || changed
    changed = ensureField(stores, { name: "manager_name", type: "text", max: 60 }) || changed
    changed = ensureField(stores, { name: "manager_mobile", type: "text", max: 30 }) || changed
    changed = ensureField(stores, { name: "manager_employee", type: "text", max: 40 }) || changed
    if (changed) app.save(stores)
  }
}, (app) => {
  return true
})
