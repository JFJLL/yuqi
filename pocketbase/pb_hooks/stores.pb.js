/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/stores.pb.js — 业务 collection + REST CRUD 路由 (self-contained)
//
// 由 mcp__rh-pb-hooks__install_business_collection 装. 不要直接 Read+Write 这个文件.
// 业务字段: name:text, region:relation, address:text
// 路由: list,get,create,update,delete
// list filter 字段: region
// list 默认排序: -created

onBootstrap(function (e) {
  e.next()
  try {
    var existing = null
    try { existing = $app.findCollectionByNameOrId("stores") } catch (_) { existing = null }
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
      addField({ name: 'name', type: 'text', required: true, max: 80 })
      addField({ name: 'region', type: 'relation', max: 1, collectionId: 'regions' })
      addField({ name: 'address', type: 'text', max: 200 })
      addField({ name: "created", type: "autodate", onCreate: true })
      addField({ name: "updated", type: "autodate", onCreate: true, onUpdate: true })
      if (changed) {
        $app.save(existing)
        try { $app.logger().info("stores collection upgraded") } catch (_) {}
      }
    } else {
      var col = new Collection({
        type: "base",
        name: "stores",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [
          { name: 'name', type: 'text', required: true, max: 80 },
          { name: 'region', type: 'relation', max: 1, collectionId: 'regions' },
          { name: 'address', type: 'text', max: 200 },
          { name: "created", type: "autodate", onCreate: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      })
      $app.save(col)
      try { $app.logger().info("stores collection created") } catch (_) {}
    }
  } catch (err) {
    try { $app.logger().error("stores bootstrap: " + String(err && err.message || err)) } catch (_) {}
  }
})

// GET /api/stores?page=1&perPage=50&sort=-created&region=...
routerAdd("GET", "/api/stores", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("stores") } catch (_) {}
    var col = new Collection({
      type: "base",
      name: "stores",
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      fields: [
          { name: 'name', type: 'text', required: true, max: 80 },
          { name: 'region', type: 'relation', max: 1, collectionId: 'regions' },
          { name: 'address', type: 'text', max: 200 },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    })
    $app.save(col)
    return $app.findCollectionByNameOrId("stores")
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
    if (query.region !== undefined && query.region !== "") {
      filterParts.push("region = {:region}")
      params.region = String(query.region)
    }
    var filter = filterParts.length > 0 ? filterParts.join(" && ") : ""
    var records = filter
      ? $app.findRecordsByFilter("stores", filter, sort, perPage, (page - 1) * perPage, params)
      : $app.findRecordsByFilter("stores", "", sort, perPage, (page - 1) * perPage)
    var items = []
    for (var i = 0; i < records.length; i++) {
      items.push(records[i].publicExport())
    }
    return e.json(200, { items: items, page: page, perPage: perPage, totalItems: items.length })
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("stores list: " + msg) } catch (_) {}
    return e.json(500, { error: "list_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// GET /api/stores/{id}
routerAdd("GET", "/api/stores/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("stores", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "get_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// POST /api/stores  body 字段: name, region, address
routerAdd("POST", "/api/stores", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("stores") } catch (_) {}
    var col = new Collection({
      type: "base",
      name: "stores",
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      fields: [
          { name: 'name', type: 'text', required: true, max: 80 },
          { name: 'region', type: 'relation', max: 1, collectionId: 'regions' },
          { name: 'address', type: 'text', max: 200 },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    })
    $app.save(col)
    return $app.findCollectionByNameOrId("stores")
  }
  try {
    var coll = ensureCollLocal()
    var body = e.requestInfo().body || {}
    var rec = new Record(coll)
    rec.set("name", body.name === undefined || body.name === null ? "" : String(body.name))
    rec.set("region", body.region === undefined || body.region === null ? "" : String(body.region))
    rec.set("address", body.address === undefined || body.address === null ? "" : String(body.address))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("stores create: " + msg) } catch (_) {}
    return e.json(500, { error: "create_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// PATCH /api/stores/{id}  body 字段同 POST, 只更新 body 里出现的字段
routerAdd("PATCH", "/api/stores/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("stores", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    var body = e.requestInfo().body || {}
    if ("name" in body) rec.set("name", body.name === undefined || body.name === null ? "" : String(body.name))
    if ("region" in body) rec.set("region", body.region === undefined || body.region === null ? "" : String(body.region))
    if ("address" in body) rec.set("address", body.address === undefined || body.address === null ? "" : String(body.address))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "update_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// DELETE /api/stores/{id}
routerAdd("DELETE", "/api/stores/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("stores", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    $app.delete(rec)
    return e.json(200, { ok: true })
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "delete_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
