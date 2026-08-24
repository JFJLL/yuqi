/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/model_evals.pb.js — 业务 collection + REST CRUD 路由 (self-contained)
//
// 由 mcp__rh-pb-hooks__install_business_collection 装. 不要直接 Read+Write 这个文件.
// 业务字段: scenario:text, accuracy:text, note:text, progress:number, status:text
// 路由: list,get,create,update,delete
// list filter 字段: (none)
// list 默认排序: -created

onBootstrap(function (e) {
  e.next()
  try {
    var existing = null
    try { existing = $app.findCollectionByNameOrId("model_evals") } catch (_) { existing = null }
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
      addField({ name: 'scenario', type: 'text', required: true, max: 80 })
      addField({ name: 'accuracy', type: 'text', max: 20 })
      addField({ name: 'note', type: 'text', max: 300 })
      addField({ name: 'progress', type: 'number' })
      addField({ name: 'status', type: 'text', max: 20 })
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
        try { $app.logger().info("model_evals collection upgraded") } catch (_) {}
      }
    } else {
      var col = new Collection({
        type: "base",
        name: "model_evals",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [
          { name: 'scenario', type: 'text', required: true, max: 80 },
          { name: 'accuracy', type: 'text', max: 20 },
          { name: 'note', type: 'text', max: 300 },
          { name: 'progress', type: 'number' },
          { name: 'status', type: 'text', max: 20 },
          { name: "created", type: "autodate", onCreate: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      })
      $app.save(col)
      try { $app.logger().info("model_evals collection created") } catch (_) {}
    }
  } catch (err) {
    try { $app.logger().error("model_evals bootstrap: " + String(err && err.message || err)) } catch (_) {}
  }
})

// GET /api/model_evals?page=1&perPage=50&sort=-created

// 匿名 CRUD 路由已由 pocketbase/pb_hooks/business.pb.js 统一守卫路由替代。
