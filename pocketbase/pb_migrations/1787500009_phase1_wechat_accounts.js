/// <reference path="../pb_data/types.d.ts" />
// 1787500009_phase1_wechat_accounts.js — 微信小程序账号映射表
// wechat_accounts: tenant / employee / openid / unionid / mobile / status / bound_at / last_login_at / raw_profile

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
  try {
    tenantId = app.findCollectionByNameOrId("tenants").id
  } catch (_) {}

  let empId = ""
  try {
    empId = app.findCollectionByNameOrId("employees").id
  } catch (_) {}

  ensureCollection(app, "wechat_accounts", (c) => {
    let changed = false
    if (tenantId) changed = ensureField(c, { name: "tenant", type: "relation", collectionId: tenantId, maxSelect: 1 }) || changed
    if (empId) changed = ensureField(c, { name: "employee", type: "relation", collectionId: empId, maxSelect: 1 }) || changed
    changed = ensureField(c, { name: "openid", type: "text", required: true, max: 120 }) || changed
    changed = ensureField(c, { name: "unionid", type: "text", max: 120 }) || changed
    changed = ensureField(c, { name: "mobile", type: "text", required: true, max: 30 }) || changed
    changed = ensureField(c, { name: "status", type: "text", max: 30 }) || changed
    changed = ensureField(c, { name: "bound_at", type: "date" }) || changed
    changed = ensureField(c, { name: "last_login_at", type: "date" }) || changed
    changed = ensureField(c, { name: "raw_profile", type: "json" }) || changed
    changed = ensureField(c, { name: "created", type: "autodate", onCreate: true }) || changed
    changed = ensureField(c, { name: "updated", type: "autodate", onCreate: true, onUpdate: true }) || changed
    return changed
  })
}, (app) => {
  return true
})
