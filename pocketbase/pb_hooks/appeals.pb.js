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
      if (changed) {
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
routerAdd("GET", "/api/appeals", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("appeals") } catch (_) {}
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
    return $app.findCollectionByNameOrId("appeals")
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
    if (query.issue !== undefined && query.issue !== "") {
      filterParts.push("issue = {:issue}")
      params.issue = String(query.issue)
    }
    if (query.status !== undefined && query.status !== "") {
      filterParts.push("status = {:status}")
      params.status = String(query.status)
    }
    var filter = filterParts.length > 0 ? filterParts.join(" && ") : ""
    var records = filter
      ? $app.findRecordsByFilter("appeals", filter, sort, perPage, (page - 1) * perPage, params)
      : $app.findRecordsByFilter("appeals", "", sort, perPage, (page - 1) * perPage)
    var items = []
    for (var i = 0; i < records.length; i++) {
      items.push(records[i].publicExport())
    }
    return e.json(200, { items: items, page: page, perPage: perPage, totalItems: items.length })
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("appeals list: " + msg) } catch (_) {}
    return e.json(500, { error: "list_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// GET /api/appeals/{id}
routerAdd("GET", "/api/appeals/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("appeals", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "get_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// POST /api/appeals  body 字段: issue, reason, status, reviewer, reviewed_at
routerAdd("POST", "/api/appeals", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("appeals") } catch (_) {}
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
    return $app.findCollectionByNameOrId("appeals")
  }
  try {
    var coll = ensureCollLocal()
    var body = e.requestInfo().body || {}
    var rec = new Record(coll)
    rec.set("issue", body.issue === undefined || body.issue === null ? "" : String(body.issue))
    rec.set("reason", body.reason === undefined || body.reason === null ? "" : String(body.reason))
    rec.set("status", body.status === undefined || body.status === null ? "" : String(body.status))
    rec.set("reviewer", body.reviewer === undefined || body.reviewer === null ? "" : String(body.reviewer))
    rec.set("reviewed_at", body.reviewed_at === undefined || body.reviewed_at === null ? "" : String(body.reviewed_at))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("appeals create: " + msg) } catch (_) {}
    return e.json(500, { error: "create_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// PATCH /api/appeals/{id}  body 字段同 POST, 只更新 body 里出现的字段
routerAdd("PATCH", "/api/appeals/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("appeals", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    var body = e.requestInfo().body || {}
    if ("issue" in body) rec.set("issue", body.issue === undefined || body.issue === null ? "" : String(body.issue))
    if ("reason" in body) rec.set("reason", body.reason === undefined || body.reason === null ? "" : String(body.reason))
    if ("status" in body) rec.set("status", body.status === undefined || body.status === null ? "" : String(body.status))
    if ("reviewer" in body) rec.set("reviewer", body.reviewer === undefined || body.reviewer === null ? "" : String(body.reviewer))
    if ("reviewed_at" in body) rec.set("reviewed_at", body.reviewed_at === undefined || body.reviewed_at === null ? "" : String(body.reviewed_at))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "update_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// DELETE /api/appeals/{id}
routerAdd("DELETE", "/api/appeals/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("appeals", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    $app.delete(rec)
    return e.json(200, { ok: true })
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "delete_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
