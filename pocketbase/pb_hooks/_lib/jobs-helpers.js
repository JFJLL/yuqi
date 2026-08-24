// pb_hooks/_lib/jobs-helpers.js — 内部任务辅助函数 (模块作用域, handler 内 require)

function pbDate(now) {
  const d = now || new Date()
  return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "Z")
}

function nowIso() {
  return pbDate(new Date())
}

function requireService(e) {
  const g = require(`${__hooks}/_lib/guards.js`)
  if (!g.isServiceRequest(e)) throw new ForbiddenError("仅内部服务可访问")
  const tenantId = g.serviceTenantId()
  return { tenantId }
}

function findJob(id) {
  if (!/^[A-Za-z0-9_-]+$/.test(String(id || ""))) return null
  try {
    return $app.findRecordById("processing_jobs", id)
  } catch (_) {
    return null
  }
}

module.exports = {
  pbDate,
  nowIso,
  requireService,
  findJob,
}
