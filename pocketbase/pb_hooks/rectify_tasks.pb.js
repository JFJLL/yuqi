/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/rectify_tasks.pb.js — 业务 collection + REST CRUD 路由 (self-contained)
//
// 由 mcp__rh-pb-hooks__install_business_collection 装. 不要直接 Read+Write 这个文件.
// 业务字段: title:text, owner:relation, store:relation, source_issue:relation, due_date:date, progress:number, state:text
// 路由: list,get,create,update,delete
// list filter 字段: store,owner,state
// list 默认排序: -due_date

onBootstrap(function (e) {
  e.next()
  try {
    var existing = null
    try { existing = $app.findCollectionByNameOrId("rectify_tasks") } catch (_) { existing = null }
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
      addField({ name: 'title', type: 'text', required: true, max: 200 })
      addField({ name: 'owner', type: 'relation', max: 1, collectionId: 'employees' })
      addField({ name: 'store', type: 'relation', max: 1, collectionId: 'stores' })
      addField({ name: 'source_issue', type: 'relation', max: 1, collectionId: 'inspection_issues' })
      addField({ name: 'due_date', type: 'date' })
      addField({ name: 'progress', type: 'number' })
      addField({ name: 'state', type: 'text', max: 20 })
      addField({ name: "created", type: "autodate", onCreate: true })
      addField({ name: "updated", type: "autodate", onCreate: true, onUpdate: true })
      if (changed) {
        $app.save(existing)
        try { $app.logger().info("rectify_tasks collection upgraded") } catch (_) {}
      }
    } else {
      var col = new Collection({
        type: "base",
        name: "rectify_tasks",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [
          { name: 'title', type: 'text', required: true, max: 200 },
          { name: 'owner', type: 'relation', max: 1, collectionId: 'employees' },
          { name: 'store', type: 'relation', max: 1, collectionId: 'stores' },
          { name: 'source_issue', type: 'relation', max: 1, collectionId: 'inspection_issues' },
          { name: 'due_date', type: 'date' },
          { name: 'progress', type: 'number' },
          { name: 'state', type: 'text', max: 20 },
          { name: "created", type: "autodate", onCreate: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      })
      $app.save(col)
      try { $app.logger().info("rectify_tasks collection created") } catch (_) {}
    }
  } catch (err) {
    try { $app.logger().error("rectify_tasks bootstrap: " + String(err && err.message || err)) } catch (_) {}
  }
})

// GET /api/rectify_tasks?page=1&perPage=50&sort=-created&store=...&owner=...&state=...
routerAdd("GET", "/api/rectify_tasks", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("rectify_tasks") } catch (_) {}
    var col = new Collection({
      type: "base",
      name: "rectify_tasks",
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      fields: [
          { name: 'title', type: 'text', required: true, max: 200 },
          { name: 'owner', type: 'relation', max: 1, collectionId: 'employees' },
          { name: 'store', type: 'relation', max: 1, collectionId: 'stores' },
          { name: 'source_issue', type: 'relation', max: 1, collectionId: 'inspection_issues' },
          { name: 'due_date', type: 'date' },
          { name: 'progress', type: 'number' },
          { name: 'state', type: 'text', max: 20 },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    })
    $app.save(col)
    return $app.findCollectionByNameOrId("rectify_tasks")
  }
  try {
    ensureCollLocal()
    var info = e.requestInfo()
    var query = info.query || {}
    var page = parseInt(String(query.page || "1"), 10) || 1
    var perPage = parseInt(String(query.perPage || "50"), 10) || 50
    if (perPage > 200) perPage = 200
    var sort = String(query.sort || "-due_date")
    var filterParts = []
    var params = {}
    if (query.store !== undefined && query.store !== "") {
      filterParts.push("store = {:store}")
      params.store = String(query.store)
    }
    if (query.owner !== undefined && query.owner !== "") {
      filterParts.push("owner = {:owner}")
      params.owner = String(query.owner)
    }
    if (query.state !== undefined && query.state !== "") {
      filterParts.push("state = {:state}")
      params.state = String(query.state)
    }
    var filter = filterParts.length > 0 ? filterParts.join(" && ") : ""
    var records = filter
      ? $app.findRecordsByFilter("rectify_tasks", filter, sort, perPage, (page - 1) * perPage, params)
      : $app.findRecordsByFilter("rectify_tasks", "", sort, perPage, (page - 1) * perPage)
    var items = []
    for (var i = 0; i < records.length; i++) {
      items.push(records[i].publicExport())
    }
    return e.json(200, { items: items, page: page, perPage: perPage, totalItems: items.length })
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("rectify_tasks list: " + msg) } catch (_) {}
    return e.json(500, { error: "list_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// GET /api/rectify_tasks/{id}
routerAdd("GET", "/api/rectify_tasks/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("rectify_tasks", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "get_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// POST /api/rectify_tasks  body 字段: title, owner, store, source_issue, due_date, progress, state
routerAdd("POST", "/api/rectify_tasks", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("rectify_tasks") } catch (_) {}
    var col = new Collection({
      type: "base",
      name: "rectify_tasks",
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      fields: [
          { name: 'title', type: 'text', required: true, max: 200 },
          { name: 'owner', type: 'relation', max: 1, collectionId: 'employees' },
          { name: 'store', type: 'relation', max: 1, collectionId: 'stores' },
          { name: 'source_issue', type: 'relation', max: 1, collectionId: 'inspection_issues' },
          { name: 'due_date', type: 'date' },
          { name: 'progress', type: 'number' },
          { name: 'state', type: 'text', max: 20 },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    })
    $app.save(col)
    return $app.findCollectionByNameOrId("rectify_tasks")
  }
  try {
    var coll = ensureCollLocal()
    var body = e.requestInfo().body || {}
    var rec = new Record(coll)
    rec.set("title", body.title === undefined || body.title === null ? "" : String(body.title))
    rec.set("owner", body.owner === undefined || body.owner === null ? "" : String(body.owner))
    rec.set("store", body.store === undefined || body.store === null ? "" : String(body.store))
    rec.set("source_issue", body.source_issue === undefined || body.source_issue === null ? "" : String(body.source_issue))
    rec.set("due_date", body.due_date === undefined || body.due_date === null ? "" : String(body.due_date))
    rec.set("progress", (body.progress === undefined || body.progress === null) ? 0 : Number(body.progress))
    rec.set("state", body.state === undefined || body.state === null ? "" : String(body.state))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("rectify_tasks create: " + msg) } catch (_) {}
    return e.json(500, { error: "create_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// PATCH /api/rectify_tasks/{id}  body 字段同 POST, 只更新 body 里出现的字段
routerAdd("PATCH", "/api/rectify_tasks/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("rectify_tasks", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    var body = e.requestInfo().body || {}
    if ("title" in body) rec.set("title", body.title === undefined || body.title === null ? "" : String(body.title))
    if ("owner" in body) rec.set("owner", body.owner === undefined || body.owner === null ? "" : String(body.owner))
    if ("store" in body) rec.set("store", body.store === undefined || body.store === null ? "" : String(body.store))
    if ("source_issue" in body) rec.set("source_issue", body.source_issue === undefined || body.source_issue === null ? "" : String(body.source_issue))
    if ("due_date" in body) rec.set("due_date", body.due_date === undefined || body.due_date === null ? "" : String(body.due_date))
    if ("progress" in body) rec.set("progress", (body.progress === undefined || body.progress === null) ? 0 : Number(body.progress))
    if ("state" in body) rec.set("state", body.state === undefined || body.state === null ? "" : String(body.state))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "update_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// DELETE /api/rectify_tasks/{id}
routerAdd("DELETE", "/api/rectify_tasks/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("rectify_tasks", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    $app.delete(rec)
    return e.json(200, { ok: true })
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "delete_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
