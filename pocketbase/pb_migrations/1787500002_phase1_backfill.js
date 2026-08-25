/// <reference path="../pb_data/types.d.ts" />
// 1787500002_phase1_backfill.js — 既有集合 tenant 关系 + 回填
// 不删除数据、不改记录 ID、不清空既有关系。

migrate((app) => {
  try {
    const tenantId = app.findCollectionByNameOrId("tenants").id

    // app_users 增加 token_valid_from (会话失效用)
    {
      const users = app.findCollectionByNameOrId("app_users")
      let has = false
      try {
        has = !!users.fields.getByName("token_valid_from")
      } catch (_) {
        has = false
      }
      if (!has) {
        users.fields.add(new Field({ name: "token_valid_from", type: "date" }))
        app.save(users)
      }
    }

    // 需要回填的既有业务集合
    const legacy = [
      "regions",
      "stores",
      "employees",
      "devices",
      "device_bindings",
      "audio_files",
      "asr_jobs",
      "transcripts",
      "inspection_issues",
      "rectify_tasks",
      "compliance_rules",
      "sync_logs",
      "device_logs",
      "knowledge_items",
      "model_evals",
      "app_settings",
    ]

    for (let i = 0; i < legacy.length; i++) {
      const name = legacy[i]
      let coll = null
      try {
        coll = app.findCollectionByNameOrId(name)
      } catch (_) {
        coll = null
      }
      if (!coll) continue
      let hasTenant = false
      try {
        hasTenant = !!coll.fields.getByName("tenant")
      } catch (_) {
        hasTenant = false
      }
      if (!hasTenant) {
        coll.fields.add(new Field({ name: "tenant", type: "relation", maxSelect: 1, collectionId: app.findCollectionByNameOrId("tenants").id }))
        app.save(coll)
      }
      // 回填 (SQL 直更, 不触发 hook, 幂等)
      try {
        const result = app.db()
          .newQuery("UPDATE `" + name + "` SET `tenant` = {:t} WHERE (`tenant` = '' OR `tenant` IS NULL)")
          .bind({ t: tenantId })
          .execute()
        console.log("PHASE1_BACKFILL: " + name + " done")
      } catch (err) {
        console.log("PHASE1_BACKFILL_FAIL: " + name + " " + JSON.stringify(String(err && err.message || err)))
      }
    }

    // appeals 回填 tenant
    try {
      const appeals = app.findCollectionByNameOrId("appeals")
      let hasTenant = false
      try {
        hasTenant = !!appeals.fields.getByName("tenant")
      } catch (_) {
        hasTenant = false
      }
      if (!hasTenant) {
        appeals.fields.add(new Field({ name: "tenant", type: "relation", maxSelect: 1, collectionId: app.findCollectionByNameOrId("tenants").id }))
        app.save(appeals)
      }
      app.db().newQuery("UPDATE `appeals` SET `tenant` = {:t} WHERE (`tenant` = '' OR `tenant` IS NULL)").bind({ t: tenantId }).execute()
    } catch (err) {
      console.log("PHASE1_BACKFILL_FAIL: appeals " + JSON.stringify(String(err && err.message || err)))
    }

    // 历史 transcripts.segments_json 幂等回填到 transcript_segments 由脚本/服务端一次性任务负责, 不在迁移中批量展开
    console.log("PHASE1_BACKFILL: complete")
  } catch (err) {
    console.log("PHASE1_BACKFILL_FAIL: " + JSON.stringify(String(err && err.message || err)))
    throw err
  }
}, (app) => {
  // 不删除既有数据
})
