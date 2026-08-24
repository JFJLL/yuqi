// pb_hooks/admin_dashboard.pb.js — 工作台聚合路由 (服务端聚合, 受保护)
//
// GET /api/admin/dashboard/summary?tab=all|high|appealing
//   - 需要登录 (ADMIN/COMPLIANCE/REGION_MANAGER/STORE_MANAGER/AUDITOR)
//   - 数据范围: tenant + 用户数据范围
//
// 演示 seed 已移除, 幂等 seed 见 scripts/seed-phase1-demo.mjs (仅 dev/test)。
// 不再提供匿名 /api/admin/seed。

routerAdd("GET", "/api/admin/dashboard/summary", function (e) {
  try {

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

function startOfToday() {
  var d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function closedStates() {
  return ["CLOSED", "CONFIRMED", "DONE", "已完成", "已关闭"]
}

function isClosed(state) {
  var s = String(state || "")
  var list = closedStates()
  for (var i = 0; i < list.length; i++) {
    if (s === list[i]) return true
  }
  return false
}

function openIssueStates() {
  return ["open", "OPEN", "pending", "PENDING", "reviewing", "REVIEWING", "待复核", "待处理", "进行中"]
}

function isOpenIssue(state) {
  var s = String(state || "")
  var list = openIssueStates()
  for (var i = 0; i < list.length; i++) {
    if (s === list[i]) return true
  }
  return false
}
    var g = require(`${__hooks}/_lib/guards.js`)
    var ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["ADMIN", "COMPLIANCE", "REGION_MANAGER", "STORE_MANAGER", "AUDITOR"])

    var query = e.requestInfo().query || {}
    var tab = String(query["tab"] || "all")

    var scope = g.buildScopeFilter(e, ctx, {
      storeField: "store",
      employeeField: "employee",
    })

    // 门店名称/员工名称索引
    var storeName = {}
    var empName = {}
    try {
      var stores = $app.findRecordsByFilter("stores", scope.filter, "", 500, 0, scope.params)
      for (var si = 0; si < stores.length; si++) storeName[text(stores[si], "id")] = text(stores[si], "name") || text(stores[si], "code")
    } catch (_) {}
    try {
      var emps = $app.findRecordsByFilter("employees", scope.filter, "", 500, 0, scope.params)
      for (var ei = 0; ei < emps.length; ei++) empName[text(emps[ei], "id")] = text(emps[ei], "name")
    } catch (_) {}

    var today = startOfToday()
    var nowIso = new Date().toISOString()
    var todayFilter = scope.filter + " && created >= {:today}"
    var todayParams = Object.assign({}, scope.params, { today: today })

    function countAll(coll, filter, params, max) {
      try {
        var recs = $app.findRecordsByFilter(coll, filter, "", max || 500, 0, params)
        return recs || []
      } catch (err) {
        return []
      }
    }

    var transcriptsToday = countAll("transcripts", todayFilter, todayParams, 500)
    var covered = {}
    for (var ti = 0; ti < transcriptsToday.length; ti++) {
      var sid = idOf(transcriptsToday[ti].get("store"))
      if (sid) covered[sid] = true
    }

    var issues = countAll("inspection_issues", scope.filter, scope.params, 500)
    var issuesToday = []
    var highRisk = 0
    var openCount = 0
    var storeCount = {}
    var keyIssues = []
    for (var ii = 0; ii < issues.length; ii++) {
      var iss = issues[ii]
      var created = text(iss, "created")
      var risk = text(iss, "risk").toLowerCase()
      var state = text(iss, "state")
      var iStore = idOf(iss.get("store"))
      if (created && created >= today) issuesToday.push(iss)
      if (risk === "high" && !isClosed(state)) highRisk++
      if (isOpenIssue(state)) openCount++
      if (iStore) storeCount[iStore] = (storeCount[iStore] || 0) + 1
    }

    // 按 tab 过滤 key_issues
    for (var kj = 0; kj < issues.length; kj++) {
      var k = issues[kj]
      var kState = text(k, "state")
      var kRisk = text(k, "risk")
      var include = true
      if (tab === "high" && String(kRisk).toLowerCase() !== "high") include = false
      if (tab === "appealing") {
        // 有申诉的问题
        include = false
        try {
          var ap = $app.findFirstRecordByFilter("appeals", "issue = {:i}", { i: text(k, "id") })
          if (ap) include = true
        } catch (_) {}
      }
      if (include) {
        keyIssues.push({
          id: text(k, "id"),
          employee_name: empName[idOf(k.get("employee"))] || "未知员工",
          store_name: storeName[idOf(k.get("store"))] || "未知门店",
          issue_type: text(k, "issue_type") || text(k, "category") || "",
          risk: kRisk,
          state: kState,
          quote: text(k, "quote"),
          advice: text(k, "advice"),
          occurred_at: text(k, "occurred_at") || text(k, "created"),
        })
      }
    }
    keyIssues = keyIssues.slice(0, 8)

    var rectifyTasks = countAll("rectify_tasks", scope.filter, scope.params, 500)
    var closedTasks = 0
    var openTasks = 0
    var overdueTasks = 0
    for (var rt = 0; rt < rectifyTasks.length; rt++) {
      var r = rectifyTasks[rt]
      var rs = text(r, "status")
      if (isClosed(rs)) {
        closedTasks++
      } else {
        openTasks++
        var due = text(r, "due_at")
        if (due && due < nowIso) overdueTasks++
      }
    }
    var rectifyRate = rectifyTasks.length > 0 ? Math.round((closedTasks / rectifyTasks.length) * 100) : 0

    var appeals = countAll("appeals", scope.filter, scope.params, 500)
    var pendingAppeals = 0
    var overdueAppeals = 0
    var threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
    for (var ai = 0; ai < appeals.length; ai++) {
      var a = appeals[ai]
      var as = text(a, "status")
      if (as === "PENDING" || as === "pending") {
        pendingAppeals++
        if (text(a, "created") < threeDaysAgo) overdueAppeals++
      }
    }

    var storeRank = []
    var rankKeys = Object.keys(storeCount)
    rankKeys.sort(function (x, y) { return storeCount[y] - storeCount[x] })
    for (var ri = 0; ri < rankKeys.length && ri < 5; ri++) {
      var sk = rankKeys[ri]
      var cnt = storeCount[sk]
      var share = issues.length > 0 ? Math.round((cnt / issues.length) * 1000) / 10 : 0
      storeRank.push({ store_id: sk, store_name: storeName[sk] || "未知门店", issue_count: cnt, share: share })
    }

    var storesTotal = Object.keys(storeName).length

    return e.json(200, {
      generated_at: nowIso,
      stats: {
        transcripts_today: transcriptsToday.length,
        stores_covered: Object.keys(covered).length,
        stores_total: storesTotal,
        issues_today: issuesToday.length,
        high_risk: highRisk,
        rectify_rate: rectifyRate,
        open_tasks: openTasks,
        overdue_tasks: overdueTasks,
        pending_appeals: pendingAppeals,
        overdue_appeals: overdueAppeals,
      },
      key_issues: keyIssues,
      store_rank: storeRank,
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
