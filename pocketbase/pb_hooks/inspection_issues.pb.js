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
      if (changed) {
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
routerAdd("GET", "/api/inspection_issues", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("inspection_issues") } catch (_) {}
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
    return $app.findCollectionByNameOrId("inspection_issues")
  }
  try {
    ensureCollLocal()
    var info = e.requestInfo()
    var query = info.query || {}
    var page = parseInt(String(query.page || "1"), 10) || 1
    var perPage = parseInt(String(query.perPage || "50"), 10) || 50
    if (perPage > 200) perPage = 200
    var sort = String(query.sort || "-occurred_at")
    var filterParts = []
    var params = {}
    if (query.store !== undefined && query.store !== "") {
      filterParts.push("store = {:store}")
      params.store = String(query.store)
    }
    if (query.employee !== undefined && query.employee !== "") {
      filterParts.push("employee = {:employee}")
      params.employee = String(query.employee)
    }
    if (query.risk !== undefined && query.risk !== "") {
      filterParts.push("risk = {:risk}")
      params.risk = String(query.risk)
    }
    if (query.state !== undefined && query.state !== "") {
      filterParts.push("state = {:state}")
      params.state = String(query.state)
    }
    if (query.issue_type !== undefined && query.issue_type !== "") {
      filterParts.push("issue_type = {:issue_type}")
      params.issue_type = String(query.issue_type)
    }
    var filter = filterParts.length > 0 ? filterParts.join(" && ") : ""
    var records = filter
      ? $app.findRecordsByFilter("inspection_issues", filter, sort, perPage, (page - 1) * perPage, params)
      : $app.findRecordsByFilter("inspection_issues", "", sort, perPage, (page - 1) * perPage)
    var items = []
    for (var i = 0; i < records.length; i++) {
      items.push(records[i].publicExport())
    }
    return e.json(200, { items: items, page: page, perPage: perPage, totalItems: items.length })
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("inspection_issues list: " + msg) } catch (_) {}
    return e.json(500, { error: "list_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// GET /api/inspection_issues/{id}
routerAdd("GET", "/api/inspection_issues/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("inspection_issues", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "get_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// POST /api/inspection_issues  body 字段: transcript, employee, store, issue_type, risk, state, quote, advice, occurred_at
routerAdd("POST", "/api/inspection_issues", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("inspection_issues") } catch (_) {}
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
    return $app.findCollectionByNameOrId("inspection_issues")
  }
  try {
    var coll = ensureCollLocal()
    var body = e.requestInfo().body || {}
    var rec = new Record(coll)
    rec.set("transcript", body.transcript === undefined || body.transcript === null ? "" : String(body.transcript))
    rec.set("employee", body.employee === undefined || body.employee === null ? "" : String(body.employee))
    rec.set("store", body.store === undefined || body.store === null ? "" : String(body.store))
    rec.set("issue_type", body.issue_type === undefined || body.issue_type === null ? "" : String(body.issue_type))
    rec.set("risk", body.risk === undefined || body.risk === null ? "" : String(body.risk))
    rec.set("state", body.state === undefined || body.state === null ? "" : String(body.state))
    rec.set("quote", body.quote === undefined || body.quote === null ? "" : String(body.quote))
    rec.set("advice", body.advice === undefined || body.advice === null ? "" : String(body.advice))
    rec.set("occurred_at", body.occurred_at === undefined || body.occurred_at === null ? "" : String(body.occurred_at))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("inspection_issues create: " + msg) } catch (_) {}
    return e.json(500, { error: "create_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// PATCH /api/inspection_issues/{id}  body 字段同 POST, 只更新 body 里出现的字段
routerAdd("PATCH", "/api/inspection_issues/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("inspection_issues", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    var body = e.requestInfo().body || {}
    if ("transcript" in body) rec.set("transcript", body.transcript === undefined || body.transcript === null ? "" : String(body.transcript))
    if ("employee" in body) rec.set("employee", body.employee === undefined || body.employee === null ? "" : String(body.employee))
    if ("store" in body) rec.set("store", body.store === undefined || body.store === null ? "" : String(body.store))
    if ("issue_type" in body) rec.set("issue_type", body.issue_type === undefined || body.issue_type === null ? "" : String(body.issue_type))
    if ("risk" in body) rec.set("risk", body.risk === undefined || body.risk === null ? "" : String(body.risk))
    if ("state" in body) rec.set("state", body.state === undefined || body.state === null ? "" : String(body.state))
    if ("quote" in body) rec.set("quote", body.quote === undefined || body.quote === null ? "" : String(body.quote))
    if ("advice" in body) rec.set("advice", body.advice === undefined || body.advice === null ? "" : String(body.advice))
    if ("occurred_at" in body) rec.set("occurred_at", body.occurred_at === undefined || body.occurred_at === null ? "" : String(body.occurred_at))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "update_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// DELETE /api/inspection_issues/{id}
routerAdd("DELETE", "/api/inspection_issues/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("inspection_issues", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    $app.delete(rec)
    return e.json(200, { ok: true })
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "delete_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
