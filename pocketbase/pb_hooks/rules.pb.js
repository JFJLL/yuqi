/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/rules.pb.js — 规则库管理 (模式校验 + 版本快照)
//
// POST  /api/yuqi/risk-rules             创建规则 (校验模式, 版本=1, 写快照)
// PATCH /api/yuqi/risk-rules/{id}        更新规则 (校验模式, 版本+1, 写快照)
// POST  /api/yuqi/risk-rules/init-builtin 初始化内置 8 类规则 (幂等, 服务身份/管理员)
//
// 规则模式校验与内置规则定义复用 server/rule-analyzer.mjs 的逻辑;
// JSVM 无法直接加载 ESM 模块, 校验逻辑在 _lib/rule-validate.js 同步维护。

function findRule(id) {
  if (!/^[A-Za-z0-9_-]+$/.test(String(id || ""))) return null
  try {
    return $app.findRecordById("risk_rules", id)
  } catch (_) {
    return null
  }
}

// ---- 创建规则 ----
routerAdd("POST", "/api/yuqi/risk-rules", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const V = require(`${__hooks}/_lib/rule-validate.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["SUPER_ADMIN", "ADMIN", "COMPLIANCE"])
    const body = e.requestInfo().body || {}
    const code = String(body.code || "").trim()
    const name = String(body.name || "").trim()
    if (!code || !name) throw new BadRequestError("code 与 name 必填")
    const matchType = String(body.match_type || "KEYWORD_ANY")
    const patternJson = body.pattern_json || {}

    const valid = V.validateRulePattern({ match_type: matchType, pattern_json: patternJson })
    if (!valid.ok) throw new BadRequestError("规则模式无效: " + valid.reason)

    let dup = null
    try {
      dup = $app.findFirstRecordByFilter("risk_rules", "tenant = {:t} && code = {:c}", { t: ctx.tenantId, c: code })
    } catch (_) {
      dup = null
    }
    if (dup) throw new BadRequestError("该租户已存在同 code 规则")

    const coll = $app.findCollectionByNameOrId("risk_rules")
    const rec = new Record(coll)
    rec.set("tenant", ctx.tenantId)
    rec.set("code", code)
    rec.set("name", String(name).slice(0, 120))
    rec.set("category", String(body.category || "").slice(0, 40))
    rec.set("risk_level", String(body.risk_level || "LOW").slice(0, 20))
    rec.set("match_type", matchType)
    rec.set("pattern_json", patternJson)
    rec.set("advice", String(body.advice || "").slice(0, 2000))
    rec.set("recommended_expression", String(body.recommended_expression || "").slice(0, 2000))
    rec.set("enabled", body.enabled === undefined ? true : Boolean(body.enabled))
    rec.set("version", 1)
    rec.set("status", "ACTIVE")
    rec.set("created_by", ctx.kind === "user" ? ctx.user.id : "")
    rec.set("updated_by", ctx.kind === "user" ? ctx.user.id : "")
    $app.save(rec)
    V.writeSnapshot($app, rec, "create")
    g.writeAudit(e, ctx, "rule_create", "risk_rules", rec.id, { code })
    return e.json(200, rec.publicExport())
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "rule_create_failed", message: String((err && err.message) || "创建失败") })
  }
})

// ---- 更新规则 (版本快照) ----
routerAdd("PATCH", "/api/yuqi/risk-rules/{id}", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const V = require(`${__hooks}/_lib/rule-validate.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["SUPER_ADMIN", "ADMIN", "COMPLIANCE"])
    const rec = findRule(e.request.pathValue("id"))
    if (!rec) throw new NotFoundError("规则不存在")
    if (String(rec.get("tenant") || "") !== ctx.tenantId) throw new NotFoundError("规则不存在")
    const body = e.requestInfo().body || {}

    const nextVersion = Number(rec.get("version") || 0) + 1
    if (body.match_type !== undefined || body.pattern_json !== undefined) {
      const matchType = String(body.match_type || rec.get("match_type") || "KEYWORD_ANY")
      const patternJson = body.pattern_json !== undefined ? body.pattern_json : rec.get("pattern_json")
      const valid = V.validateRulePattern({ match_type: matchType, pattern_json: patternJson })
      if (!valid.ok) throw new BadRequestError("规则模式无效: " + valid.reason)
      rec.set("match_type", matchType)
      rec.set("pattern_json", patternJson)
    }
    const updatable = ["name", "category", "risk_level", "advice", "recommended_expression", "enabled", "status"]
    for (const f of updatable) {
      if (body[f] !== undefined) {
        if (f === "enabled") rec.set("enabled", Boolean(body[f]))
        else rec.set(f, String(body[f]).slice(0, f === "advice" || f === "recommended_expression" ? 2000 : 120))
      }
    }
    rec.set("version", nextVersion)
    rec.set("updated_by", ctx.kind === "user" ? ctx.user.id : "")
    $app.save(rec)
    V.writeSnapshot($app, rec, "update")
    g.writeAudit(e, ctx, "rule_update", "risk_rules", rec.id, { code: rec.get("code") })
    return e.json(200, rec.publicExport())
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "rule_update_failed", message: String((err && err.message) || "更新失败") })
  }
})

// ---- 初始化内置规则 (幂等) ----
routerAdd("POST", "/api/yuqi/risk-rules/init-builtin", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const V = require(`${__hooks}/_lib/rule-validate.js`)
    const ctx = g.requireAuth(e)
    if (ctx.kind !== "service" && ctx.roleCode !== "SUPER_ADMIN" && ctx.roleCode !== "ADMIN") {
      throw new ForbiddenError("无权初始化规则")
    }
    const tenantId = ctx.tenantId || g.serviceTenantId()
    const builtins = V.BUILTIN_RULES
    const coll = $app.findCollectionByNameOrId("risk_rules")
    let created = 0
    for (let i = 0; i < builtins.length; i++) {
      const b = builtins[i]
      let dup = null
      try {
        dup = $app.findFirstRecordByFilter("risk_rules", "tenant = {:t} && code = {:c}", { t: tenantId, c: b.code })
      } catch (_) {
        dup = null
      }
      if (dup) continue
      const rec = new Record(coll)
      rec.set("tenant", tenantId)
      rec.set("code", b.code)
      rec.set("name", b.name)
      rec.set("category", b.category)
      rec.set("risk_level", b.risk_level)
      rec.set("match_type", b.match_type)
      rec.set("pattern_json", b.pattern_json)
      rec.set("advice", b.advice)
      rec.set("recommended_expression", b.recommended_expression)
      rec.set("enabled", true)
      rec.set("version", 1)
      rec.set("status", "ACTIVE")
      rec.set("created_by", ctx.kind === "user" ? ctx.user.id : "")
      rec.set("updated_by", ctx.kind === "user" ? ctx.user.id : "")
      $app.save(rec)
      V.writeSnapshot($app, rec, "create")
      created++
    }
    return e.json(200, { created, total: builtins.length })
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "init_failed", message: String((err && err.message) || "初始化失败") })
  }
})
