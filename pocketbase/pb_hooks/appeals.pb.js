/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/appeals.pb.js — 业务 collection + REST CRUD 路由 (self-contained)
//
// 由 mcp__rh-pb-hooks__install_business_collection 装. 不要直接 Read+Write 这个文件.
// 业务字段: issue:relation, reason:text, status:text, reviewer:text, reviewed_at:date
// 路由: list,get,create,update,delete
// list filter 字段: issue,status
// list 默认排序: -created

onBootstrap(function (e) {
  e.next()
  try {
    var existing = null
    try { existing = $app.findCollectionByNameOrId("appeals") } catch (_) { existing = null }
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
      addField({ name: 'issue', type: 'relation', max: 1, collectionId: 'inspection_issues' })
      addField({ name: 'reason', type: 'text', max: 1000 })
      addField({ name: 'status', type: 'text', max: 20 })
      addField({ name: 'reviewer', type: 'text', max: 60 })
      addField({ name: 'reviewed_at', type: 'date' })
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
        try { $app.logger().info("appeals collection upgraded") } catch (_) {}
      }
    } else {
      var col = new Collection({
        type: "base",
        name: "appeals",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [
          { name: 'issue', type: 'relation', max: 1, collectionId: 'inspection_issues' },
          { name: 'reason', type: 'text', max: 1000 },
          { name: 'status', type: 'text', max: 20 },
          { name: 'reviewer', type: 'text', max: 60 },
          { name: 'reviewed_at', type: 'date' },
          { name: "created", type: "autodate", onCreate: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      })
      $app.save(col)
      try { $app.logger().info("appeals collection created") } catch (_) {}
    }
  } catch (err) {
    try { $app.logger().error("appeals bootstrap: " + String(err && err.message || err)) } catch (_) {}
  }
})

// GET /api/appeals?page=1&perPage=50&sort=-created&issue=...&status=...

// 匿名 CRUD 路由已由 pocketbase/pb_hooks/business.pb.js 统一守卫路由替代。
