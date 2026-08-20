/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/asr_jobs.pb.js — ASR 任务元数据与轻量 CRUD 路由。
// 不在 PocketBase hook 内执行上传转发、远程轮询或 ASR 推理；这些工作由云端 asr-gateway 完成。

var ASR_JOB_STATUS = ["queued", "running", "succeeded", "failed"]

function asrJobFields() {
  return [
    { name: "remote_job_id", type: "text", max: 40 },
    { name: "transcript", type: "text", max: 20 },
    { name: "status", type: "text", max: 20 },
    { name: "device", type: "text", max: 60 },
    { name: "employee", type: "relation", max: 1, collectionId: "employees" },
    { name: "store", type: "relation", max: 1, collectionId: "stores" },
    { name: "audio_name", type: "text", max: 180 },
    { name: "audio_size", type: "number" },
    { name: "audio_sha256", type: "text", max: 64 },
    { name: "metadata_json", type: "json" },
    { name: "submitted_at", type: "date" },
    { name: "started_at", type: "date" },
    { name: "finished_at", type: "date" },
    { name: "last_polled_at", type: "date" },
    { name: "result_imported_at", type: "date" },
    { name: "occurred_at", type: "date" },
    { name: "attempts", type: "number" },
    { name: "error_code", type: "text", max: 80 },
    { name: "error_message", type: "text", max: 1000 },
    { name: "created", type: "autodate", onCreate: true },
    { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
  ]
}

function ensureAsrJobsCollection() {
  var existing = null
  try { existing = $app.findCollectionByNameOrId("asr_jobs") } catch (_) { existing = null }
  if (!existing) {
    var created = new Collection({
      type: "base",
      name: "asr_jobs",
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      fields: asrJobFields(),
    })
    $app.save(created)
    return $app.findCollectionByNameOrId("asr_jobs")
  }
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
  var fields = asrJobFields()
  for (var i = 0; i < fields.length; i++) {
    if (hasField(fields[i].name)) continue
    try { existing.fields.add(new Field(fields[i])); changed = true } catch (_) {}
  }
  if (changed) $app.save(existing)
  return $app.findCollectionByNameOrId("asr_jobs")
}

function asrJobStatus(value) {
  var normalized = String(value || "queued").toLowerCase()
  if (ASR_JOB_STATUS.indexOf(normalized) < 0) throw new Error("invalid ASR job status")
  return normalized
}

function asrJobString(value, max) {
  return value === undefined || value === null ? "" : String(value).slice(0, max)
}

function asrJobNumber(value, fallback) {
  var number = Number(value)
  return isFinite(number) && number >= 0 ? number : fallback
}

function asrJobSet(record, body, partial) {
  if (!partial || "remote_job_id" in body) record.set("remote_job_id", asrJobString(body.remote_job_id, 40))
  if (!partial || "transcript" in body) record.set("transcript", asrJobString(body.transcript, 20))
  if (!partial || "status" in body) record.set("status", asrJobStatus(body.status))
  if (!partial || "device" in body) record.set("device", asrJobString(body.device, 60))
  if (!partial || "employee" in body) record.set("employee", asrJobString(body.employee, 20))
  if (!partial || "store" in body) record.set("store", asrJobString(body.store, 20))
  if (!partial || "audio_name" in body) record.set("audio_name", asrJobString(body.audio_name, 180))
  if (!partial || "audio_size" in body) record.set("audio_size", asrJobNumber(body.audio_size, 0))
  if (!partial || "audio_sha256" in body) record.set("audio_sha256", asrJobString(body.audio_sha256, 64))
  if (!partial || "metadata_json" in body) record.set("metadata_json", body.metadata_json === undefined || body.metadata_json === null ? {} : body.metadata_json)
  if (!partial || "submitted_at" in body) record.set("submitted_at", asrJobString(body.submitted_at, 40))
  if (!partial || "started_at" in body) record.set("started_at", asrJobString(body.started_at, 40))
  if (!partial || "finished_at" in body) record.set("finished_at", asrJobString(body.finished_at, 40))
  if (!partial || "last_polled_at" in body) record.set("last_polled_at", asrJobString(body.last_polled_at, 40))
  if (!partial || "result_imported_at" in body) record.set("result_imported_at", asrJobString(body.result_imported_at, 40))
  if (!partial || "occurred_at" in body) record.set("occurred_at", asrJobString(body.occurred_at, 40))
  if (!partial || "attempts" in body) record.set("attempts", asrJobNumber(body.attempts, 0))
  if (!partial || "error_code" in body) record.set("error_code", asrJobString(body.error_code, 80))
  if (!partial || "error_message" in body) record.set("error_message", asrJobString(body.error_message, 1000))
}

onBootstrap(function (e) {
  e.next()
  try { ensureAsrJobsCollection() } catch (err) {
    try { $app.logger().error("asr_jobs bootstrap: " + String(err && err.message || err)) } catch (_) {}
  }
})

// GET /api/asr_jobs?page=1&perPage=50&status=queued&active=1&transcript=...
routerAdd("GET", "/api/asr_jobs", function (e) {
  try {
    ensureAsrJobsCollection()
    var query = e.requestInfo().query || {}
    var page = parseInt(String(query.page || "1"), 10) || 1
    var perPage = parseInt(String(query.perPage || "50"), 10) || 50
    if (perPage > 200) perPage = 200
    var sort = String(query.sort || "-created")
    var filterParts = []
    var params = {}
    if (query.status !== undefined && query.status !== "") {
      filterParts.push("status = {:status}")
      params.status = asrJobStatus(query.status)
    }
    if (String(query.active || "") === "1") {
      filterParts.push("(status = 'queued' || status = 'running')")
    }
    if (query.transcript !== undefined && query.transcript !== "") {
      filterParts.push("transcript = {:transcript}")
      params.transcript = String(query.transcript)
    }
    var filter = filterParts.join(" && ")
    var records = filter
      ? $app.findRecordsByFilter("asr_jobs", filter, sort, perPage, (page - 1) * perPage, params)
      : $app.findRecordsByFilter("asr_jobs", "", sort, perPage, (page - 1) * perPage)
    var items = []
    for (var i = 0; i < records.length; i++) items.push(records[i].publicExport())
    return e.json(200, { items: items, page: page, perPage: perPage, totalItems: items.length })
  } catch (err) {
    return e.json(500, { error: "list_failed", message: String(err && err.message || err).slice(0, 300) })
  }
})

routerAdd("GET", "/api/asr_jobs/{id}", function (e) {
  try {
    ensureAsrJobsCollection()
    var rec = $app.findRecordById("asr_jobs", e.request.pathValue("id"))
    return e.json(200, rec.publicExport())
  } catch (err) {
    return e.json(404, { error: "not_found", message: String(err && err.message || err).slice(0, 300) })
  }
})

routerAdd("POST", "/api/asr_jobs", function (e) {
  try {
    var collection = ensureAsrJobsCollection()
    var body = e.requestInfo().body || {}
    if (!/^[0-9a-f]{32}$/i.test(String(body.remote_job_id || ""))) return e.json(400, { error: "remote_job_id_required" })
    if (!String(body.transcript || "")) return e.json(400, { error: "transcript_required" })
    var rec = new Record(collection)
    asrJobSet(rec, body, false)
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    return e.json(500, { error: "create_failed", message: String(err && err.message || err).slice(0, 300) })
  }
})

routerAdd("PATCH", "/api/asr_jobs/{id}", function (e) {
  try {
    ensureAsrJobsCollection()
    var rec = $app.findRecordById("asr_jobs", e.request.pathValue("id"))
    asrJobSet(rec, e.requestInfo().body || {}, true)
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    return e.json(500, { error: "update_failed", message: String(err && err.message || err).slice(0, 300) })
  }
})
