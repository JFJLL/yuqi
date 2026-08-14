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
      if (changed) {
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
routerAdd("GET", "/api/devices", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("devices") } catch (_) {}
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
    return $app.findCollectionByNameOrId("devices")
  }
  try {
    ensureCollLocal()
    var info = e.requestInfo()
    var query = info.query || {}
    var page = parseInt(String(query.page || "1"), 10) || 1
    var perPage = parseInt(String(query.perPage || "50"), 10) || 50
    if (perPage > 200) perPage = 200
    var sort = String(query.sort || "-created")
    var filterParts = []
    var params = {}
    if (query.type !== undefined && query.type !== "") {
      filterParts.push("type = {:type}")
      params.type = String(query.type)
    }
    if (query.status !== undefined && query.status !== "") {
      filterParts.push("status = {:status}")
      params.status = String(query.status)
    }
    var filter = filterParts.length > 0 ? filterParts.join(" && ") : ""
    var records = filter
      ? $app.findRecordsByFilter("devices", filter, sort, perPage, (page - 1) * perPage, params)
      : $app.findRecordsByFilter("devices", "", sort, perPage, (page - 1) * perPage)
    var items = []
    for (var i = 0; i < records.length; i++) {
      items.push(records[i].publicExport())
    }
    return e.json(200, { items: items, page: page, perPage: perPage, totalItems: items.length })
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("devices list: " + msg) } catch (_) {}
    return e.json(500, { error: "list_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// GET /api/devices/{id}
routerAdd("GET", "/api/devices/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("devices", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "get_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// POST /api/devices  body 字段: device_no, type, status, power, texts_today, last_online_at
routerAdd("POST", "/api/devices", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("devices") } catch (_) {}
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
    return $app.findCollectionByNameOrId("devices")
  }
  try {
    var coll = ensureCollLocal()
    var body = e.requestInfo().body || {}
    var rec = new Record(coll)
    rec.set("device_no", body.device_no === undefined || body.device_no === null ? "" : String(body.device_no))
    rec.set("type", body.type === undefined || body.type === null ? "" : String(body.type))
    rec.set("status", body.status === undefined || body.status === null ? "" : String(body.status))
    rec.set("power", (body.power === undefined || body.power === null) ? 0 : Number(body.power))
    rec.set("texts_today", (body.texts_today === undefined || body.texts_today === null) ? 0 : Number(body.texts_today))
    rec.set("last_online_at", body.last_online_at === undefined || body.last_online_at === null ? "" : String(body.last_online_at))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("devices create: " + msg) } catch (_) {}
    return e.json(500, { error: "create_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// PATCH /api/devices/{id}  body 字段同 POST, 只更新 body 里出现的字段
routerAdd("PATCH", "/api/devices/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("devices", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    var body = e.requestInfo().body || {}
    if ("device_no" in body) rec.set("device_no", body.device_no === undefined || body.device_no === null ? "" : String(body.device_no))
    if ("type" in body) rec.set("type", body.type === undefined || body.type === null ? "" : String(body.type))
    if ("status" in body) rec.set("status", body.status === undefined || body.status === null ? "" : String(body.status))
    if ("power" in body) rec.set("power", (body.power === undefined || body.power === null) ? 0 : Number(body.power))
    if ("texts_today" in body) rec.set("texts_today", (body.texts_today === undefined || body.texts_today === null) ? 0 : Number(body.texts_today))
    if ("last_online_at" in body) rec.set("last_online_at", body.last_online_at === undefined || body.last_online_at === null ? "" : String(body.last_online_at))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "update_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// DELETE /api/devices/{id}
routerAdd("DELETE", "/api/devices/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("devices", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    $app.delete(rec)
    return e.json(200, { ok: true })
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "delete_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
