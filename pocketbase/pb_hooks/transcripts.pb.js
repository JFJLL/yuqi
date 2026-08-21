/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/transcripts.pb.js — 业务 collection + REST CRUD 路由 (self-contained)
//
// 由 mcp__rh-pb-hooks__install_business_collection 装. 不要直接 Read+Write 这个文件.
// 业务字段: device:text, employee:relation, store:relation, summary:text, full_text:text, segments_json:json, asr_job:text, asr_status:text, model:text, audio_name:text, qc_result:text, occurred_at:date
// 路由: list,get,create,update,delete
// list filter 字段: store,employee,qc_result
// list 默认排序: -occurred_at

// PocketBase relation fields require collection IDs, not collection names.
// These IDs are declared by pocketbase/pb_migrations/*_created_{employees,stores}.js.

onBootstrap(function (e) {
  e.next()
  try {
    var existing = null
    try { existing = $app.findCollectionByNameOrId("transcripts") } catch (_) { existing = null }
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
      addField({ name: 'device', type: 'text', max: 60 })
      addField({ name: 'employee', type: 'relation', max: 1, collectionId: 'pbc_3735627160' })
      addField({ name: 'store', type: 'relation', max: 1, collectionId: 'pbc_3800236418' })
      addField({ name: 'summary', type: 'text', max: 500 })
      addField({ name: 'full_text', type: 'text', max: 100000 })
      addField({ name: 'segments_json', type: 'json' })
      addField({ name: 'asr_job', type: 'text', max: 20 })
      addField({ name: 'asr_status', type: 'text', max: 20 })
      addField({ name: 'model', type: 'text', max: 80 })
      addField({ name: 'audio_name', type: 'text', max: 180 })
      try {
        var fullTextField = existing.fields.getByName('full_text')
        if (fullTextField && Number(fullTextField.max || 0) < 100000) { fullTextField.max = 100000; changed = true }
      } catch (_) {}
      addField({ name: 'qc_result', type: 'text', max: 20 })
      addField({ name: 'occurred_at', type: 'date' })
      // 记录来源：manual=后台上传, oss_auto=OSS 自动采集。空值视为 manual。
      addField({ name: 'source', type: 'text', max: 20 })
      addField({ name: 'speaker_aliases', type: 'json' })
      addField({ name: 'marks_json', type: 'json' })
      addField({ name: "created", type: "autodate", onCreate: true })
      addField({ name: "updated", type: "autodate", onCreate: true, onUpdate: true })
      if (changed) {
        $app.save(existing)
        try { $app.logger().info("transcripts collection upgraded") } catch (_) {}
      }
    } else {
      var col = new Collection({
        type: "base",
        name: "transcripts",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [
          { name: 'device', type: 'text', max: 60 },
          { name: 'employee', type: 'relation', max: 1, collectionId: 'pbc_3735627160' },
          { name: 'store', type: 'relation', max: 1, collectionId: 'pbc_3800236418' },
          { name: 'summary', type: 'text', max: 500 },
          { name: 'full_text', type: 'text', max: 100000 },
          { name: 'segments_json', type: 'json' },
          { name: 'asr_job', type: 'text', max: 20 },
          { name: 'asr_status', type: 'text', max: 20 },
          { name: 'model', type: 'text', max: 80 },
          { name: 'audio_name', type: 'text', max: 180 },
          { name: 'qc_result', type: 'text', max: 20 },
          { name: 'occurred_at', type: 'date' },
          { name: 'source', type: 'text', max: 20 },
          { name: 'speaker_aliases', type: 'json' },
          { name: 'marks_json', type: 'json' },
         { name: "created", type: "autodate", onCreate: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      })
      $app.save(col)
      try { $app.logger().info("transcripts collection created") } catch (_) {}
    }
  } catch (err) {
    try { $app.logger().error("transcripts bootstrap: " + String(err && err.message || err)) } catch (_) {}
  }
})

// GET /api/transcripts?page=1&perPage=50&sort=-created&store=...&employee=...&qc_result=...
routerAdd("GET", "/api/transcripts", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("transcripts") } catch (_) {}
    var col = new Collection({
      type: "base",
      name: "transcripts",
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      fields: [
          { name: 'device', type: 'text', max: 60 },
          { name: 'employee', type: 'relation', max: 1, collectionId: 'pbc_3735627160' },
          { name: 'store', type: 'relation', max: 1, collectionId: 'pbc_3800236418' },
          { name: 'summary', type: 'text', max: 500 },
          { name: 'full_text', type: 'text', max: 100000 },
          { name: 'segments_json', type: 'json' },
          { name: 'asr_job', type: 'text', max: 20 },
          { name: 'asr_status', type: 'text', max: 20 },
          { name: 'model', type: 'text', max: 80 },
          { name: 'audio_name', type: 'text', max: 180 },
           { name: 'qc_result', type: 'text', max: 20 },
           { name: 'occurred_at', type: 'date' },
           { name: 'source', type: 'text', max: 20 },
           { name: 'speaker_aliases', type: 'json' },
           { name: 'marks_json', type: 'json' },
         { name: "created", type: "autodate", onCreate: true },
         { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
       ],
     })
     $app.save(col)
     return $app.findCollectionByNameOrId("transcripts")
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
     if (query.qc_result !== undefined && query.qc_result !== "") {
       filterParts.push("qc_result = {:qc_result}")
       params.qc_result = String(query.qc_result)
     }
     var filter = filterParts.length > 0 ? filterParts.join(" && ") : ""
     var records = filter
       ? $app.findRecordsByFilter("transcripts", filter, sort, perPage, (page - 1) * perPage, params)
       : $app.findRecordsByFilter("transcripts", "", sort, perPage, (page - 1) * perPage)
     var items = []
     for (var i = 0; i < records.length; i++) {
       items.push(records[i].publicExport())
     }
     return e.json(200, { items: items, page: page, perPage: perPage, totalItems: items.length })
   } catch (err) {
     var msg = String(err && err.message || err)
     try { $app.logger().error("transcripts list: " + msg) } catch (_) {}
     return e.json(500, { error: "list_failed", message: msg, fingerprint: msg.substring(0, 80) })
   }
})
// GET /api/transcripts/{id}
routerAdd("GET", "/api/transcripts/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("transcripts", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "get_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// POST /api/transcripts  body 字段: device, employee, store, summary, full_text, qc_result, occurred_at
routerAdd("POST", "/api/transcripts", function (e) {
  function ensureCollLocal() {
    try { return $app.findCollectionByNameOrId("transcripts") } catch (_) {}
    var col = new Collection({
      type: "base",
      name: "transcripts",
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      fields: [
          { name: 'device', type: 'text', max: 60 },
          { name: 'employee', type: 'relation', max: 1, collectionId: 'pbc_3735627160' },
          { name: 'store', type: 'relation', max: 1, collectionId: 'pbc_3800236418' },
          { name: 'summary', type: 'text', max: 500 },
          { name: 'full_text', type: 'text', max: 100000 },
          { name: 'segments_json', type: 'json' },
          { name: 'asr_job', type: 'text', max: 20 },
          { name: 'asr_status', type: 'text', max: 20 },
          { name: 'model', type: 'text', max: 80 },
          { name: 'audio_name', type: 'text', max: 180 },
           { name: 'qc_result', type: 'text', max: 20 },
           { name: 'occurred_at', type: 'date' },
           { name: 'source', type: 'text', max: 20 },
           { name: 'speaker_aliases', type: 'json' },
           { name: 'marks_json', type: 'json' },
         { name: "created", type: "autodate", onCreate: true },
         { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
       ],
     })
     $app.save(col)
     return $app.findCollectionByNameOrId("transcripts")
   }
   try {
     var coll = ensureCollLocal()
     var body = e.requestInfo().body || {}
     var rec = new Record(coll)
     rec.set("device", body.device === undefined || body.device === null ? "" : String(body.device))
     rec.set("employee", body.employee === undefined || body.employee === null ? "" : String(body.employee))
     rec.set("store", body.store === undefined || body.store === null ? "" : String(body.store))
     rec.set("summary", body.summary === undefined || body.summary === null ? "" : String(body.summary))
     rec.set("full_text", body.full_text === undefined || body.full_text === null ? "" : String(body.full_text))
     rec.set("segments_json", body.segments_json === undefined || body.segments_json === null ? [] : body.segments_json)
     rec.set("asr_job", body.asr_job === undefined || body.asr_job === null ? "" : String(body.asr_job))
     rec.set("asr_status", body.asr_status === undefined || body.asr_status === null ? "" : String(body.asr_status))
     rec.set("model", body.model === undefined || body.model === null ? "" : String(body.model))
     rec.set("audio_name", body.audio_name === undefined || body.audio_name === null ? "" : String(body.audio_name))
     rec.set("qc_result", body.qc_result === undefined || body.qc_result === null ? "" : String(body.qc_result))
     rec.set("occurred_at", body.occurred_at === undefined || body.occurred_at === null ? "" : String(body.occurred_at))
     rec.set("source", body.source === undefined || body.source === null ? "" : String(body.source).slice(0, 20))
     rec.set("speaker_aliases", body.speaker_aliases === undefined || body.speaker_aliases === null ? {} : body.speaker_aliases)
     rec.set("marks_json", body.marks_json === undefined || body.marks_json === null ? [] : body.marks_json)
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    try { $app.logger().error("transcripts create: " + msg) } catch (_) {}
    return e.json(500, { error: "create_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// PATCH /api/transcripts/{id}  body 字段同 POST, 只更新 body 里出现的字段
routerAdd("PATCH", "/api/transcripts/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("transcripts", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    var body = e.requestInfo().body || {}
    if ("device" in body) rec.set("device", body.device === undefined || body.device === null ? "" : String(body.device))
    if ("employee" in body) rec.set("employee", body.employee === undefined || body.employee === null ? "" : String(body.employee))
    if ("store" in body) rec.set("store", body.store === undefined || body.store === null ? "" : String(body.store))
    if ("summary" in body) rec.set("summary", body.summary === undefined || body.summary === null ? "" : String(body.summary))
    if ("full_text" in body) rec.set("full_text", body.full_text === undefined || body.full_text === null ? "" : String(body.full_text))
    if ("segments_json" in body) rec.set("segments_json", body.segments_json === undefined || body.segments_json === null ? [] : body.segments_json)
    if ("asr_job" in body) rec.set("asr_job", body.asr_job === undefined || body.asr_job === null ? "" : String(body.asr_job))
    if ("asr_status" in body) rec.set("asr_status", body.asr_status === undefined || body.asr_status === null ? "" : String(body.asr_status))
    if ("model" in body) rec.set("model", body.model === undefined || body.model === null ? "" : String(body.model))
    if ("audio_name" in body) rec.set("audio_name", body.audio_name === undefined || body.audio_name === null ? "" : String(body.audio_name))
    if ("qc_result" in body) rec.set("qc_result", body.qc_result === undefined || body.qc_result === null ? "" : String(body.qc_result))
    if ("occurred_at" in body) rec.set("occurred_at", body.occurred_at === undefined || body.occurred_at === null ? "" : String(body.occurred_at))
    if ("source" in body) rec.set("source", body.source === undefined || body.source === null ? "" : String(body.source).slice(0, 20))
    if ("speaker_aliases" in body) rec.set("speaker_aliases", body.speaker_aliases === undefined || body.speaker_aliases === null ? {} : body.speaker_aliases)
    if ("marks_json" in body) rec.set("marks_json", body.marks_json === undefined || body.marks_json === null ? [] : body.marks_json)
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "update_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
// DELETE /api/transcripts/{id}
routerAdd("DELETE", "/api/transcripts/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("transcripts", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    $app.delete(rec)
    return e.json(200, { ok: true })
  } catch (err) {
    var msg = String(err && err.message || err)
    return e.json(500, { error: "delete_failed", message: msg, fingerprint: msg.substring(0, 80) })
  }
})
