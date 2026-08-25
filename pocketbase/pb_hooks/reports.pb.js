// pb_hooks/reports.pb.js — 服务端聚合报表与受限导出
//
// GET /api/reports/overview?from=&to=
//   - 需要登录 (ADMIN/COMPLIANCE/REGION_MANAGER/STORE_MANAGER/AUDITOR)
//   - 数据范围: tenant + 用户数据范围
//   - 全部统计在服务端聚合, 浏览器不拉取全量数据
// GET /api/reports/export/issues?from=&to=
//   - 同上权限; 导出 CSV, 包含租户/操作人/导出时间/数据范围/请求ID
//   - 写入 audit_logs (report_export)

routerAdd("GET", "/api/reports/overview", function (e) {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["ADMIN", "COMPLIANCE", "REGION_MANAGER", "STORE_MANAGER", "AUDITOR"])

    var query = e.requestInfo().query || {}
    var from = String(query["from"] || "")
    var to = String(query["to"] || "")
    var nowIso = new Date().toISOString()
    if (!from || from.length < 10) {
      var d = new Date()
      d.setHours(0, 0, 0, 0)
      from = d.toISOString()
    }
    if (!to) to = nowIso

    var scope = g.buildScopeFilter(e, ctx, { storeField: "store", employeeField: "employee" })
    var storeScope = g.buildScopeFilter(e, ctx, { storeField: "id", storeType: "text", employeeField: "id", employeeType: "text" })

    function text(rec, field) {
      try {
        var v = rec.get(field)
        if (v === null || v === undefined) return ""
        return String(v)
      } catch (err) {
        return ""
      }
    }
    function idOf(v) {
      if (Array.isArray(v)) return v.length > 0 ? String(v[0]) : ""
      return String(v || "")
    }
    function num(v) {
      var n = Number(v)
      return Number.isFinite(n) ? n : 0
    }
    function rate(part, total) {
      return total > 0 ? Math.round((part / total) * 1000) / 10 : 0
    }
    function listAll(coll, filter, params, max) {
      try {
        var recs = $app.findRecordsByFilter(coll, filter, "", max || 2000, 0, params)
        return recs || []
      } catch (err) {
        return []
      }
    }
    function inRange(rec, fieldName) {
      var v = text(rec, fieldName || "created")
      return !!v && v >= from && v <= to
    }

    // ---- 门店/员工名称索引 ----
    var storeName = {}
    var empName = {}
    var stores = listAll("stores", storeScope.filter, storeScope.params, 5000)
    for (var si = 0; si < stores.length; si++) storeName[text(stores[si], "id")] = text(stores[si], "name") || text(stores[si], "code")
    var emps = listAll("employees", scope.filter, scope.params, 5000)
    for (var ei = 0; ei < emps.length; ei++) empName[text(emps[ei], "id")] = text(emps[ei], "name") || text(emps[ei], "employee_no")

    // ---- 录音 / 转写 / 会话 ----
    var audios = listAll("audio_files", scope.filter, scope.params, 10000)
    var audioToday = 0
    for (var ai = 0; ai < audios.length; ai++) if (inRange(audios[ai], "created")) audioToday++
    var transcripts = listAll("transcripts", scope.filter, scope.params, 10000)
    var transcriptToday = 0
    for (var ti = 0; ti < transcripts.length; ti++) if (inRange(transcripts[ti], "created")) transcriptToday++
    var sessions = listAll("sessions", scope.filter, scope.params, 10000)
    var sessionToday = 0
    for (var s1 = 0; s1 < sessions.length; s1++) if (inRange(sessions[s1], "created")) sessionToday++

    // ---- 疑似问题 ----
    var issues = listAll("issues", scope.filter, scope.params, 10000)
    var issuesTotal = issues.length
    var issuesInRange = 0
    var riskDist = { HIGH: 0, MEDIUM: 0, LOW: 0 }
    var reviewDist = { PENDING: 0, APPROVED: 0, DISMISSED: 0 }
    var finalValid = 0
    var falsePositive = 0
    var pushed = 0
    var pendingReview = 0
    var storeIssueCount = {}
    var empIssueCount = {}
    for (var ii = 0; ii < issues.length; ii++) {
      var iss = issues[ii]
      var rl = String(text(iss, "risk_level")).toUpperCase()
      var rv = String(text(iss, "review_status")).toUpperCase()
      var cl = String(text(iss, "close_status")).toUpperCase()
      var appeal = String(text(iss, "appeal_status")).toUpperCase()
      if (riskDist[rl] === undefined) riskDist[rl] = 0
      riskDist[rl]++
      if (reviewDist[rv] === undefined) reviewDist[rv] = 0
      reviewDist[rv]++
      if (rv === "PENDING") pendingReview++
      if (inRange(iss, "created")) issuesInRange++
      // 最终有效: 已复核通过 且 非误报 且 申诉未成立 且 未关闭为误报
      var isFP = text(iss, "is_false_positive") === "true" || rv === "DISMISSED"
      if (isFP) falsePositive++
      var appealUpheld = appeal === "APPROVED"
      if (rv === "APPROVED" && !isFP && !appealUpheld) finalValid++
      if (text(iss, "pushed_to_employee") === "true") pushed++
      var iStore = idOf(iss.get("store"))
      if (iStore) storeIssueCount[iStore] = (storeIssueCount[iStore] || 0) + 1
      var iEmp = idOf(iss.get("employee"))
      if (iEmp) empIssueCount[iEmp] = (empIssueCount[iEmp] || 0) + 1
    }

    // ---- 申诉 ----
    var appeals = listAll("appeals", scope.filter, scope.params, 10000)
    var appealTotal = appeals.length
    var appealPending = 0
    var appealApproved = 0
    var appealRejected = 0
    for (var ap = 0; ap < appeals.length; ap++) {
      var as = String(text(appeals[ap], "status")).toUpperCase()
      if (as === "PENDING" || as === "NEEDS_MORE_INFO") appealPending++
      else if (as === "APPROVED") appealApproved++
      else if (as === "REJECTED") appealRejected++
    }

    // ---- 整改 ----
    var rects = listAll("rectifications", scope.filter, scope.params, 10000)
    var rectTotal = rects.length
    var rectConfirmed = 0
    var rectOverdue = 0
    for (var ri = 0; ri < rects.length; ri++) {
      var rs = String(text(rects[ri], "status")).toUpperCase()
      if (rs === "CONFIRMED") rectConfirmed++
      else {
        var due = text(rects[ri], "due_at")
        if (due && due < nowIso && rs !== "CANCELLED") rectOverdue++
      }
    }

    // ---- 门店排行 / 员工分布 ----
    var storeRank = []
    var rankKeys = Object.keys(storeIssueCount)
    rankKeys.sort(function (x, y) { return storeIssueCount[y] - storeIssueCount[x] })
    for (var rki = 0; rki < rankKeys.length && rki < 10; rki++) {
      var rk = rankKeys[rki]
      storeRank.push({ store_id: rk, store_name: storeName[rk] || "未知门店", issue_count: storeIssueCount[rk], share: rate(storeIssueCount[rk], issuesTotal) })
    }
    var empRank = []
    var empKeys = Object.keys(empIssueCount)
    empKeys.sort(function (x, y) { return empIssueCount[y] - empIssueCount[x] })
    for (var eki = 0; eki < empKeys.length && eki < 10; eki++) {
      var ek = empKeys[eki]
      empRank.push({ employee_id: ek, employee_name: empName[ek] || "未知员工", issue_count: empIssueCount[ek] })
    }

    // ---- 设备在线率 ----
    var devices = listAll("devices", storeScope.filter, storeScope.params, 10000)
    var deviceTotal = devices.length
    var deviceOnline = 0
    var onlineWindow = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    for (var di = 0; di < devices.length; di++) {
      var ds = String(text(devices[di], "status")).toUpperCase()
      var lastSeen = text(devices[di], "last_online_at")
      if (ds === "ONLINE" || ds === "ACTIVE" || (lastSeen && lastSeen >= onlineWindow)) deviceOnline++
    }

    // ---- ASR / 分析任务 ----
    var asrJobs = listAll("asr_jobs", scope.filter, scope.params, 10000)
    var asrTotal = asrJobs.length
    var asrSucceeded = 0
    var asrFailed = 0
    for (var aji = 0; aji < asrJobs.length; aji++) {
      var ajs = String(text(asrJobs[aji], "status")).toUpperCase()
      if (ajs === "SUCCEEDED" || ajs === "COMPLETED" || ajs === "DONE") asrSucceeded++
      else if (ajs === "FAILED" || ajs === "ERROR") asrFailed++
    }

    var jobs = listAll("processing_jobs", scope.filter, scope.params, 10000)
    var analysisTotal = 0
    var analysisSucceeded = 0
    var analysisFailed = 0
    var jobsPending = 0
    for (var ji = 0; ji < jobs.length; ji++) {
      var jt = String(text(jobs[ji], "job_type")).toUpperCase()
      if (jt !== "RISK_ANALYSIS") continue
      analysisTotal++
      var js = String(text(jobs[ji], "status")).toUpperCase()
      if (js === "SUCCEEDED") analysisSucceeded++
      else if (js === "FAILED") analysisFailed++
      else if (js === "QUEUED" || js === "RUNNING" || js === "RETRYING") jobsPending++
    }

    return e.json(200, {
      generated_at: nowIso,
      range: { from: from, to: to, scope: ctx.scope ? ctx.scope.type : "ALL" },
      recordings: { total: audios.length, in_range: audioToday },
      transcripts: { total: transcripts.length, in_range: transcriptToday },
      sessions: { total: sessions.length, in_range: sessionToday },
      issues: {
        total: issuesTotal,
        in_range: issuesInRange,
        pending_review: pendingReview,
        pushed: pushed,
        risk_distribution: riskDist,
        review_distribution: reviewDist,
        final_valid: finalValid,
        false_positive: falsePositive,
      },
      appeals: { total: appealTotal, pending: appealPending, approved: appealApproved, rejected: appealRejected, approval_rate: rate(appealApproved, appealApproved + appealRejected) },
      rectifications: { total: rectTotal, confirmed: rectConfirmed, overdue: rectOverdue, completion_rate: rate(rectConfirmed, rectTotal) },
      devices: { total: deviceTotal, online: deviceOnline, online_rate: rate(deviceOnline, deviceTotal) },
      asr: { total: asrTotal, succeeded: asrSucceeded, failed: asrFailed, success_rate: rate(asrSucceeded, asrTotal) },
      analysis_jobs: { total: analysisTotal, succeeded: analysisSucceeded, failed: analysisFailed, pending: jobsPending, success_rate: rate(analysisSucceeded, analysisTotal) },
      store_rank: storeRank,
      employee_distribution: empRank,
      disclaimer: "系统识别结果仅为疑似风险，最终判断由授权管理人员完成。",
    })
  } catch (err) {
    var gm = null
    try {
      gm = require(`${__hooks}/_lib/guards.js`)
    } catch (_) {}
    var msg = gm ? gm.safeMessage(err) : String(err && err.message || err)
    var code = Number(err && err.status) || 500
    if (code < 400 || code > 599) code = 500
    return e.json(code, { code: code, message: msg })
  }
})

// ---- 导出 (CSV) ----
routerAdd("GET", "/api/reports/export/issues", function (e) {
  try {
    var g = require(`${__hooks}/_lib/guards.js`)
    var ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["ADMIN", "COMPLIANCE", "REGION_MANAGER", "STORE_MANAGER", "AUDITOR"])

    var query = e.requestInfo().query || {}
    var from = String(query["from"] || "")
    var to = String(query["to"] || "")
    var nowIso = new Date().toISOString()
    if (!from || from.length < 10) {
      var d = new Date()
      d.setHours(0, 0, 0, 0)
      from = d.toISOString()
    }
    if (!to) to = nowIso

    var scope = g.buildScopeFilter(e, ctx, { storeField: "store", employeeField: "employee" })

    function text(rec, field) {
      try {
        var v = rec.get(field)
        if (v === null || v === undefined) return ""
        return String(v)
      } catch (err) {
        return ""
      }
    }
    function idOf(v) {
      if (Array.isArray(v)) return v.length > 0 ? String(v[0]) : ""
      return String(v || "")
    }
    function csv(s) {
      var str = String(s === null || s === undefined ? "" : s)
      return '"' + str.replace(/"/g, '""') + '"'
    }

    var tenantName = ""
    try {
      var tenant = $app.findRecordById("tenants", ctx.tenantId)
      tenantName = text(tenant, "name") || text(tenant, "code")
    } catch (_) {}

    var storeName = {}
    var empName = {}
    var stores = $app.findRecordsByFilter("stores", scope.filter, "", 5000, 0, scope.params)
    for (var si = 0; si < stores.length; si++) storeName[text(stores[si], "id")] = text(stores[si], "name") || text(stores[si], "code")
    var emps = $app.findRecordsByFilter("employees", scope.filter, "", 5000, 0, scope.params)
    for (var ei = 0; ei < emps.length; ei++) empName[text(emps[ei], "id")] = text(emps[ei], "name")

    var issues = $app.findRecordsByFilter("issues", scope.filter, "-created", 10000, 0, scope.params)
    var lines = []
    lines.push(csv("租户") + "," + csv(tenantName))
    lines.push(csv("操作人") + "," + csv(ctx.kind === "user" && ctx.user ? text(ctx.user, "display_name") : "service"))
    lines.push(csv("操作账号") + "," + csv(ctx.kind === "user" && ctx.user ? text(ctx.user, "email") : "service"))
    lines.push(csv("导出时间") + "," + csv(nowIso))
    lines.push(csv("数据范围") + "," + csv(ctx.scope ? ctx.scope.type : "ALL"))
    lines.push(csv("请求ID") + "," + csv(g.requestId(e)))
    lines.push(csv("时间范围") + "," + csv(from + " ~ " + to))
    lines.push(csv("说明") + "," + csv("系统识别结果仅为疑似风险，最终判断由授权管理人员完成。"))
    lines.push("")
    lines.push([
      "问题ID", "门店", "员工", "风险等级", "规则编码", "复核状态", "申诉状态", "整改状态",
      "关闭状态", "标题", "证据文本", "建议", "推荐表达", "命中时间", "创建时间",
    ].map(csv).join(","))

    var exported = 0
    for (var ii = 0; ii < issues.length; ii++) {
      var iss = issues[ii]
      var created = text(iss, "created")
      if (created < from || created > to) continue
      lines.push([
        text(iss, "id"),
        storeName[idOf(iss.get("store"))] || "",
        empName[idOf(iss.get("employee"))] || "",
        text(iss, "risk_level"),
        text(iss, "rule_code"),
        text(iss, "review_status"),
        text(iss, "appeal_status"),
        text(iss, "rectification_status"),
        text(iss, "close_status"),
        text(iss, "title"),
        text(iss, "evidence_text"),
        text(iss, "advice"),
        text(iss, "recommended_expression"),
        text(iss, "created"),
        created,
      ].map(csv).join(","))
      exported++
    }

    g.writeAudit(e, ctx, "report_export", "issues", "", { from: from, to: to, rows: exported, scope: ctx.scope ? ctx.scope.type : "ALL" })

    var body = lines.join("\r\n")
    var filename = "issues_" + nowIso.replace(/[:.]/g, "-").slice(0, 19) + ".csv"
    e.response.header().set("Content-Type", "text/csv; charset=utf-8")
    e.response.header().set("Content-Disposition", 'attachment; filename="' + filename + '"')
    return e.string(200, body)
  } catch (err) {
    var gm = null
    try {
      gm = require(`${__hooks}/_lib/guards.js`)
    } catch (_) {}
    var msg = gm ? gm.safeMessage(err) : String(err && err.message || err)
    var code = Number(err && err.status) || 500
    if (code < 400 || code > 599) code = 500
    return e.json(code, { code: code, message: msg })
  }
})
