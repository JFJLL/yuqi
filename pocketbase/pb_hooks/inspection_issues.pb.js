/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/inspection_issues.pb.js — 业务 collection + REST CRUD 路由 (self-contained)
//
// 由 mcp__rh-pb-hooks__install_business_collection 装. 不要直接 Read+Write 这个文件.
// 业务字段: transcript:relation, employee:relation, store:relation, issue_type:text, risk:text, state:text, quote:text, advice:text, occurred_at:date
// 路由: list,get,create,update,delete
// list filter 字段: store,employee,risk,state,issue_type
// list 默认排序: -occurred_at

onBootstrap(function (e) {
  e.next()
  try {
    var existing = null
    try { existing = $app.findCollectionByNameOrId("inspection_issues") } catch (_) { existing = null }
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
      addField({ name: 'transcript', type: 'relation', max: 1, collectionId: 'transcripts' })
      addField({ name: 'employee', type: 'relation', max: 1, collectionId: 'employees' })
      addField({ name: 'store', type: 'relation', max: 1, collectionId: 'stores' })
      addField({ name: 'issue_type', type: 'text', max: 60 })
      addField({ name: 'risk', type: 'text', max: 10 })
      addField({ name: 'state', type: 'text', max: 20 })
      addField({ name: 'quote', type: 'text', max: 1000 })
      addField({ name: 'advice', type: 'text', max: 1000 })
      addField({ name: 'occurred_at', type: 'date' })
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
        try { $app.logger().info("inspection_issues collection upgraded") } catch (_) {}
      }
    } else {
      var col = new Collection({
        type: "base",
        name: "inspection_issues",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [
          { name: 'transcript', type: 'relation', max: 1, collectionId: 'transcripts' },
          { name: 'employee', type: 'relation', max: 1, collectionId: 'employees' },
          { name: 'store', type: 'relation', max: 1, collectionId: 'stores' },
          { name: 'issue_type', type: 'text', max: 60 },
          { name: 'risk', type: 'text', max: 10 },
          { name: 'state', type: 'text', max: 20 },
          { name: 'quote', type: 'text', max: 1000 },
          { name: 'advice', type: 'text', max: 1000 },
          { name: 'occurred_at', type: 'date' },
          { name: "created", type: "autodate", onCreate: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      })
      $app.save(col)
      try { $app.logger().info("inspection_issues collection created") } catch (_) {}
    }
  } catch (err) {
    try { $app.logger().error("inspection_issues bootstrap: " + String(err && err.message || err)) } catch (_) {}
  }
})

// GET /api/inspection_issues?page=1&perPage=50&sort=-created&store=...&employee=...&risk=...&state=...&issue_type=...

// 匿名 CRUD 路由已由 pocketbase/pb_hooks/business.pb.js 统一守卫路由替代。
