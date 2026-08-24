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

// 匿名 CRUD 路由已由 pocketbase/pb_hooks/business.pb.js 统一守卫路由替代。
