/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/device_bindings.pb.js — 业务 collection + REST CRUD 路由 (self-contained)
//
// 由 mcp__rh-pb-hooks__install_business_collection 装. 不要直接 Read+Write 这个文件.
// 业务字段: device:relation, employee:relation, store:relation, effective_date:date, status:text
// 路由: list,get,create,update,delete
// list filter 字段: status
// list 默认排序: -created

onBootstrap(function (e) {
  e.next()
  try {
    var existing = null
    try { existing = $app.findCollectionByNameOrId("device_bindings") } catch (_) { existing = null }
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
      addField({ name: 'device', type: 'relation', collectionId: 'pbc_2153001328' })
      addField({ name: 'employee', type: 'relation', collectionId: 'pbc_3735627160' })
      addField({ name: 'store', type: 'relation', collectionId: 'pbc_3800236418' })
      addField({ name: 'effective_date', type: 'date' })
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
        try { $app.logger().info("device_bindings collection upgraded") } catch (_) {}
      }
    } else {
      var col = new Collection({
        type: "base",
        name: "device_bindings",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [
          { name: 'device', type: 'relation', collectionId: 'pbc_2153001328' },
          { name: 'employee', type: 'relation', collectionId: 'pbc_3735627160' },
          { name: 'store', type: 'relation', collectionId: 'pbc_3800236418' },
          { name: 'effective_date', type: 'date' },
          { name: 'status', type: 'text', max: 20 },
          { name: "created", type: "autodate", onCreate: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      })
      $app.save(col)
      try { $app.logger().info("device_bindings collection created") } catch (_) {}
    }
  } catch (err) {
    try { $app.logger().error("device_bindings bootstrap: " + String(err && err.message || err)) } catch (_) {}
  }
})

// GET /api/device_bindings?page=1&perPage=50&sort=-created&status=...

// 匿名 CRUD 路由已由 pocketbase/pb_hooks/business.pb.js 统一守卫路由替代。
