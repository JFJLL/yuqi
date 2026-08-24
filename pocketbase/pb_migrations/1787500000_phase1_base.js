/// <reference path="../pb_data/types.d.ts" />
// 1787500000_phase1_base.js — 一期基础集合
// tenants / app_users (Auth) / user_data_scopes / sms_codes / audit_logs
// 幂等 upsert: 已存在则补字段, 不存在则创建。

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
  try {
    phase1Base(app)
  } catch (err) {
    console.log("PHASE1_BASE_FAIL: " + JSON.stringify(String(err && err.message || err)))
    console.log("PHASE1_BASE_FAIL_DETAIL: " + JSON.stringify(String(err)))
    throw err
  }
}, (app) => {
  // 回滚不删除任何既有数据
  return true
})

function phase1Base(app) {
  // ---- tenants ----
  ensureCollection(app, "tenants", (c) => {
    let changed = false
    changed = ensureField(c, { name: "code", type: "text", required: true, max: 60 }) || changed
    changed = ensureField(c, { name: "name", type: "text", required: true, max: 120 }) || changed
    changed = ensureField(c, { name: "status", type: "text", max: 20 }) || changed
    changed = ensureField(c, { name: "created", type: "autodate", onCreate: true }) || changed
    changed = ensureField(c, { name: "updated", type: "autodate", onCreate: true, onUpdate: true }) || changed
    return changed
  })

  // 默认试点租户 (幂等)
  let defaultTenant = null
  try {
    defaultTenant = app.findFirstRecordByFilter("tenants", "code = {:code}", { code: "demo" })
  } catch (_) {
    defaultTenant = null
  }
  if (!defaultTenant) {
    const col = app.findCollectionByNameOrId("tenants")
    defaultTenant = new Record(col)
    defaultTenant.set("code", "demo")
    defaultTenant.set("name", "演示试点租户")
    defaultTenant.set("status", "ACTIVE")
    app.save(defaultTenant)
  }

  // ---- app_users (Auth) ----
  let users = null
  try {
    users = app.findCollectionByNameOrId("app_users")
  } catch (_) {
    users = null
  }
  if (!users) {
    users = new Collection({
      type: "auth",
      name: "app_users",
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      options: {
        allowEmailAuth: true,
        allowUsernameAuth: false,
        requireEmail: true,
        minPasswordLength: 8,
      },
      fields: [
        // auth 系统字段必须带 system:true 与固定 id, 否则 API 创建记录时要求手工填 tokenKey
        { id: "email3885137012", name: "email", type: "email", required: true, system: true },
        { id: "password901924565", name: "password", type: "password", required: true, system: true, hidden: true },
        { id: "text2504183744", name: "tokenKey", type: "text", required: true, system: true, hidden: true },
        { id: "bool1547992806", name: "emailVisibility", type: "bool", system: true },
        { id: "bool256245529", name: "verified", type: "bool", system: true },
      ],
    })
    app.save(users)
  } else {
    // 修复历史错误定义: tokenKey 非 system 时会导致创建记录被要求手工填值
    try {
      const tk = users.fields.getByName("tokenKey")
      if (tk && !tk.system) {
        users.fields.remove(tk)
        users.fields.add(new Field({ id: "text2504183744", name: "tokenKey", type: "text", required: true, system: true, hidden: true }))
        app.save(users)
      }
    } catch (_) {}
  }
  {
    const tenantId = app.findCollectionByNameOrId("tenants").id
    const employeeCollId = (() => {
      try {
        return app.findCollectionByNameOrId("employees").id
      } catch (_) {
        return ""
      }
    })()
    const regionCollId = (() => {
      try {
        return app.findCollectionByNameOrId("regions").id
      } catch (_) {
        return ""
      }
    })()
    const storeCollId = (() => {
      try {
        return app.findCollectionByNameOrId("stores").id
      } catch (_) {
        return ""
      }
    })()
    let changed = false
    if (employeeCollId && !fieldExists(users, "employee")) {
      users.fields.add(new Field({ name: "employee", type: "relation", maxSelect: 1, collectionId: employeeCollId }))
      changed = true
    }
    if (!fieldExists(users, "tenant")) {
      users.fields.add(new Field({ name: "tenant", type: "relation", maxSelect: 1, collectionId: tenantId }))
      changed = true
    }
    changed = ensureField(users, { name: "display_name", type: "text", max: 80 }) || changed
    changed = ensureField(users, { name: "role_code", type: "text", required: true, max: 40 }) || changed
    changed = ensureField(users, { name: "status", type: "text", max: 20 }) || changed
    if (regionCollId && !fieldExists(users, "assigned_org")) {
      users.fields.add(new Field({ name: "assigned_org", type: "relation", maxSelect: 1, collectionId: regionCollId }))
      changed = true
    }
    if (storeCollId && !fieldExists(users, "assigned_store")) {
      users.fields.add(new Field({ name: "assigned_store", type: "relation", maxSelect: 1, collectionId: storeCollId }))
      changed = true
    }
    changed = ensureField(users, { name: "mobile", type: "text", max: 30 }) || changed
    changed = ensureField(users, { name: "last_login_at", type: "date" }) || changed
    changed = ensureField(users, { name: "token_version", type: "number" }) || changed
    if (changed) app.save(users)
  }

  // ---- user_data_scopes ----
  ensureCollection(app, "user_data_scopes", (c) => {
    let changed = false
    changed = ensureField(c, { name: "user", type: "relation", required: true, maxSelect: 1, collectionId: app.findCollectionByNameOrId("app_users").id }) || changed
    changed = ensureField(c, { name: "tenant", type: "relation", maxSelect: 1, collectionId: app.findCollectionByNameOrId("tenants").id }) || changed
    changed = ensureField(c, { name: "scope_type", type: "text", max: 20 }) || changed
    changed = ensureField(c, { name: "org_node", type: "relation", maxSelect: 1, collectionId: (() => { try { return app.findCollectionByNameOrId("regions").id } catch (_) { return "" } })() }) || changed
    changed = ensureField(c, { name: "store", type: "relation", maxSelect: 1, collectionId: (() => { try { return app.findCollectionByNameOrId("stores").id } catch (_) { return "" } })() }) || changed
    changed = ensureField(c, { name: "status", type: "text", max: 20 }) || changed
    changed = ensureField(c, { name: "created", type: "autodate", onCreate: true }) || changed
    changed = ensureField(c, { name: "updated", type: "autodate", onCreate: true, onUpdate: true }) || changed
    return changed
  })

  // ---- sms_codes ----
  ensureCollection(app, "sms_codes", (c) => {
    let changed = false
    changed = ensureField(c, { name: "tenant", type: "relation", maxSelect: 1, collectionId: app.findCollectionByNameOrId("tenants").id }) || changed
    changed = ensureField(c, { name: "mobile", type: "text", required: true, max: 30 }) || changed
    changed = ensureField(c, { name: "code_hash", type: "text", required: true, max: 200 }) || changed
    changed = ensureField(c, { name: "expires_at", type: "date" }) || changed
    changed = ensureField(c, { name: "failed_attempts", type: "number" }) || changed
    changed = ensureField(c, { name: "sent_at", type: "date" }) || changed
    changed = ensureField(c, { name: "consumed_at", type: "date" }) || changed
    changed = ensureField(c, { name: "request_ip", type: "text", max: 60 }) || changed
    changed = ensureField(c, { name: "status", type: "text", max: 20 }) || changed
    changed = ensureField(c, { name: "created", type: "autodate", onCreate: true }) || changed
    changed = ensureField(c, { name: "updated", type: "autodate", onCreate: true, onUpdate: true }) || changed
    if (!c.indexes || c.indexes.length === 0) {
      try {
        c.indexes = ["CREATE UNIQUE INDEX `idx_sms_codes_mobile_active` ON `sms_codes` (`mobile`) WHERE `status` = 'ACTIVE'"]
        changed = true
      } catch (_) {}
    }
    return changed
  })

  // ---- audit_logs ----
  ensureCollection(app, "audit_logs", (c) => {
    let changed = false
    changed = ensureField(c, { name: "tenant", type: "relation", maxSelect: 1, collectionId: app.findCollectionByNameOrId("tenants").id }) || changed
    changed = ensureField(c, { name: "actor", type: "relation", maxSelect: 1, collectionId: app.findCollectionByNameOrId("app_users").id }) || changed
    changed = ensureField(c, { name: "actor_name", type: "text", max: 120 }) || changed
    changed = ensureField(c, { name: "actor_type", type: "text", max: 20 }) || changed
    changed = ensureField(c, { name: "action", type: "text", required: true, max: 80 }) || changed
    changed = ensureField(c, { name: "target_type", type: "text", max: 60 }) || changed
    changed = ensureField(c, { name: "target_id", type: "text", max: 60 }) || changed
    changed = ensureField(c, { name: "detail_json", type: "json" }) || changed
    changed = ensureField(c, { name: "ip", type: "text", max: 60 }) || changed
    changed = ensureField(c, { name: "request_id", type: "text", max: 80 }) || changed
    changed = ensureField(c, { name: "created", type: "autodate", onCreate: true }) || changed
    return changed
  })

  defaultTenant = null
}
