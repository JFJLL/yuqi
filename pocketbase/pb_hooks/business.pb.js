/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/business.pb.js — 统一守卫 CRUD 路由 (通配按集合名分发)
//
// JSVM handler 隔离执行: 模块必须通过 require() 在 handler 内加载,
// 配置表存放于 _lib/configs.js, 按请求路径中的集合名分发。
//
// 所有集合的列表/详情/创建/更新/删除均经过:
//   requireAuth → requireRole → buildScopeFilter/assertVisible → tenant 强制 → 审计

const COLLECTIONS = [
  "regions", "stores", "employees", "devices", "device_bindings", "device_logs",
  "audio_files", "asr_jobs", "transcripts", "inspection_issues", "rectify_tasks",
  "appeals", "compliance_rules", "knowledge_items", "model_evals", "sync_logs",
  "app_settings",
  "sessions", "transcript_segments", "risk_rules", "risk_rule_versions",
  "risk_segments", "issues", "rectifications", "issue_events", "notifications",
  "recording_consents", "processing_jobs",
]

// 通配集合路由: /api/{coll} 与 /api/{coll}/{id}
// PB 使用 Go ServeMux, 更具体的系统路由 (/api/collections/...) 优先匹配, 无冲突。

routerAdd("GET", "/api/{coll}", (e) => {
  const crud = require(`${__hooks}/_lib/crud.js`)
  const cfgs = require(`${__hooks}/_lib/configs.js`)
  const cfg = cfgs[e.request.pathValue("coll")]
  if (!cfg) throw new NotFoundError("接口不存在")
  return crud.handlers.list(e, cfg)
})

routerAdd("GET", "/api/{coll}/{id}", (e) => {
  const crud = require(`${__hooks}/_lib/crud.js`)
  const cfgs = require(`${__hooks}/_lib/configs.js`)
  const cfg = cfgs[e.request.pathValue("coll")]
  if (!cfg) throw new NotFoundError("接口不存在")
  return crud.handlers.get(e, cfg)
})

routerAdd("POST", "/api/{coll}", (e) => {
  const crud = require(`${__hooks}/_lib/crud.js`)
  const cfgs = require(`${__hooks}/_lib/configs.js`)
  const cfg = cfgs[e.request.pathValue("coll")]
  if (!cfg) throw new NotFoundError("接口不存在")
  return crud.handlers.create(e, cfg)
})

routerAdd("PATCH", "/api/{coll}/{id}", (e) => {
  const crud = require(`${__hooks}/_lib/crud.js`)
  const cfgs = require(`${__hooks}/_lib/configs.js`)
  const cfg = cfgs[e.request.pathValue("coll")]
  if (!cfg) throw new NotFoundError("接口不存在")
  return crud.handlers.update(e, cfg)
})

routerAdd("DELETE", "/api/{coll}/{id}", (e) => {
  const crud = require(`${__hooks}/_lib/crud.js`)
  const cfgs = require(`${__hooks}/_lib/configs.js`)
  const cfg = cfgs[e.request.pathValue("coll")]
  if (!cfg) throw new NotFoundError("接口不存在")
  return crud.handlers.delete(e, cfg)
})
