/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/audio_files.pb.js — OSS 自动采集的音频登记表 + 轻量 CRUD 路由。
// 由 yuqi-oss-scanner 写入；去重以 object_key 唯一索引为准。
// 下载、转发 ASR、轮询结果等耗时工作不在 hook 内执行，由云端 scanner/gateway 完成。

onBootstrap(function (e) {
  e.next()
  try {
    var existing = null
    try { existing = $app.findCollectionByNameOrId("audio_files") } catch (_) { existing = null }
    if (!existing) {
      var collection = new Collection({
        type: "base",
        name: "audio_files",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        indexes: [
          "CREATE UNIQUE INDEX `idx_audio_files_object_key` ON `audio_files` (`object_key`)",
        ],
        fields: [
          { name: "object_key", type: "text", max: 400, required: true },
          { name: "file_name", type: "text", max: 200 },
          { name: "device_sn", type: "text", max: 60 },
          { name: "size", type: "number" },
          { name: "oss_last_modified", type: "date" },
          { name: "started_at", type: "date" },
          { name: "ended_at", type: "date" },
          { name: "chunk", type: "text", max: 20 },
          // discovered -> submitting -> submitted | submit_failed(可重试) | dead(超过重试上限)
          { name: "status", type: "text", max: 20 },
          { name: "attempts", type: "number" },
          { name: "next_retry_at", type: "date" },
          { name: "transcript", type: "text", max: 20 },
          { name: "asr_job", type: "text", max: 20 },
          { name: "error_message", type: "text", max: 1000 },
          { name: "created", type: "autodate", onCreate: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      })
      $app.save(collection)
      try { $app.logger().info("audio_files collection created") } catch (_) {}
    }
  } catch (err) {
    try { $app.logger().error("audio_files bootstrap: " + String(err && err.message || err)) } catch (_) {}
  }
})

// GET /api/audio_files?page=1&perPage=200&status=submit_failed&device_sn=WF...
routerAdd("GET", "/api/audio_files", function (e) {
  try {
    $app.findCollectionByNameOrId("audio_files")
    var query = e.requestInfo().query || {}
    var page = parseInt(String(query.page || "1"), 10) || 1
    var perPage = parseInt(String(query.perPage || "50"), 10) || 50
    if (perPage > 500) perPage = 500
    var sort = String(query.sort || "-created")
    var filterParts = []
    var params = {}
    if (query.status !== undefined && query.status !== "") {
      filterParts.push("status = {:status}")
      params.status = String(query.status)
    }
    if (query.device_sn !== undefined && query.device_sn !== "") {
      filterParts.push("device_sn = {:device_sn}")
      params.device_sn = String(query.device_sn)
    }
    var filter = filterParts.length > 0 ? filterParts.join(" && ") : ""
    var records = filter
      ? $app.findRecordsByFilter("audio_files", filter, sort, perPage, (page - 1) * perPage, params)
      : $app.findRecordsByFilter("audio_files", "", sort, perPage, (page - 1) * perPage)
    var items = []
    for (var i = 0; i < records.length; i++) items.push(records[i].publicExport())
    return e.json(200, { items: items, page: page, perPage: perPage, totalItems: items.length })
  } catch (err) {
    return e.json(500, { error: "list_failed", message: String(err && err.message || err).slice(0, 300) })
  }
})

// GET /api/audio_files/{id}
routerAdd("GET", "/api/audio_files/{id}", function (e) {
  try {
    var rec = $app.findRecordById("audio_files", e.request.pathValue("id"))
    return e.json(200, rec.publicExport())
  } catch (err) {
    return e.json(404, { error: "not_found", message: String(err && err.message || err).slice(0, 300) })
  }
})

// POST /api/audio_files — object_key 重复时返回已有记录（幂等）
routerAdd("POST", "/api/audio_files", function (e) {
  try {
    var collection = $app.findCollectionByNameOrId("audio_files")
    var body = e.requestInfo().body || {}
    var objectKey = String(body.object_key || "").trim()
    if (!objectKey) return e.json(400, { error: "object_key_required" })
    if (objectKey.length > 400) return e.json(400, { error: "object_key_too_long" })

    var existingRecord = null
    try { existingRecord = $app.findFirstRecordByFilter("audio_files", "object_key = {:k}", { k: objectKey }) } catch (_) { existingRecord = null }
    if (existingRecord) {
      return e.json(200, { duplicate: true, item: existingRecord.publicExport() })
    }

    var status = String(body.status || "discovered").toLowerCase()
    if (["discovered", "submitting", "submitted", "submit_failed", "dead"].indexOf(status) < 0) {
      return e.json(400, { error: "invalid_status" })
    }
    var size = Number(body.size)
    var attempts = Number(body.attempts)
    var rec = new Record(collection)
    rec.set("object_key", objectKey)
    rec.set("file_name", body.file_name === undefined || body.file_name === null ? "" : String(body.file_name).slice(0, 200))
    rec.set("device_sn", body.device_sn === undefined || body.device_sn === null ? "" : String(body.device_sn).slice(0, 60))
    rec.set("size", size >= 0 && isFinite(size) ? size : 0)
    rec.set("oss_last_modified", body.oss_last_modified === undefined || body.oss_last_modified === null ? "" : String(body.oss_last_modified).slice(0, 40))
    rec.set("started_at", body.started_at === undefined || body.started_at === null ? "" : String(body.started_at).slice(0, 40))
    rec.set("ended_at", body.ended_at === undefined || body.ended_at === null ? "" : String(body.ended_at).slice(0, 40))
    rec.set("chunk", body.chunk === undefined || body.chunk === null ? "" : String(body.chunk).slice(0, 20))
    rec.set("status", status)
    rec.set("attempts", attempts >= 0 && isFinite(attempts) ? attempts : 0)
    rec.set("next_retry_at", body.next_retry_at === undefined || body.next_retry_at === null ? "" : String(body.next_retry_at).slice(0, 40))
    rec.set("transcript", body.transcript === undefined || body.transcript === null ? "" : String(body.transcript).slice(0, 20))
    rec.set("asr_job", body.asr_job === undefined || body.asr_job === null ? "" : String(body.asr_job).slice(0, 20))
    rec.set("error_message", body.error_message === undefined || body.error_message === null ? "" : String(body.error_message).slice(0, 1000))
    $app.save(rec)
    return e.json(200, { duplicate: false, item: rec.publicExport() })
  } catch (err) {
    return e.json(500, { error: "create_failed", message: String(err && err.message || err).slice(0, 300) })
  }
})

// PATCH /api/audio_files/{id} — 只更新 body 里出现的字段
routerAdd("PATCH", "/api/audio_files/{id}", function (e) {
  try {
    var rec = $app.findRecordById("audio_files", e.request.pathValue("id"))
    var body = e.requestInfo().body || {}
    if ("status" in body) {
      var status = String(body.status || "").toLowerCase()
      if (["discovered", "submitting", "submitted", "submit_failed", "dead"].indexOf(status) < 0) {
        return e.json(400, { error: "invalid_status" })
      }
      rec.set("status", status)
    }
    if ("file_name" in body) rec.set("file_name", body.file_name === undefined || body.file_name === null ? "" : String(body.file_name).slice(0, 200))
    if ("device_sn" in body) rec.set("device_sn", body.device_sn === undefined || body.device_sn === null ? "" : String(body.device_sn).slice(0, 60))
    if ("size" in body) {
      var size = Number(body.size)
      rec.set("size", size >= 0 && isFinite(size) ? size : 0)
    }
    if ("oss_last_modified" in body) rec.set("oss_last_modified", body.oss_last_modified === undefined || body.oss_last_modified === null ? "" : String(body.oss_last_modified).slice(0, 40))
    if ("started_at" in body) rec.set("started_at", body.started_at === undefined || body.started_at === null ? "" : String(body.started_at).slice(0, 40))
    if ("ended_at" in body) rec.set("ended_at", body.ended_at === undefined || body.ended_at === null ? "" : String(body.ended_at).slice(0, 40))
    if ("chunk" in body) rec.set("chunk", body.chunk === undefined || body.chunk === null ? "" : String(body.chunk).slice(0, 20))
    if ("attempts" in body) {
      var attempts = Number(body.attempts)
      rec.set("attempts", attempts >= 0 && isFinite(attempts) ? attempts : 0)
    }
    if ("next_retry_at" in body) rec.set("next_retry_at", body.next_retry_at === undefined || body.next_retry_at === null ? "" : String(body.next_retry_at).slice(0, 40))
    if ("transcript" in body) rec.set("transcript", body.transcript === undefined || body.transcript === null ? "" : String(body.transcript).slice(0, 20))
    if ("asr_job" in body) rec.set("asr_job", body.asr_job === undefined || body.asr_job === null ? "" : String(body.asr_job).slice(0, 20))
    if ("error_message" in body) rec.set("error_message", body.error_message === undefined || body.error_message === null ? "" : String(body.error_message).slice(0, 1000))
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    return e.json(500, { error: "update_failed", message: String(err && err.message || err).slice(0, 300) })
  }
})
