/// <reference path="../pb_data/types.d.ts" />
  // 1787500014_phase1_wechat_appid_openid_unique.js — 微信 appid + openid 联合唯一索引
  
  function fieldExists(collection, name) {
    try { return !!collection.fields.getByName(name) } catch (_) { return false }
  }
  function ensureField(collection, def) {
    if (fieldExists(collection, def.name)) return false
    collection.fields.add(new Field(def))
    return true
  }

  migrate((app) => {
    try {
      const wechatColl = app.findCollectionByNameOrId("wechat_accounts")
    if (wechatColl) {
      const indexes = wechatColl.indexes || []
      const idxSql = "CREATE UNIQUE INDEX IF NOT EXISTS `idx_wechat_appid_openid` ON `wechat_accounts` (`appid`, `openid`) WHERE `appid` IS NOT NULL AND `appid` != '' AND `openid` IS NOT NULL AND `openid` != ''"
      if (!indexes.some((x) => String(x).includes("idx_wechat_appid_openid"))) {
        indexes.push(idxSql)
        wechatColl.indexes = indexes
        app.save(wechatColl)
      }
    }
  } catch (err) {
      console.log("WECHAT_APPID_OPENID_INDEX_FAIL: " + String((err && err.message) || err))
    }

    // 2. learning_attempts 补充 session 字段: status, started_at, expires_at, exam
    try {
      let tenantId = ""
      try { tenantId = app.findCollectionByNameOrId("tenants").id } catch (_) {}

      const attColl = app.findCollectionByNameOrId("learning_attempts")
      if (attColl) {
        let changed = false
        if (tenantId) changed = ensureField(attColl, { name: "tenant", type: "relation", collectionId: tenantId, maxSelect: 1 }) || changed
        changed = ensureField(attColl, { name: "status", type: "text", max: 30 }) || changed
        changed = ensureField(attColl, { name: "started_at", type: "date" }) || changed
        changed = ensureField(attColl, { name: "expires_at", type: "date" }) || changed
        changed = ensureField(attColl, { name: "detail_json", type: "json" }) || changed
        if (changed) app.save(attColl)
      }
    } catch (_) {}

    // 3. app_users 补充 created 与 updated 自动日期字段
    try {
      const usersColl = app.findCollectionByNameOrId("app_users")
      if (usersColl) {
        let changed = false
        changed = ensureField(usersColl, { name: "created", type: "autodate", onCreate: true }) || changed
        changed = ensureField(usersColl, { name: "updated", type: "autodate", onCreate: true, onUpdate: true }) || changed
        if (changed) app.save(usersColl)
      }
    } catch (_) {}
  }, (app) => {
    return true
  })
