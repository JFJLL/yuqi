/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/asr_jobs.pb.js — ASR 任务元数据与轻量 CRUD 路由。
// 不在 PocketBase hook 内执行上传转发、远程轮询或 ASR 推理；这些工作由云端 asr-gateway 完成。
//
// PocketBase 会把 routerAdd 的回调隔离执行，因此路由回调不能依赖本文件
// 顶层声明的函数或变量。每个回调都保留自己的最小 schema/校验逻辑。

onBootstrap(function (e) {
  e.next()
  try {
    var existing = null
    try { existing = $app.findCollectionByNameOrId("asr_jobs") } catch (_) { existing = null }
    if (!existing) {
      var collection = new Collection({
        type: "base",
        name: "asr_jobs",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [
          { name: "remote_job_id", type: "text", max: 40 },
          { name: "transcript", type: "text", max: 20 },
          { name: "status", type: "text", max: 20 },
          { name: "device", type: "text", max: 60 },
          // ASR job metadata stores the source IDs as text. It should not
          // prevent the ASR queue from starting when business collections
          // were provisioned with different IDs.
          { name: "employee", type: "text", max: 40 },
          { name: "store", type: "text", max: 40 },
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
        ],
      })
      $app.save(collection)
      try { $app.logger().info("asr_jobs collection created") } catch (_) {}
    }
  } catch (err) {
    try { $app.logger().error("asr_jobs bootstrap: " + String(err && err.message || err)) } catch (_) {}
  }
})

// GET /api/asr_jobs?page=1&perPage=50&status=queued&active=1&transcript=...
routerAdd("GET", "/api/asr_jobs", function (e) {
  try {
    $app.findCollectionByNameOrId("asr_jobs")
    var query = e.requestInfo().query || {}
    var page = parseInt(String(query.page || "1"), 10) || 1
    var perPage = parseInt(String(query.perPage || "50"), 10) || 50
    if (perPage > 200) perPage = 200
    var sort = String(query.sort || "-created")
    var filterParts = []
    var params = {}
    if (query.status !== undefined && query.status !== "") {
      var status = String(query.status || "queued").toLowerCase()
      if (["queued", "running", "succeeded", "failed"].indexOf(status) < 0) {
        return e.json(400, { error: "invalid_status" })
      }
      filterParts.push("status = {:status}")
      params.status = status
    }
    if (String(query.active || "") === "1") filterParts.push("(status = 'queued' || status = 'running')")
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
    var rec = $app.findRecordById("asr_jobs", e.request.pathValue("id"))
    return e.json(200, rec.publicExport())
  } catch (err) {
    return e.json(404, { error: "not_found", message: String(err && err.message || err).slice(0, 300) })
  }
})

routerAdd("POST", "/api/asr_jobs", function (e) {
  try {
    var collection = $app.findCollectionByNameOrId("asr_jobs")
    var body = e.requestInfo().body || {}
    if (!/^[0-9a-f]{32}$/i.test(String(body.remote_job_id || ""))) return e.json(400, { error: "remote_job_id_required" })
    if (!String(body.transcript || "")) return e.json(400, { error: "transcript_required" })
    var status = String(body.status || "queued").toLowerCase()
    if (["queued", "running", "succeeded", "failed"].indexOf(status) < 0) return e.json(400, { error: "invalid_status" })
    var rec = new Record(collection)
    rec.set("remote_job_id", String(body.remote_job_id || "").slice(0, 40))
    rec.set("transcript", String(body.transcript || "").slice(0, 20))
    rec.set("status", status)
    rec.set("device", body.device === undefined || body.device === null ? "" : String(body.device).slice(0, 60))
    rec.set("employee", body.employee === undefined || body.employee === null ? "" : String(body.employee).slice(0, 20))
    rec.set("store", body.store === undefined || body.store === null ? "" : String(body.store).slice(0, 20))
    rec.set("audio_name", body.audio_name === undefined || body.audio_name === null ? "" : String(body.audio_name).slice(0, 180))
    var audioSize = Number(body.audio_size)
    rec.set("audio_size", audioSize >= 0 && isFinite(audioSize) ? audioSize : 0)
    rec.set("audio_sha256", body.audio_sha256 === undefined || body.audio_sha256 === null ? "" : String(body.audio_sha256).slice(0, 64))
    rec.set("metadata_json", body.metadata_json === undefined || body.metadata_json === null ? {} : body.metadata_json)
    rec.set("submitted_at", body.submitted_at === undefined || body.submitted_at === null ? "" : String(body.submitted_at).slice(0, 40))
    rec.set("started_at", body.started_at === undefined || body.started_at === null ? "" : String(body.started_at).slice(0, 40))
    rec.set("finished_at", body.finished_at === undefined || body.finished_at === null ? "" : String(body.finished_at).slice(0, 40))
    rec.set("last_polled_at", body.last_polled_at === undefined || body.last_polled_at === null ? "" : String(body.last_polled_at).slice(0, 40))
    rec.set("result_imported_at", body.result_imported_at === undefined || body.result_imported_at === null ? "" : String(body.result_imported_at).slice(0, 40))
    rec.set("occurred_at", body.occurred_at === undefined || body.occurred_at === null ? "" : String(body.occurred_at).slice(0, 40))
    var attempts = Number(body.attempts)
    rec.set("attempts", attempts >= 0 && isFinite(attempts) ? attempts : 0)
    rec.set("error_code", body.error_code === undefined || body.error_code === null ? "" : String(body.error_code).slice(0, 80))
    rec.set("error_message", body.error_message === undefined || body.error_message === null ? "" : String(body.error_message).slice(0, 1000))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    return e.json(500, { error: "create_failed", message: String(err && err.message || err).slice(0, 300) })
  }
})

routerAdd("PATCH", "/api/asr_jobs/{id}", function (e) {
  try {
    var rec = $app.findRecordById("asr_jobs", e.request.pathValue("id"))
    var body = e.requestInfo().body || {}
    if ("status" in body) {
      var status = String(body.status || "queued").toLowerCase()
      if (["queued", "running", "succeeded", "failed"].indexOf(status) < 0) return e.json(400, { error: "invalid_status" })
      rec.set("status", status)
    }
    if ("remote_job_id" in body) rec.set("remote_job_id", String(body.remote_job_id || "").slice(0, 40))
    if ("transcript" in body) rec.set("transcript", String(body.transcript || "").slice(0, 20))
    if ("device" in body) rec.set("device", body.device === undefined || body.device === null ? "" : String(body.device).slice(0, 60))
    if ("employee" in body) rec.set("employee", body.employee === undefined || body.employee === null ? "" : String(body.employee).slice(0, 20))
    if ("store" in body) rec.set("store", body.store === undefined || body.store === null ? "" : String(body.store).slice(0, 20))
    if ("audio_name" in body) rec.set("audio_name", body.audio_name === undefined || body.audio_name === null ? "" : String(body.audio_name).slice(0, 180))
    if ("audio_size" in body) {
      var audioSize = Number(body.audio_size)
      rec.set("audio_size", audioSize >= 0 && isFinite(audioSize) ? audioSize : 0)
    }
    if ("audio_sha256" in body) rec.set("audio_sha256", body.audio_sha256 === undefined || body.audio_sha256 === null ? "" : String(body.audio_sha256).slice(0, 64))
    if ("metadata_json" in body) rec.set("metadata_json", body.metadata_json === undefined || body.metadata_json === null ? {} : body.metadata_json)
    if ("submitted_at" in body) rec.set("submitted_at", body.submitted_at === undefined || body.submitted_at === null ? "" : String(body.submitted_at).slice(0, 40))
    if ("started_at" in body) rec.set("started_at", body.started_at === undefined || body.started_at === null ? "" : String(body.started_at).slice(0, 40))
    if ("finished_at" in body) rec.set("finished_at", body.finished_at === undefined || body.finished_at === null ? "" : String(body.finished_at).slice(0, 40))
    if ("last_polled_at" in body) rec.set("last_polled_at", body.last_polled_at === undefined || body.last_polled_at === null ? "" : String(body.last_polled_at).slice(0, 40))
    if ("result_imported_at" in body) rec.set("result_imported_at", body.result_imported_at === undefined || body.result_imported_at === null ? "" : String(body.result_imported_at).slice(0, 40))
    if ("occurred_at" in body) rec.set("occurred_at", body.occurred_at === undefined || body.occurred_at === null ? "" : String(body.occurred_at).slice(0, 40))
    if ("attempts" in body) {
      var attempts = Number(body.attempts)
      rec.set("attempts", attempts >= 0 && isFinite(attempts) ? attempts : 0)
    }
    if ("error_code" in body) rec.set("error_code", body.error_code === undefined || body.error_code === null ? "" : String(body.error_code).slice(0, 80))
    if ("error_message" in body) rec.set("error_message", body.error_message === undefined || body.error_message === null ? "" : String(body.error_message).slice(0, 1000))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    return e.json(500, { error: "update_failed", message: String(err && err.message || err).slice(0, 300) })
  }
})

// DELETE /api/asr_jobs/{id} — 测试阶段清理用；删除转写记录时由前端联动调用。
routerAdd("DELETE", "/api/asr_jobs/{id}", function (e) {
  try {
    var id = e.request.pathValue("id")
    if (!id) return e.json(400, { error: "id_required" })
    var rec = null
    try { rec = $app.findRecordById("asr_jobs", id) } catch (_) { rec = null }
    if (!rec) return e.json(404, { error: "not_found" })
    $app.delete(rec)
    return e.json(200, { ok: true })
  } catch (err) {
    return e.json(500, { error: "delete_failed", message: String(err && err.message || err).slice(0, 300) })
  }
})
