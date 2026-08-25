/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/devices.pb.js — 业务 collection + REST CRUD 路由 (self-contained)
//
// 由 mcp__rh-pb-hooks__install_business_collection 装. 不要直接 Read+Write 这个文件.
// 业务字段: device_no:text, type:text, status:text, power:number, texts_today:number, last_online_at:date
// 路由: list,get,create,update,delete
// list filter 字段: type,status
// list 默认排序: -created

onBootstrap(function (e) {
  e.next()
  try {
    var existing = null
    try { existing = $app.findCollectionByNameOrId("devices") } catch (_) { existing = null }
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
      addField({ name: 'device_no', type: 'text', required: true })
      addField({ name: 'type', type: 'text', max: 20 })
      addField({ name: 'status', type: 'text', max: 20 })
      addField({ name: 'power', type: 'number' })
      addField({ name: 'texts_today', type: 'number' })
      addField({ name: 'last_online_at', type: 'date' })
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
        try { $app.logger().info("devices collection upgraded") } catch (_) {}
      }
    } else {
      var col = new Collection({
        type: "base",
        name: "devices",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [
          { name: 'device_no', type: 'text', required: true },
          { name: 'type', type: 'text', max: 20 },
          { name: 'status', type: 'text', max: 20 },
          { name: 'power', type: 'number' },
          { name: 'texts_today', type: 'number' },
          { name: 'last_online_at', type: 'date' },
          { name: "created", type: "autodate", onCreate: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      })
      $app.save(col)
      try { $app.logger().info("devices collection created") } catch (_) {}
    }
  } catch (err) {
    try { $app.logger().error("devices bootstrap: " + String(err && err.message || err)) } catch (_) {}
  }
})

// GET /api/devices?page=1&perPage=50&sort=-created&type=...&status=...

// 匿名 CRUD 路由已由 pocketbase/pb_hooks/business.pb.js 统一守卫路由替代。
