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

// 匿名 CRUD 路由已由 pocketbase/pb_hooks/business.pb.js 统一守卫路由替代。
