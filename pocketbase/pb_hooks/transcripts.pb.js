/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/transcripts.pb.js — 业务 collection + REST CRUD 路由 (self-contained)
//
// 由 mcp__rh-pb-hooks__install_business_collection 装. 不要直接 Read+Write 这个文件.
// 业务字段: device:text, employee:relation, store:relation, summary:text, full_text:text, segments_json:json, asr_job:text, asr_status:text, model:text, audio_name:text, qc_result:text, occurred_at:date
// 路由: list,get,create,update,delete
// list filter 字段: store,employee,qc_result
// list 默认排序: -occurred_at

// PocketBase relation fields require collection IDs, not collection names.
// These IDs are declared by pocketbase/pb_migrations/*_created_{employees,stores}.js.

onBootstrap(function (e) {
  e.next()
  try {
    var existing = null
    try { existing = $app.findCollectionByNameOrId("transcripts") } catch (_) { existing = null }
    if (existing) {
      var changed = false
      function hasField(name) {
        try { return !!existing.fields.getByName(name) } catch (_) {}
        try {
          for (var i = 0; i < existing.fields.length; i++) {
            if (String(existing.fields[i].name) === String(name)) return true
          }
        } catch (_) {}
        return false
      }
      function addField(def) {
        if (hasField(def.name)) return
        try { existing.fields.add(new Field(def)); changed = true } catch (_) {}
      }
      addField({ name: 'device', type: 'text', max: 60 })
      addField({ name: 'employee', type: 'relation', max: 1, collectionId: 'pbc_3735627160' })
      addField({ name: 'store', type: 'relation', max: 1, collectionId: 'pbc_3800236418' })
      addField({ name: 'summary', type: 'text', max: 500 })
      addField({ name: 'full_text', type: 'text', max: 100000 })
      addField({ name: 'segments_json', type: 'json' })
      addField({ name: 'asr_job', type: 'text', max: 20 })
      addField({ name: 'asr_status', type: 'text', max: 20 })
      addField({ name: 'model', type: 'text', max: 80 })
      addField({ name: 'audio_name', type: 'text', max: 180 })
      try {
        var fullTextField = existing.fields.getByName('full_text')
        if (fullTextField && Number(fullTextField.max || 0) < 100000) { fullTextField.max = 100000; changed = true }
      } catch (_) {}
      addField({ name: 'qc_result', type: 'text', max: 20 })
      addField({ name: 'occurred_at', type: 'date' })
      // 记录来源：manual=后台上传, oss_auto=OSS 自动采集。空值视为 manual。
      addField({ name: 'source', type: 'text', max: 20 })
      addField({ name: 'speaker_aliases', type: 'json' })
      addField({ name: 'marks_json', type: 'json' })
      addField({ name: "created", type: "autodate", onCreate: true })
      addField({ name: "updated", type: "autodate", onCreate: true, onUpdate: true })
            var rulesChanged = false
      try {
        if (existing.listRule !== null || existing.viewRule !== null || existing.createRule !== null || existing.updateRule !== null || existing.deleteRule !== null) {
          existing.listRule = null
          existing.viewRule = null
          existing.createRule = null
          existing.updateRule = null
          existing.deleteRule = null
          rulesChanged = true
        }
      } catch (_) {}
if (changed || rulesChanged) {
        $app.save(existing)
        try { $app.logger().info("transcripts collection upgraded") } catch (_) {}
      }
    } else {
      var col = new Collection({
        type: "base",
        name: "transcripts",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [
          { name: 'device', type: 'text', max: 60 },
          { name: 'employee', type: 'relation', max: 1, collectionId: 'pbc_3735627160' },
          { name: 'store', type: 'relation', max: 1, collectionId: 'pbc_3800236418' },
          { name: 'summary', type: 'text', max: 500 },
          { name: 'full_text', type: 'text', max: 100000 },
          { name: 'segments_json', type: 'json' },
          { name: 'asr_job', type: 'text', max: 20 },
          { name: 'asr_status', type: 'text', max: 20 },
          { name: 'model', type: 'text', max: 80 },
          { name: 'audio_name', type: 'text', max: 180 },
          { name: 'qc_result', type: 'text', max: 20 },
          { name: 'occurred_at', type: 'date' },
          { name: 'source', type: 'text', max: 20 },
          { name: 'speaker_aliases', type: 'json' },
          { name: 'marks_json', type: 'json' },
         { name: "created", type: "autodate", onCreate: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      })
      $app.save(col)
      try { $app.logger().info("transcripts collection created") } catch (_) {}
    }
  } catch (err) {
    try { $app.logger().error("transcripts bootstrap: " + String(err && err.message || err)) } catch (_) {}
  }
})

// GET /api/transcripts?page=1&perPage=50&sort=-created&store=...&employee=...&qc_result=...

// 匿名 CRUD 路由已由 pocketbase/pb_hooks/business.pb.js 统一守卫路由替代。
