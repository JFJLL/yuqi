/// <reference path="../pb_data/types.d.ts" />
// 1787500008_phase1_session_unique.js — 会话租户与转写联合唯一索引

migrate((app) => {
  try {
    const sessionsColl = app.findCollectionByNameOrId("sessions")
    if (sessionsColl) {
      let ch = false
      const indexes = sessionsColl.indexes || []
      const idxSql = "CREATE UNIQUE INDEX `idx_sessions_tenant_transcript` ON `sessions` (`tenant`, `transcript`) WHERE `transcript` IS NOT NULL AND `transcript` != ''"
      if (!indexes.some((x) => String(x).includes("idx_sessions_tenant_transcript"))) {
        indexes.push(idxSql)
        ch = true
      }
      sessionsColl.indexes = indexes
      if (ch) app.save(sessionsColl)

      try {
        app.db().newQuery("CREATE UNIQUE INDEX IF NOT EXISTS `idx_sessions_tenant_transcript` ON `sessions` (`tenant`, `transcript`) WHERE `transcript` IS NOT NULL AND `transcript` != ''").execute()
      } catch (_) {}
    }
  } catch (err) {
    console.log("PHASE1_SESSION_UNIQUE_MIGRATION_FAIL: " + JSON.stringify(String(err && err.message || err)))
    throw err
  }
}, (app) => {
  return true
})
