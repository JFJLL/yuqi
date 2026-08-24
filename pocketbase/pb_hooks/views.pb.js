// pb_hooks/views.pb.js — 完整转写查看 / 音频播放访问 (受限 + 审计)
//
// GET /api/yuqi/transcripts/{id}/view  — 完整转写 (ADMIN/COMPLIANCE/REGION_MANAGER/STORE_MANAGER, 数据范围)
// GET /api/yuqi/audio/{id}/play        — 音频访问 (同上, 返回 OSS 元数据与预签名占位)
// 两者均写 audit_logs, 不泄露跨 tenant/范围资源。

routerAdd("GET", "/api/yuqi/transcripts/{id}/view", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["SUPER_ADMIN", "ADMIN", "COMPLIANCE", "REGION_MANAGER", "STORE_MANAGER"])

    const id = e.request.pathValue("id")
    const rec = H.findRecord("transcripts", id)
    if (!rec) throw new NotFoundError("转写记录不存在")
    g.assertVisible(e, ctx, rec, { storeField: "store", employeeField: "employee" })

    let segments = []
    try {
      segments = rec.get("segments_json") || []
    } catch (_) {
      segments = []
    }
    if (!Array.isArray(segments)) segments = []

    g.writeAudit(e, ctx, "transcript_view", "transcripts", id, { session: String(rec.get("session") || "") })

    return e.json(200, {
      id: rec.id,
      transcript: rec.publicExport(),
      segments: segments,
      disclaimer: "系统识别结果仅为疑似风险，最终判断由授权管理人员完成。",
    })
  } catch (err) {
    const g = require(`${__hooks}/_lib/guards.js`)
    const H = require(`${__hooks}/_lib/phase1-helpers.js`)
    return H.responseError(e, err, "查看失败")
  }
})

// 音频播放访问: 一期不直接代理 OSS 流, 返回元数据 + 访问提示, 访问即审计
routerAdd("GET", "/api/yuqi/audio/{id}/play", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["SUPER_ADMIN", "ADMIN", "COMPLIANCE", "REGION_MANAGER", "STORE_MANAGER"])

    const id = e.request.pathValue("id")
    const rec = H.findRecord("audio_files", id)
    if (!rec) throw new NotFoundError("音频记录不存在")
    // audio_files 无 store/employee 字段, 数据范围按租户隔离 (设备归属见 device_bindings)
    if (String(rec.get("tenant") || "") !== ctx.tenantId) throw new NotFoundError("音频记录不存在")

    g.writeAudit(e, ctx, "audio_play", "audio_files", id, { object_key: String(rec.get("object_key") || "").slice(0, 200) })

    return e.json(200, {
      id: rec.id,
      file_name: String(rec.get("file_name") || ""),
      object_key: String(rec.get("object_key") || ""),
      size: rec.get("size") || 0,
      device_sn: String(rec.get("device_sn") || ""),
      status: String(rec.get("status") || ""),
      started_at: String(rec.get("started_at") || ""),
      ended_at: String(rec.get("ended_at") || ""),
      playback: "oss_presigned_url_via_server",
      note: "播放地址由服务端按需签发，访问已记录审计。",
    })
  } catch (err) {
    const g = require(`${__hooks}/_lib/guards.js`)
    const H = require(`${__hooks}/_lib/phase1-helpers.js`)
    return H.responseError(e, err, "访问失败")
  }
})
