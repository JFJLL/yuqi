/// <reference path="../pb_data/types.d.ts" />
// 1787500013_phase1_wechat_and_learning_indexes.js — 微信账号与培训唯一索引与字段增强

function fieldExists(collection, name) {
  try { return !!collection.fields.getByName(name) } catch (_) { return false }
}

function ensureField(collection, def) {
  if (fieldExists(collection, def.name)) return false
  collection.fields.add(new Field(def))
  return true
}

migrate((app) => {
  // 1. wechat_accounts: appid 字段与唯一索引
  try {
    const wechatColl = app.findCollectionByNameOrId("wechat_accounts")
    if (wechatColl) {
      let changed = ensureField(wechatColl, { name: "appid", type: "text", max: 120 })
      const indexes = wechatColl.indexes || []
      const idxSql = "CREATE UNIQUE INDEX IF NOT EXISTS `idx_wechat_tenant_openid` ON `wechat_accounts` (`tenant`, `openid`) WHERE `openid` IS NOT NULL AND `openid` != ''"
      if (!indexes.some((x) => String(x).includes("idx_wechat_tenant_openid"))) {
        indexes.push(idxSql)
        changed = true
      }
      wechatColl.indexes = indexes
      if (changed) app.save(wechatColl)
    }
  } catch (err) {
    console.log("WECHAT_INDEX_FAIL: " + String((err && err.message) || err))
  }

  // 2. learning_courses: version 字段
  try {
    const coursesColl = app.findCollectionByNameOrId("learning_courses")
    if (coursesColl) {
      let changed = ensureField(coursesColl, { name: "version", type: "number" })
      if (changed) app.save(coursesColl)
    }
  } catch (_) {}
}, (app) => {
  return true
})
