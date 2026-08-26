/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/phase1.pb.js — 一期业务流程路由
//
// 问题复核 / 申诉 / 整改 / 设备绑定 / 员工自助 / 通知 / 录音知情 / 管理端账号

// ============================================================
// 管理端账号
// ============================================================

routerAdd("POST", "/api/yuqi/admin/users", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requirePermission(e, ctx, "permission.manage")
    const body = e.requestInfo().body || {}
    const email = String(body.email || "").trim().toLowerCase()
    const password = String(body.password || "")
    if (!email || password.length < 8) throw new BadRequestError("邮箱与至少 8 位密码必填")
    const existing = H.findRecord("app_users", "") || (() => {
      try {
        return $app.findFirstRecordByData("app_users", "email", email)
      } catch (_) {
        return null
      }
    })()
    if (existing) throw new BadRequestError("该邮箱已存在账号")

    const coll = $app.findCollectionByNameOrId("app_users")
    const rec = new Record(coll)
    rec.set("email", email)
    rec.set("password", password)
    rec.set("tokenKey", $security.randomString(40))
    rec.set("tenant", ctx.tenantId)
    rec.set("display_name", String(body.display_name || email).slice(0, 80))
    rec.set("role_code", String(body.role_code || "EMPLOYEE").slice(0, 40))
    rec.set("status", String(body.status || "ACTIVE").slice(0, 20))
    rec.set("employee", String(body.employee || "").slice(0, 40))
    rec.set("assigned_org", String(body.assigned_org || "").slice(0, 40))
    rec.set("assigned_store", String(body.assigned_store || "").slice(0, 40))
    rec.set("mobile", String(body.mobile || "").slice(0, 30))
    rec.set("token_version", 0)
    $app.save(rec)
    g.writeAudit(e, ctx, "user_create", "app_users", rec.id, { email })
    return e.json(200, rec.publicExport())
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "账号创建失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "账号创建失败") })
  }
})

routerAdd("PATCH", "/api/yuqi/admin/users/{id}", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requirePermission(e, ctx, "permission.manage")
    const rec = H.findRecord("app_users", e.request.pathValue("id"))
    if (!rec) throw new NotFoundError("账号不存在")
    if (String(rec.get("tenant") || "") !== ctx.tenantId) throw new NotFoundError("账号不存在")
    const body = e.requestInfo().body || {}

    // 1. 自锁保护：禁止停用当前正在登录的账号
    if (rec.id === ctx.user.id && body.status === "DISABLED") {
      throw new BadRequestError("不可停用当前正在登录的管理员账号")
    }

    // 2. 最后超管保护：禁止停用或降级最后一个超级管理员
    if (rec.get("role_code") === "SUPER_ADMIN" && (body.status === "DISABLED" || (body.role_code && body.role_code !== "SUPER_ADMIN"))) {
      const superAdmins = $app.findRecordsByFilter("app_users", "role_code = 'SUPER_ADMIN' && status = 'ACTIVE' && tenant = {:t}", "", 10, 0, { t: ctx.tenantId })
      if (superAdmins.length <= 1) {
        throw new BadRequestError("不可停用或降级系统中最后一个超级管理员账号")
      }
    }

    const allowed = ["display_name", "role_code", "status", "employee", "assigned_org", "assigned_store", "mobile"]
    for (const f of allowed) {
      if (body[f] !== undefined) rec.set(f, String(body[f]).slice(0, f === "display_name" ? 80 : f === "mobile" ? 30 : 40))
    }
    if (body.password) {
      if (String(body.password).length < 8) throw new BadRequestError("密码至少 8 位")
      rec.set("password", String(body.password))
      rec.set("token_version", Number(rec.get("token_version") || 0) + 1)
      rec.set("token_valid_from", H.pbDate())
    }
    $app.save(rec)
    g.writeAudit(e, ctx, "user_update", "app_users", rec.id, {})
    return e.json(200, rec.publicExport())
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "账号更新失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "账号更新失败") })
  }
})

// ============================================================
// 问题复核 (管理端)
// ============================================================

routerAdd("POST", "/api/yuqi/issues/{id}/review", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["SUPER_ADMIN", "ADMIN", "COMPLIANCE"])
    g.requirePermission(e, ctx, "inspection.manage")
    const issue = H.findRecord("issues", e.request.pathValue("id"))
    if (!issue) throw new NotFoundError("问题不存在")
    g.assertVisible(e, ctx, issue, { storeField: "store", employeeField: "employee" })
    if (String(issue.get("review_status") || "") !== "PENDING") throw new BadRequestError("该问题已复核")

    const body = e.requestInfo().body || {}
    const action = String(body.action || "")
    const comment = String(body.comment || "").slice(0, 2000)
    if (action === "approve") {
      if (body.risk_level) issue.set("risk_level", String(body.risk_level).slice(0, 20))
      if (body.advice) issue.set("advice", String(body.advice).slice(0, 2000))
      issue.set("review_status", "APPROVED")
      issue.set("reviewed_by", ctx.user.id)
      issue.set("reviewed_at", H.pbDate())
      issue.set("review_comment", comment)
      $app.save(issue)
      H.writeIssueEvent(issue, "issue_reviewed", "PENDING", "APPROVED", ctx, comment, { action })
      g.writeAudit(e, ctx, "issue_review", "issues", issue.id, { action, comment })
      return e.json(200, issue.publicExport())
    }
    if (action === "dismiss") {
      issue.set("review_status", "DISMISSED")
      issue.set("close_status", "CLOSED")
      issue.set("closed_at", H.pbDate())
      issue.set("is_false_positive", true)
      issue.set("reviewed_by", ctx.user.id)
      issue.set("reviewed_at", H.pbDate())
      issue.set("review_comment", comment || "人工复核判定为误报")
      $app.save(issue)
      H.writeIssueEvent(issue, "issue_dismissed", "PENDING", "DISMISSED", ctx, comment, { action })
      g.writeAudit(e, ctx, "issue_review", "issues", issue.id, { action, comment })
      return e.json(200, issue.publicExport())
    }
    throw new BadRequestError("无效操作")
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "复核失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "复核失败") })
  }
})

// 推送员工
routerAdd("POST", "/api/yuqi/issues/{id}/push", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["SUPER_ADMIN", "ADMIN", "COMPLIANCE"])
    g.requirePermission(e, ctx, "inspection.manage")
    const issue = H.findRecord("issues", e.request.pathValue("id"))
    if (!issue) throw new NotFoundError("问题不存在")
    g.assertVisible(e, ctx, issue, { storeField: "store", employeeField: "employee" })
    if (String(issue.get("review_status") || "") !== "APPROVED") throw new BadRequestError("仅已复核通过的问题可推送")
    if (String(issue.get("employee_visibility") || "") === "VISIBLE") throw new BadRequestError("已推送给员工")

    issue.set("employee_visibility", "VISIBLE")
    issue.set("employee_view_status", "UNREAD")
    issue.set("pushed_to_employee", true)
    issue.set("pushed_at", H.pbDate())
    $app.save(issue)
    H.writeIssueEvent(issue, "issue_pushed", "HIDDEN", "VISIBLE", ctx, "", {})
    const empId = String(issue.get("employee") || "")
    const empUser = H.findEmployeeUser(empId)
    if (empUser) {
      H.createNotification(ctx.tenantId, empUser.id, empId, "新增疑似风险待您确认",
        "系统识别到一条疑似问题已推送，请及时查看并确认或申诉。", "issue_pushed", "/employee/issues/" + issue.id)
    }
    g.writeAudit(e, ctx, "issue_push", "issues", issue.id, {})
    return e.json(200, issue.publicExport())
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "推送失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "推送失败") })
  }
})

// 关闭 (人工直接关闭, 如无需整改)
routerAdd("POST", "/api/yuqi/issues/{id}/close", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["SUPER_ADMIN", "ADMIN", "COMPLIANCE"])
    g.requirePermission(e, ctx, "inspection.manage")
    const issue = H.findRecord("issues", e.request.pathValue("id"))
    if (!issue) throw new NotFoundError("问题不存在")
    g.assertVisible(e, ctx, issue, { storeField: "store", employeeField: "employee" })
    const body = e.requestInfo().body || {}
    const comment = String(body.comment || "").slice(0, 2000)
    const from = String(issue.get("close_status") || "OPEN")
    issue.set("close_status", "CLOSED")
    issue.set("closed_at", H.pbDate())
    $app.save(issue)
    H.writeIssueEvent(issue, "issue_closed", from, "CLOSED", ctx, comment, {})
    g.writeAudit(e, ctx, "issue_close", "issues", issue.id, { comment })
    return e.json(200, issue.publicExport())
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "关闭失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "关闭失败") })
  }
})

// ============================================================
// 申诉
// ============================================================

routerAdd("POST", "/api/yuqi/employee/appeals", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["EMPLOYEE"])
    const body = e.requestInfo().body || {}
    const issue = H.findRecord("issues", String(body.issue || ""))
    if (!issue) throw new NotFoundError("问题不存在")
    H.assertIssueVisibleToEmployee(e, ctx, issue)
    const appealStatus = String(issue.get("appeal_status") || "NONE")
    if (appealStatus !== "NONE" && appealStatus !== "CANCELLED") throw new BadRequestError("该问题已存在申诉流程")
    const reason = String(body.reason || "").trim()
    if (reason.length < 2) throw new BadRequestError("请填写申诉理由")

    const coll = $app.findCollectionByNameOrId("appeals")
    const rec = new Record(coll)
    rec.set("tenant", ctx.tenantId)
    rec.set("issue_ref", issue.id)
    rec.set("employee", String(ctx.user.get("employee") || ""))
     rec.set("reason", reason.slice(0, 1000))
     rec.set("status", "PENDING")
     rec.set("submitted_at", H.pbDate())
     $app.save(rec)
     issue.set("appeal_status", "PENDING")
    $app.save(issue)
    H.writeIssueEvent(issue, "appeal_submitted", "NONE", "PENDING", ctx, reason, { appeal: rec.id })
    H.notifyStaffByScope(ctx.tenantId, ["SUPER_ADMIN", "ADMIN", "COMPLIANCE"], "收到员工申诉", "员工提交了一条申诉，请及时复核。", "appeal_new", "/appeals")
    g.writeAudit(e, ctx, "appeal_submit", "appeals", rec.id, { issue: issue.id })
    return e.json(200, rec.publicExport())
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "申诉提交失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "申诉提交失败") })
  }
})

// 补充申诉内容 (新增记录, 不覆盖原申诉)
routerAdd("POST", "/api/yuqi/employee/appeals/{id}/supplement", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["EMPLOYEE"])
    const existing = H.findRecord("appeals", e.request.pathValue("id"))
    if (!existing) throw new NotFoundError("申诉不存在")
    if (String(existing.get("employee") || "") !== String(ctx.user.get("employee") || "")) throw new NotFoundError("申诉不存在")
    const status = String(existing.get("status") || "")
    if (status !== "PENDING" && status !== "NEEDS_MORE_INFO") throw new BadRequestError("当前状态不可补充")
    const body = e.requestInfo().body || {}
    const text = String(body.supplementary_text || "").trim()
    if (text.length < 2) throw new BadRequestError("请填写补充说明")

    const coll = $app.findCollectionByNameOrId("appeals")
    const rec = new Record(coll)
    rec.set("tenant", String(existing.get("tenant") || ctx.tenantId))
    rec.set("issue_ref", String(existing.get("issue_ref") || ""))
    rec.set("employee", String(existing.get("employee") || ""))
    rec.set("reason", String(existing.get("reason") || ""))
     rec.set("supplementary_text", text.slice(0, 4000))
     rec.set("status", "PENDING")
     rec.set("submitted_at", H.pbDate())
     $app.save(rec)
      existing.set("status", "PENDING")
      existing.set("supplementary_text", text.slice(0, 4000))
      $app.save(existing)
     const issue = String(existing.get("issue_ref") || "") ? H.findRecord("issues", String(existing.get("issue_ref"))) : null
    if (issue) {
      issue.set("appeal_status", "PENDING")
      $app.save(issue)
      H.writeIssueEvent(issue, "appeal_supplemented", status, "PENDING", ctx, text.slice(0, 200), { appeal: rec.id })
    }
    H.notifyStaffByScope(String(existing.get("tenant") || ctx.tenantId), ["SUPER_ADMIN", "ADMIN", "COMPLIANCE"], "申诉补充说明", "员工补充了申诉说明，请重新复核。", "appeal_supplement", "/appeals")
    g.writeAudit(e, ctx, "appeal_supplement", "appeals", rec.id, { issue: issue ? issue.id : "" })
    return e.json(200, rec.publicExport())
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "补充失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "补充失败") })
  }
})

// 申诉复核
routerAdd("POST", "/api/yuqi/appeals/{id}/review", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["SUPER_ADMIN", "ADMIN", "COMPLIANCE", "STORE_MANAGER"])
    g.requirePermission(e, ctx, "appeal.review")
    const appeal = H.findRecord("appeals", e.request.pathValue("id"))
    if (!appeal) throw new NotFoundError("申诉不存在")
    const issue = String(appeal.get("issue_ref") || "") ? H.findRecord("issues", String(appeal.get("issue_ref"))) : null
    if (!issue) throw new NotFoundError("申诉关联问题不存在")
    g.assertVisible(e, ctx, issue, { storeField: "store", employeeField: "employee" })
    if (String(appeal.get("status") || "") !== "PENDING") throw new BadRequestError("该申诉已复核")

    const body = e.requestInfo().body || {}
    const action = String(body.action || "")
    const comment = String(body.comment || "").slice(0, 2000)
    if (action === "approve") {
      appeal.set("status", "APPROVED")
      appeal.set("reviewer", String(ctx.user.get("display_name") || ctx.user.get("email") || ctx.user.id))
      appeal.set("review_comment", comment)
      appeal.set("reviewed_at", H.pbDate())
      $app.save(appeal)
      issue.set("appeal_status", "APPROVED")
      issue.set("close_status", "CLOSED")
      issue.set("closed_at", H.pbDate())
      issue.set("is_false_positive", true) // 申诉成立 → 保留原始命中, 计入误报
      $app.save(issue)
      H.writeIssueEvent(issue, "appeal_approved", "PENDING", "APPROVED", ctx, comment, { appeal: appeal.id })
      const empUser = H.findEmployeeUser(String(issue.get("employee") || ""))
      if (empUser) H.createNotification(String(issue.get("tenant") || ""), empUser.id, String(issue.get("employee") || ""), "申诉成立", "您的申诉已审核通过，该疑似问题已关闭。", "appeal_result", "/employee/appeals")
      g.writeAudit(e, ctx, "appeal_review", "appeals", appeal.id, { action, comment })
      return e.json(200, appeal.publicExport())
    }
    if (action === "reject") {
      appeal.set("status", "REJECTED")
      appeal.set("reviewer", String(ctx.user.get("display_name") || ctx.user.get("email") || ctx.user.id))
      appeal.set("review_comment", comment)
      appeal.set("reviewed_at", H.pbDate())
      $app.save(appeal)
      issue.set("appeal_status", "REJECTED")
      issue.set("rectification_status", "PENDING")
      $app.save(issue)
      H.writeIssueEvent(issue, "appeal_rejected", "PENDING", "REJECTED", ctx, comment, { appeal: appeal.id })
      // 自动进入整改
      const empId = String(issue.get("employee") || "")
      const storeId = String(issue.get("store") || "")
      try {
        const rcoll = $app.findCollectionByNameOrId("rectifications")
        const rrec = new Record(rcoll)
        rrec.set("tenant", String(issue.get("tenant") || ""))
        rrec.set("issue", issue.id)
        rrec.set("employee", empId)
        rrec.set("store", storeId)
        rrec.set("title", "问题整改：" + String(issue.get("title") || issue.get("rule_code") || "").slice(0, 100))
        rrec.set("requirements", String(issue.get("advice") || "").slice(0, 2000))
        rrec.set("remediation_type", "ISSUE_REMEDIATION")
        rrec.set("status", "PENDING")
        rrec.set("due_at", H.pbDate(new Date(Date.now() + 7 * 24 * 3600 * 1000)))
        rrec.set("retry_count", 0)
        $app.save(rrec)
        H.writeIssueEvent(issue, "rectification_created", "NONE", "PENDING", ctx, "申诉驳回后自动派发整改", { rectification: rrec.id })
      } catch (_) {}
      const empUser2 = H.findEmployeeUser(empId)
      if (empUser2) H.createNotification(String(issue.get("tenant") || ""), empUser2.id, empId, "申诉未通过，请完成整改", comment || "您的申诉未通过，请按整改要求尽快完成。", "rectification_new", "/employee/rectifications")
      g.writeAudit(e, ctx, "appeal_review", "appeals", appeal.id, { action, comment })
      return e.json(200, appeal.publicExport())
    }
    if (action === "needs_more_info") {
      appeal.set("status", "NEEDS_MORE_INFO")
      appeal.set("reviewer", String(ctx.user.get("display_name") || ctx.user.get("email") || ctx.user.id))
      appeal.set("review_comment", comment)
      appeal.set("reviewed_at", H.pbDate())
      $app.save(appeal)
      issue.set("appeal_status", "NEEDS_MORE_INFO")
      $app.save(issue)
      H.writeIssueEvent(issue, "appeal_needs_info", "PENDING", "NEEDS_MORE_INFO", ctx, comment, { appeal: appeal.id })
      const empUser3 = H.findEmployeeUser(String(issue.get("employee") || ""))
      if (empUser3) H.createNotification(String(issue.get("tenant") || ""), empUser3.id, String(issue.get("employee") || ""), "申诉需补充材料", comment || "请补充申诉说明。", "appeal_needs_info", "/employee/appeals")
      g.writeAudit(e, ctx, "appeal_review", "appeals", appeal.id, { action, comment })
      return e.json(200, appeal.publicExport())
    }
    throw new BadRequestError("无效操作")
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "复核失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "复核失败") })
  }
})

// ============================================================
// 整改
// ============================================================

// 员工提交整改
routerAdd("POST", "/api/yuqi/rectifications/{id}/submit", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["EMPLOYEE"])
    const rect = H.findRecord("rectifications", e.request.pathValue("id"))
    if (!rect) throw new NotFoundError("整改任务不存在")
    if (String(rect.get("employee") || "") !== String(ctx.user.get("employee") || "")) throw new NotFoundError("整改任务不存在")
    const status = String(rect.get("status") || "")
    if (status !== "PENDING" && status !== "NEEDS_REVISION") throw new BadRequestError("当前状态不可提交")
    const body = e.requestInfo().body || {}
    const text = String(body.submission_text || "").trim()
    if (text.length < 2) throw new BadRequestError("请填写整改说明")

    rect.set("submission_text", text.slice(0, 4000))
    if (body.evidence_file) rect.set("evidence_file", String(body.evidence_file).slice(0, 500))
    rect.set("status", "SUBMITTED")
    rect.set("submitted_at", H.pbDate())
    $app.save(rect)

    const issue = String(rect.get("issue") || "") ? H.findRecord("issues", String(rect.get("issue"))) : null
    if (issue) {
      issue.set("rectification_status", "SUBMITTED")
      $app.save(issue)
      H.writeIssueEvent(issue, "rectification_submitted", status, "SUBMITTED", ctx, text.slice(0, 200), { rectification: rect.id })
      H.notifyStaffByScope(String(issue.get("tenant") || ""), ["SUPER_ADMIN", "ADMIN", "COMPLIANCE", "STORE_MANAGER"], "整改已提交", "员工提交了整改说明，请审核确认。", "rectification_submitted", "/tasks")
    }
    g.writeAudit(e, ctx, "rectification_submit", "rectifications", rect.id, {})
    return e.json(200, rect.publicExport())
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "提交失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "提交失败") })
  }
})

// 店长/合规退回整改
routerAdd("POST", "/api/yuqi/rectifications/{id}/revise", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["SUPER_ADMIN", "ADMIN", "COMPLIANCE", "STORE_MANAGER"])
    const rect = H.findRecord("rectifications", e.request.pathValue("id"))
    if (!rect) throw new NotFoundError("整改任务不存在")
    const issue = String(rect.get("issue") || "") ? H.findRecord("issues", String(rect.get("issue"))) : null
    if (!issue) throw new NotFoundError("整改任务关联问题不存在")
    g.assertVisible(e, ctx, issue, { storeField: "store", employeeField: "employee" })
    const status = String(rect.get("status") || "")
    if (status !== "SUBMITTED") throw new BadRequestError("仅已提交的整改可退回")
    const body = e.requestInfo().body || {}
    const comment = String(body.comment || "整改不符合要求，请重新提交").slice(0, 2000)

    rect.set("status", "NEEDS_REVISION")
    rect.set("retry_count", Number(rect.get("retry_count") || 0) + 1)
    rect.set("confirmation_comment", comment)
    $app.save(rect)
    if (issue) {
      issue.set("rectification_status", "NEEDS_REVISION")
      $app.save(issue)
      H.writeIssueEvent(issue, "rectification_revised", status, "NEEDS_REVISION", ctx, comment, { rectification: rect.id })
      const empUser = H.findEmployeeUser(String(issue.get("employee") || ""))
      if (empUser) H.createNotification(String(issue.get("tenant") || ""), empUser.id, String(issue.get("employee") || ""), "整改被退回", comment, "rectification_revised", "/employee/rectifications")
    }
    g.writeAudit(e, ctx, "rectification_revise", "rectifications", rect.id, { comment })
    return e.json(200, rect.publicExport())
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "退回失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "退回失败") })
  }
})

// 店长/合规确认整改 → 关闭
routerAdd("POST", "/api/yuqi/rectifications/{id}/confirm", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["SUPER_ADMIN", "ADMIN", "COMPLIANCE", "STORE_MANAGER"])
    g.requirePermission(e, ctx, "inspection.manage")
    const rect = H.findRecord("rectifications", e.request.pathValue("id"))
    if (!rect) throw new NotFoundError("整改任务不存在")
    const issue = String(rect.get("issue") || "") ? H.findRecord("issues", String(rect.get("issue"))) : null
    if (!issue) throw new NotFoundError("整改任务关联问题不存在")
    g.assertVisible(e, ctx, issue, { storeField: "store", employeeField: "employee" })
    if (String(rect.get("status") || "") !== "SUBMITTED") throw new BadRequestError("仅已提交的整改可确认")
    const body = e.requestInfo().body || {}
    const comment = String(body.comment || "").slice(0, 2000)

    rect.set("status", "CONFIRMED")
    rect.set("confirmed_by", ctx.user.id)
    rect.set("confirmed_at", H.pbDate())
    rect.set("confirmation_comment", comment || "整改已确认")
    $app.save(rect)

    issue.set("rectification_status", "CONFIRMED")
    issue.set("close_status", "CLOSED")
    issue.set("closed_at", H.pbDate())
    $app.save(issue)
    H.writeIssueEvent(issue, "rectification_confirmed", "SUBMITTED", "CONFIRMED", ctx, comment, { rectification: rect.id })
    H.writeIssueEvent(issue, "issue_closed", "OPEN", "CLOSED", ctx, "整改确认后关闭", {})
    const empUser = H.findEmployeeUser(String(issue.get("employee") || ""))
    if (empUser) H.createNotification(String(issue.get("tenant") || ""), empUser.id, String(issue.get("employee") || ""), "整改已确认，问题关闭", comment || "您的整改已通过确认，相关问题已关闭。", "issue_closed", "/employee/issues")
    g.writeAudit(e, ctx, "rectification_confirm", "rectifications", rect.id, { comment })
    return e.json(200, rect.publicExport())
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "确认失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "确认失败") })
  }
})

// 管理端派发整改
routerAdd("POST", "/api/yuqi/issues/{id}/rectifications", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["SUPER_ADMIN", "ADMIN", "COMPLIANCE"])
    const issue = H.findRecord("issues", e.request.pathValue("id"))
    if (!issue) throw new NotFoundError("问题不存在")
    g.assertVisible(e, ctx, issue, { storeField: "store", employeeField: "employee" })
    const body = e.requestInfo().body || {}
    const coll = $app.findCollectionByNameOrId("rectifications")
    const rec = new Record(coll)
    rec.set("tenant", ctx.tenantId)
    rec.set("issue", issue.id)
    rec.set("employee", String(body.employee || issue.get("employee") || ""))
    rec.set("store", String(body.store || issue.get("store") || ""))
    rec.set("title", String(body.title || "问题整改：" + String(issue.get("title") || issue.get("rule_code") || "")).slice(0, 200))
    rec.set("remediation_type", String(body.remediation_type || "ISSUE_REMEDIATION").slice(0, 40))
    rec.set("requirements", String(body.requirements || issue.get("advice") || "").slice(0, 2000))
    rec.set("status", "PENDING")
    rec.set("due_at", String(body.due_at || H.pbDate(new Date(Date.now() + 7 * 24 * 3600 * 1000))).slice(0, 40))
    rec.set("retry_count", 0)
    $app.save(rec)
    issue.set("rectification_status", "PENDING")
    $app.save(issue)
    H.writeIssueEvent(issue, "rectification_created", "NONE", "PENDING", ctx, "管理端派发整改", { rectification: rec.id })
    const empUser = H.findEmployeeUser(String(rec.get("employee") || ""))
    if (empUser) H.createNotification(ctx.tenantId, empUser.id, String(rec.get("employee") || ""), "收到整改任务", String(rec.get("requirements") || "").slice(0, 200), "rectification_new", "/employee/rectifications")
    g.writeAudit(e, ctx, "rectification_dispatch", "rectifications", rec.id, {})
    return e.json(200, rec.publicExport())
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "派发失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "派发失败") })
  }
})

// ============================================================
// 设备绑定
// ============================================================

// 员工申请绑定
routerAdd("POST", "/api/yuqi/device-bindings/request", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["EMPLOYEE"])
    const body = e.requestInfo().body || {}
    const deviceNo = String(body.device_no || body.device_sn || "").trim()
    if (!deviceNo) throw new BadRequestError("请输入设备码")
    let device = null
    try {
      device = $app.findFirstRecordByFilter("devices", "device_no = {:d}", { d: deviceNo })
    } catch (_) {
      device = null
    }
    if (!device) throw new NotFoundError("设备不存在")
    const employeeId = String(ctx.user.get("employee") || "")
    const employee = H.findRecord("employees", employeeId)
    if (!employee) throw new BadRequestError("账号未关联员工")
    const storeId = String(employee.get("store") || "")

    const coll = $app.findCollectionByNameOrId("device_bindings")
    const rec = new Record(coll)
    rec.set("tenant", ctx.tenantId)
    rec.set("device", device.id)
    rec.set("employee", employeeId)
    rec.set("store", storeId)
    rec.set("status", "REQUESTED")
    rec.set("effective_date", H.pbDate())
    rec.set("request_by", ctx.user.id)
    $app.save(rec)
    g.writeAudit(e, ctx, "binding_request", "device_bindings", rec.id, { device_no: deviceNo })
    return e.json(200, rec.publicExport())
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "申请失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "申请失败") })
  }
})

// 店长/管理员审批绑定 (事务: 结束旧活跃绑定 + 新绑定生效)
routerAdd("POST", "/api/yuqi/device-bindings/{id}/approve", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["SUPER_ADMIN", "ADMIN", "COMPLIANCE", "STORE_MANAGER"])
    g.requirePermission(e, ctx, "device.manage")
    const binding = H.findRecord("device_bindings", e.request.pathValue("id"))
    if (!binding) throw new NotFoundError("绑定申请不存在")
    if (String(binding.get("status") || "") !== "REQUESTED") throw new BadRequestError("该申请已处理")
    const storeId = String(binding.get("store") || "")
    // 店长只能审批本店员工与本店设备
    if (ctx.roleCode === "STORE_MANAGER") {
      const myStore = String(ctx.user.get("assigned_store") || "")
      if (!myStore || myStore !== storeId) throw new ForbiddenError("仅可审批本店绑定")
    }
    const employeeId = String(binding.get("employee") || "")
    const deviceId = String(binding.get("device") || "")

    // 录音知情确认检查
    let consent = null
    try {
      const rows = $app.findRecordsByFilter("recording_consents", "employee = {:e}", "-created", 1, 0, { e: employeeId })
      consent = rows.length > 0 ? rows[0] : null
    } catch (_) {
      consent = null
    }
    if (!consent || !consent.get("agreed")) {
      throw new BadRequestError("员工尚未确认录音知情同意，绑定前请先完成录音制度确认")
    }

    // 事务: 结束旧活跃绑定 + 新绑定生效 (条件 UPDATE 单语句原子)
    $app.db().newQuery("UPDATE `device_bindings` SET `status` = 'ENDED' WHERE `device` = {:d} AND `status` = 'ACTIVE' AND `id` <> {:bid}").bind({ d: deviceId, bid: binding.id }).execute()
    binding.set("status", "ACTIVE")
    binding.set("approved_by", ctx.user.id)
    binding.set("approved_at", H.pbDate())
    $app.save(binding)

    try {
      const devRec = $app.findRecordById("devices", deviceId)
      if (devRec) {
        devRec.set("current_store", storeId)
        devRec.set("current_employee", employeeId)
        devRec.set("status", "IN_USE")
        $app.save(devRec)
      }
    } catch (_) {}

    const issueTenant = ctx.tenantId
    g.writeAudit(e, ctx, "binding_approve", "device_bindings", binding.id, {})
    try {
      const empUser = H.findEmployeeUser(employeeId)
      if (empUser) H.createNotification(issueTenant, empUser.id, employeeId, "设备绑定已生效", "您的设备绑定申请已通过审批，可正常使用。", "binding_approved", "/employee/device")
    } catch (_) {}
    return e.json(200, binding.publicExport())
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "审批失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "审批失败") })
  }
})

routerAdd("POST", "/api/yuqi/device-bindings/{id}/reject", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["SUPER_ADMIN", "ADMIN", "COMPLIANCE", "STORE_MANAGER"])
    g.requirePermission(e, ctx, "device.manage")
    const binding = H.findRecord("device_bindings", e.request.pathValue("id"))
    if (!binding) throw new NotFoundError("绑定申请不存在")
    if (String(binding.get("status") || "") !== "REQUESTED") throw new BadRequestError("该申请已处理")
    if (ctx.roleCode === "STORE_MANAGER") {
      const myStore = String(ctx.user.get("assigned_store") || "")
      if (!myStore || myStore !== String(binding.get("store") || "")) throw new ForbiddenError("仅可审批本店绑定")
    }
    binding.set("status", "REJECTED")
    binding.set("approved_by", ctx.user.id)
    binding.set("approved_at", H.pbDate())
    $app.save(binding)
    g.writeAudit(e, ctx, "binding_reject", "device_bindings", binding.id, {})
    return e.json(200, binding.publicExport())
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "操作失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "操作失败") })
  }
})

// ============================================================
// 录音知情确认 (员工)
// ============================================================

routerAdd("POST", "/api/yuqi/employee/consent", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["EMPLOYEE"])
    const body = e.requestInfo().body || {}
    if (!body.agreed) throw new BadRequestError("请确认录音知情同意")
    const employeeId = String(ctx.user.get("employee") || "")
    const employee = H.findRecord("employees", employeeId)
    if (!employee) throw new BadRequestError("账号未关联员工")
    const storeId = String(employee.get("store") || "")
    let consent = null
    try {
      const rows = $app.findRecordsByFilter("recording_consents", "employee = {:e}", "-created", 1, 0, { e: employeeId })
      consent = rows.length > 0 ? rows[0] : null
    } catch (_) {
      consent = null
    }
    const coll = $app.findCollectionByNameOrId("recording_consents")
    if (!consent) {
      consent = new Record(coll)
      consent.set("tenant", ctx.tenantId)
      consent.set("employee", employeeId)
      consent.set("store", storeId)
    }
    consent.set("agreed", true)
    consent.set("content_version", String(body.content_version || "v1").slice(0, 40))
    consent.set("agreed_at", H.pbDate())
    consent.set("ip", g.clientIp(e))
    $app.save(consent)
    g.writeAudit(e, ctx, "consent_confirm", "recording_consents", consent.id, {})
    return e.json(200, consent.publicExport())
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "确认失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "确认失败") })
  }
})

// ============================================================
// 通知 (员工)
// ============================================================

routerAdd("POST", "/api/yuqi/notifications/{id}/read", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    const rec = H.findRecord("notifications", e.request.pathValue("id"))
    if (!rec) throw new NotFoundError("通知不存在")
    if (String(rec.get("user") || "") !== ctx.user.id) throw new NotFoundError("通知不存在")
    rec.set("is_read", true)
    rec.set("read_at", H.pbDate())
    $app.save(rec)
    return e.json(200, rec.publicExport())
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "操作失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "操作失败") })
  }
})

routerAdd("POST", "/api/yuqi/notifications/read-all", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    const rows = $app.findRecordsByFilter("notifications", "user = {:u} && is_read = false", "", 500, 0, { u: ctx.user.id })
    for (let i = 0; i < rows.length; i++) {
      rows[i].set("is_read", true)
      rows[i].set("read_at", H.pbDate())
      $app.save(rows[i])
    }
    return e.json(200, { ok: true, marked: rows.length })
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "操作失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "操作失败") })
  }
})

// ============================================================
// 员工自助
// ============================================================

routerAdd("GET", "/api/yuqi/employee/home", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["EMPLOYEE"])
    const employeeId = String(ctx.user.get("employee") || "")
    const tenantId = ctx.tenantId

    const myIssues = $app.findRecordsByFilter("issues",
      "tenant = {:t} && employee = {:e} && review_status = 'APPROVED' && employee_visibility = 'VISIBLE' && close_status = 'OPEN'",
      "-created", 200, 0, { t: tenantId, e: employeeId })
    const myRectifications = $app.findRecordsByFilter("rectifications",
      "tenant = {:t} && employee = {:e} && (status = 'PENDING' || status = 'NEEDS_REVISION' || status = 'SUBMITTED')",
      "-created", 200, 0, { t: tenantId, e: employeeId })
    const myAppeals = $app.findRecordsByFilter("appeals",
      "tenant = {:t} && employee = {:e} && (status = 'PENDING' || status = 'NEEDS_MORE_INFO')",
      "-created", 200, 0, { t: tenantId, e: employeeId })
    const unread = $app.findRecordsByFilter("notifications", "user = {:u} && is_read = false", "", 200, 0, { u: ctx.user.id })

    let binding = null
    try {
      const rows = $app.findRecordsByFilter("device_bindings", "tenant = {:t} && employee = {:e} && status = 'ACTIVE'", "-created", 1, 0, { t: tenantId, e: employeeId })
      binding = rows.length > 0 ? rows[0].publicExport() : null
    } catch (_) {
      binding = null
    }
    let consent = false
    try {
      const rows = $app.findRecordsByFilter("recording_consents", "employee = {:e}", "-created", 1, 0, { e: employeeId })
      consent = rows.length > 0 && !!rows[0].get("agreed")
    } catch (_) {
      consent = false
    }

    return e.json(200, {
      issue_count: myIssues.length,
      rectification_count: myRectifications.length,
      appeal_count: myAppeals.length,
      unread_notifications: unread.length,
      binding,
      consent,
      server_time: g.nowIso(),
    })
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "加载失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "加载失败") })
  }
})

// 员工本人已推送问题列表
routerAdd("GET", "/api/yuqi/employee/issues", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["EMPLOYEE"])
    const employeeId = String(ctx.user.get("employee") || "")
    const query = e.requestInfo().query || {}
    const page = parseInt(String(query.page || "1"), 10) || 1
    const perPage = Math.min(Math.max(parseInt(String(query.perPage || "20"), 10) || 20, 1), 100)
      const filter = "tenant = {:t} && employee = {:e} && review_status = 'APPROVED' && employee_visibility = 'VISIBLE'"
      const params = { t: ctx.tenantId, e: employeeId }
      const records = $app.findRecordsByFilter("issues", filter, "-created", perPage, (page - 1) * perPage, params)
      const items = []
    for (let i = 0; i < records.length; i++) items.push(records[i].publicExport())
    return e.json(200, { items, page, perPage, totalItems: items.length })
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "加载失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "加载失败") })
  }
})

// 员工问题详情 + 证据片段
routerAdd("GET", "/api/yuqi/employee/issues/{id}", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["EMPLOYEE"])
    const issue = H.findRecord("issues", e.request.pathValue("id"))
    if (!issue) throw new NotFoundError("问题不存在")
    H.assertIssueVisibleToEmployee(e, ctx, issue)
    // 证据片段 (risk_segments)
    let segments = []
    try {
      const rows = $app.findRecordsByFilter("risk_segments",
        "tenant = {:t} && session = {:s} && rule_code = {:r} && analysis_version = {:v}",
        "sequence", 200, 0,
        { t: ctx.tenantId, s: String(issue.get("session") || ""), r: String(issue.get("rule_code") || ""), v: Number(issue.get("analysis_version") || 0) })
      for (let i = 0; i < rows.length; i++) segments.push(rows[i].publicExport())
    } catch (_) {
      segments = []
    }
    // 标记已读
    issue.set("employee_view_status", "READ")
    $app.save(issue)
    return e.json(200, { issue: issue.publicExport(), segments })
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "加载失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "加载失败") })
  }
})

// 员工我的设备
routerAdd("GET", "/api/yuqi/employee/device", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["EMPLOYEE"])
    const employeeId = String(ctx.user.get("employee") || "")
    let binding = null
    try {
      const rows = $app.findRecordsByFilter("device_bindings", "tenant = {:t} && employee = {:e} && status = 'ACTIVE'", "-created", 1, 0, { t: ctx.tenantId, e: employeeId })
      binding = rows.length > 0 ? rows[0].publicExport() : null
    } catch (_) {
      binding = null
    }
    let device = null
    if (binding && binding.device) {
      device = H.findRecord("devices", String(binding.device))
      device = device ? device.publicExport() : null
    }
    let consent = false
    try {
      const rows = $app.findRecordsByFilter("recording_consents", "employee = {:e}", "-created", 1, 0, { e: employeeId })
      consent = rows.length > 0 && !!rows[0].get("agreed")
    } catch (_) {
      consent = false
    }
    return e.json(200, { binding, device, consent })
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "加载失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "加载失败") })
  }
})

// 员工个人信息
routerAdd("GET", "/api/yuqi/employee/profile", (e) => {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var H = require(`${__hooks}/_lib/phase1-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["EMPLOYEE"])
    const employee = H.findRecord("employees", String(ctx.user.get("employee") || ""))
    let store = null
    if (employee && employee.get("store")) store = H.findRecord("stores", String(employee.get("store")))
    return e.json(200, {
      user: {
        id: ctx.user.id,
        display_name: ctx.user.get("display_name"),
        email: ctx.user.get("email"),
        mobile: ctx.user.get("mobile"),
        role_code: ctx.user.get("role_code"),
      },
      employee: employee ? employee.publicExport() : null,
      store: store ? store.publicExport() : null,
    })
  } catch (err) {
    var H2 = H || (() => { try { return require(`${__hooks}/_lib/phase1-helpers.js`) } catch(_) { return null } })()
    return H2 ? H2.responseError(e, err, "加载失败") : e.json(Number(err && err.status) || 500, { error: "error", message: String(err && err.message || err || "加载失败") })
  }
})
