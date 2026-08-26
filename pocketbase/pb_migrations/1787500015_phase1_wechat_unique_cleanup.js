/// <reference path="../pb_data/types.d.ts" />
// 1787500015_phase1_wechat_unique_cleanup.js — 微信账号重复数据清理与 appid+openid 联合唯一索引强制生效

migrate((app) => {
  try {
    const wechatColl = app.findCollectionByNameOrId("wechat_accounts")
    if (wechatColl) {
      // 1. 清理历史重复 active 记录，同 (appid, openid) 仅保留最新一条
      try {
        const rows = app.findRecordsByFilter("wechat_accounts", "status = 'ACTIVE' && openid != ''", "-created", 1000, 0)
        const seen = new Set()
        for (const row of rows) {
          const key = String(row.get("appid") || "") + "::" + String(row.get("openid") || "")
          if (seen.has(key)) {
            row.set("status", "UNBOUND")
            app.save(row)
          } else {
            seen.add(key)
          }
        }
      } catch (_) {}

      // 2. 强制添加并生效 appid + openid 唯一约束
      const indexes = wechatColl.indexes || []
      const idxSql = "CREATE UNIQUE INDEX IF NOT EXISTS `idx_wechat_appid_openid` ON `wechat_accounts` (`appid`, `openid`) WHERE `appid` IS NOT NULL AND `appid` != '' AND `openid` IS NOT NULL AND `openid` != ''"
      if (!indexes.some((x) => String(x).includes("idx_wechat_appid_openid"))) {
        indexes.push(idxSql)
        wechatColl.indexes = indexes
        app.save(wechatColl)
      }
    }
  } catch (err) {
    console.log("MIGRATION_1787500015_FAIL: " + String((err && err.message) || err))
    throw err
  }
}, (app) => {
  return true
})
