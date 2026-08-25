// pb_hooks/_lib/phase1-helpers.js — 一期业务流程辅助函数 (模块作用域, handler 内 require)
// JSVM 的 routerAdd handler 无法访问词法闭包, 所有辅助逻辑必须放在模块内,
// 再由 handler 在函数体内 require() 后调用。模块内可使用 $app/$security 等全局。

function pbDate(now) {
  const d = now || new Date()
  return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "Z")
}

function jsonToPlain(obj) {
  if (obj === null || obj === undefined) return obj
  if (typeof obj.get === "function") {
    const out = {}
    try {
      const keys = obj.keys ? obj.keys() : []
      for (let i = 0; i < keys.length; i++) out[keys[i]] = jsonToPlain(obj.get(keys[i]))
    } catch (_) {}
    return out
  }
  if (Array.isArray(obj)) return obj.map((x) => jsonToPlain(x))
  if (typeof obj === "object") {
    const out = {}
    for (const k of Object.keys(obj)) out[k] = jsonToPlain(obj[k])
    return out
  }
  return obj
}

function findRecord(collection, id) {
  if (!/^[A-Za-z0-9_-]+$/.test(String(id || ""))) return null
  try {
    return $app.findRecordById(collection, id)
  } catch (_) {
    return null
  }
}

function writeIssueEvent(issue, eventType, fromStatus, toStatus, ctx, comment, detail) {
  try {
    const coll = $app.findCollectionByNameOrId("issue_events")
    const rec = new Record(coll)
    rec.set("tenant", String(issue.get("tenant") || ""))
    rec.set("issue", issue.id)
    rec.set("event_type", eventType)
    rec.set("from_status", String(fromStatus || ""))
    rec.set("to_status", String(toStatus || ""))
    if (ctx && ctx.kind === "user") {
      rec.set("actor", ctx.user.id)
      rec.set("actor_name", String(ctx.user.get("display_name") || ctx.user.get("email") || ctx.user.id))
    } else {
      rec.set("actor_name", "service")
    }
    if (comment) rec.set("comment", String(comment).slice(0, 2000))
    if (detail) {
      try {
        rec.set("detail_json", jsonToPlain(detail))
      } catch (_) {}
    }
    $app.save(rec)
  } catch (_) {}
}

function createNotification(tenantId, userId, employeeId, title, body, type, link) {
  try {
    const coll = $app.findCollectionByNameOrId("notifications")
    const rec = new Record(coll)
    rec.set("tenant", tenantId)
    if (userId) rec.set("user", userId)
    if (employeeId) rec.set("employee", employeeId)
    rec.set("title", String(title || "").slice(0, 200))
    rec.set("body", String(body || "").slice(0, 2000))
    rec.set("type", String(type || "system").slice(0, 40))
    rec.set("link", String(link || "").slice(0, 200))
    rec.set("is_read", false)
    $app.save(rec)
    return rec
  } catch (_) {
    return null
  }
}

function findEmployeeUser(employeeId) {
  try {
    return $app.findFirstRecordByFilter("app_users", "employee = {:e}", { e: String(employeeId || "") })
  } catch (_) {
    return null
  }
}

function notifyStaffByScope(tenantId, roles, title, body, type, link) {
  try {
    const users = $app.findRecordsByFilter("app_users", "tenant = {:t}", "", 500, 0, { t: tenantId })
    for (let i = 0; i < users.length; i++) {
      const u = users[i]
      const role = String(u.get("role_code") || "")
      const status = String(u.get("status") || "ACTIVE")
      if (status !== "ACTIVE") continue
      if (roles.indexOf(role) >= 0) {
        createNotification(tenantId, u.id, "", title, body, type, link)
      }
    }
  } catch (_) {}
}

function assertIssueVisibleToEmployee(e, ctx, issue) {
  if (ctx.kind !== "user" || ctx.roleCode !== "EMPLOYEE") throw new ForbiddenError("仅员工可操作")
  const myEmployee = String(ctx.user.get("employee") || "")
  if (String(issue.get("employee") || "") !== myEmployee) throw new NotFoundError("问题不存在")
  if (String(issue.get("review_status") || "") !== "APPROVED") throw new NotFoundError("问题不存在")
  if (String(issue.get("employee_visibility") || "") !== "VISIBLE") throw new NotFoundError("问题不存在")
}

function responseError(e, err, fallback) {
  const status = Number(err && err.status) || 500
  return e.json(status >= 400 && status <= 599 ? status : 500, {
    error: String((err && err.code) || "error"),
    message: String((err && err.message) || err || fallback || "操作失败").slice(0, 300),
  })
}

module.exports = {
  pbDate,
  jsonToPlain,
  findRecord,
  writeIssueEvent,
  createNotification,
  findEmployeeUser,
  notifyStaffByScope,
  assertIssueVisibleToEmployee,
  responseError,
}
