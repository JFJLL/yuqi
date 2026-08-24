// 药店连锁 AI 运营管理后台 — 工作台聚合路由 + 演示数据
// GET  /api/admin/dashboard/summary?tab=all|high|appealing
// POST /api/admin/seed   (幂等: 先清空 7 张业务表再写入演示数据)
// POST /api/admin/sync   (模拟一次数据同步, 返回同步时间)

routerAdd("GET", "/api/admin/dashboard/summary", function (e) {
  try {
    var query = e.requestInfo().query || {}
    var tab = String(query["tab"] || "all")

    function allIn(collName) {
      try {
        var recs = $app.findRecordsByFilter(collName, "id != ''", "", 500, 0)
        return recs || []
      } catch (err) {
        return []
      }
    }

    function text(rec, field) {
      try {
        var v = rec.get(field)
        if (v === null || v === undefined) return ""
        return String(v)
      } catch (err) {
        return ""
      }
    }

    var issues = allIn("inspection_issues")
    var transcripts = allIn("transcripts")
    var tasks = allIn("rectify_tasks")
    var appeals = allIn("appeals")
    var stores = allIn("stores")
    var employees = allIn("employees")

    var storeName = {}
    var si = 0
    for (si = 0; si < stores.length; si++) {
      storeName[text(stores[si], "id")] = text(stores[si], "name")
    }
    var empName = {}
    var ei = 0
    for (ei = 0; ei < employees.length; ei++) {
      empName[text(employees[ei], "id")] = text(employees[ei], "name")
    }

    // 今日巡检文本覆盖的门店
    var covered = {}
    var coveredCount = 0
    var ti = 0
    for (ti = 0; ti < transcripts.length; ti++) {
      var tStore = text(transcripts[ti], "store")
      if (tStore && !covered[tStore]) {
        covered[tStore] = true
        coveredCount++
      }
    }

    // 问题统计
    var highRisk = 0
    var storeIssueCount = {}
    var ii = 0
    for (ii = 0; ii < issues.length; ii++) {
      if (text(issues[ii], "risk") === "高") highRisk++
      var iStore = text(issues[ii], "store")
      if (iStore) {
        storeIssueCount[iStore] = (storeIssueCount[iStore] || 0) + 1
      }
    }

    // 整改完成率
    var taskDone = 0
    var taskOverdue = 0
    var taskOpen = 0
    var ki = 0
    for (ki = 0; ki < tasks.length; ki++) {
      var tState = text(tasks[ki], "state")
      if (tState === "已完成") taskDone++
      if (tState === "逾期") taskOverdue++
      if (tState === "待整改" || tState === "进行中") taskOpen++
    }
    var rectifyRate = 0
    if (tasks.length > 0) {
      rectifyRate = Math.round((taskDone / tasks.length) * 100)
    }

    // 申诉统计 (超过 24 小时未复核)
    var nowMs = new Date().getTime()
    var pendingAppeals = 0
    var overdueAppeals = 0
    var ai = 0
    for (ai = 0; ai < appeals.length; ai++) {
      if (text(appeals[ai], "status") === "待复核") {
        pendingAppeals++
        var createdRaw = text(appeals[ai], "created")
        if (createdRaw) {
          var createdMs = new Date(createdRaw.replace(" ", "T")).getTime()
          if (nowMs - createdMs > 24 * 3600 * 1000) overdueAppeals++
        }
      }
    }

    // 重点问题列表 (按风险等级、发生时间排序)
    function riskWeight(r) {
      if (r === "高") return 3
      if (r === "中") return 2
      return 1
    }
    var filtered = []
    var fi = 0
    for (fi = 0; fi < issues.length; fi++) {
      var risk = text(issues[fi], "risk")
      var state = text(issues[fi], "state")
      if (tab === "high" && risk !== "高") continue
      if (tab === "appealing" && state !== "申诉中") continue
      filtered.push({
        id: text(issues[fi], "id"),
        issue_type: text(issues[fi], "issue_type"),
        risk: risk,
        state: state,
        quote: text(issues[fi], "quote"),
        advice: text(issues[fi], "advice"),
        occurred_at: text(issues[fi], "occurred_at"),
        employee_name: empName[text(issues[fi], "employee")] || "-",
        store_name: storeName[text(issues[fi], "store")] || "-"
      })
    }
    filtered.sort(function (a, b) {
      var w = riskWeight(b.risk) - riskWeight(a.risk)
      if (w !== 0) return w
      return a.occurred_at < b.occurred_at ? 1 : -1
    })

    // 门店排行
    var rank = []
    var storeId = ""
    for (storeId in storeIssueCount) {
      rank.push({
        store_id: storeId,
        store_name: storeName[storeId] || "-",
        issue_count: storeIssueCount[storeId]
      })
    }
    rank.sort(function (a, b) {
      return b.issue_count - a.issue_count
    })
    var maxCount = rank.length > 0 ? rank[0].issue_count : 0
    var ri = 0
    for (ri = 0; ri < rank.length; ri++) {
      rank[ri].share = maxCount > 0 ? Math.round((rank[ri].issue_count / maxCount) * 100) : 0
    }

    return e.json(200, {
      stats: {
        transcripts_today: transcripts.length,
        stores_covered: coveredCount,
        stores_total: stores.length,
        issues_today: issues.length,
        high_risk: highRisk,
        rectify_rate: rectifyRate,
        pending_appeals: pendingAppeals,
        overdue_appeals: overdueAppeals,
        overdue_tasks: taskOverdue,
        open_tasks: taskOpen
      },
      key_issues: filtered,
      store_rank: rank,
      generated_at: new Date().toISOString()
    })
  } catch (err) {
    var msg = String((err && err.message) || err)
    try { $app.logger().error("dashboard_summary_failed: " + msg) } catch (logErr) {}
    return e.json(500, {
      error: "dashboard_summary_failed",
      message: msg,
      fingerprint: msg.slice(0, 80)
    })
  }
})

routerAdd("POST", "/api/admin/seed", function (e) {
  // ---- 安全门 (阶段零) ----
  // 1) 演示数据 seed 仅限开发/测试环境: 生产必须显式 ALLOW_DEMO_SEED=true 才放行,
  //    默认 false 直接拒绝 (本路由会清空 7 张业务表, 绝不接受匿名/默认调用)。
  // 2) 仅 PocketBase 超级管理员可调用。
  // 3) 必须携带 X-Seed-Confirm: 1 二次确认头。
  try {
    if (String(process.env.ALLOW_DEMO_SEED || "") !== "true") {
      return e.json(403, { error: "demo_seed_disabled", message: "演示数据 seed 仅允许在开发/测试环境执行 (需 ALLOW_DEMO_SEED=true)" })
    }
    var reqInfo = e.requestInfo()
    var isSuperAdmin = false
    try { isSuperAdmin = !!(reqInfo && reqInfo.admin && reqInfo.admin.id) } catch (_) { isSuperAdmin = false }
    if (!isSuperAdmin) {
      return e.json(401, { error: "superadmin_required", message: "仅超级管理员可执行演示数据 seed" })
    }
    var reqHeaders = reqInfo.headers || {}
    var confirm = String(reqHeaders["x_seed_confirm"] || reqHeaders["X-Seed-Confirm"] || reqHeaders["x-seed-confirm"] || "")
    if (confirm !== "1") {
      return e.json(400, { error: "seed_confirmation_required", message: "必须携带 X-Seed-Confirm: 1 二次确认头" })
    }
  } catch (err) {
    try { $app.logger().error("admin_seed_guard_error: " + String((err && err.message) || err)) } catch (_) {}
    return e.json(403, { error: "seed_guard_failed", message: "演示 seed 安全校验失败, 已拒绝" })
  }
  try {
    function wipe(collName) {
      var rows = []
      try {
        rows = $app.findRecordsByFilter(collName, "id != ''", "", 1000, 0) || []
      } catch (err) {
        rows = []
      }
      var wi = 0
      for (wi = 0; wi < rows.length; wi++) {
        try { $app.delete(rows[wi]) } catch (delErr) {}
      }
    }

    wipe("appeals")
    wipe("rectify_tasks")
    wipe("inspection_issues")
    wipe("transcripts")
    wipe("employees")
    wipe("stores")
    wipe("regions")

    function make(collName, values) {
      var col = $app.findCollectionByNameOrId(collName)
      var rec = new Record(col)
      var key = ""
      for (key in values) {
        rec.set(key, values[key])
      }
      $app.save(rec)
      return rec
    }

    function isoAgo(minutes) {
      var d = new Date()
      d.setTime(d.getTime() - minutes * 60 * 1000)
      return d.toISOString()
    }

    function isoAhead(days) {
      var d = new Date()
      d.setTime(d.getTime() + days * 24 * 3600 * 1000)
      return d.toISOString()
    }

    // 区域
    var east = make("regions", { name: "华东一区", code: "R-EAST-1" })
    var south = make("regions", { name: "华南一区", code: "R-SOUTH-1" })

    // 门店
    var s1 = make("stores", { name: "解放路旗舰店", region: east.id, address: "杭州市上城区解放路128号" })
    var s2 = make("stores", { name: "万达广场店", region: east.id, address: "杭州市拱墅区万达广场1层" })
    var s3 = make("stores", { name: "东站社区店", region: east.id, address: "杭州市上城区东站社区服务中心旁" })
    var s4 = make("stores", { name: "滨江健康药房", region: south.id, address: "广州市天河区滨江路88号" })

    // 员工
    var p1 = make("employees", { name: "李娜", phone: "138****2211", role: "店长", store: s1.id, status: "在职" })
    var p2 = make("employees", { name: "王强", phone: "139****3322", role: "执业药师", store: s1.id, status: "在职" })
    var p3 = make("employees", { name: "张伟", phone: "137****4433", role: "营业员", store: s2.id, status: "在职" })
    var p4 = make("employees", { name: "刘芳", phone: "136****5544", role: "营业员", store: s2.id, status: "在职" })
    var p5 = make("employees", { name: "陈静", phone: "135****6655", role: "执业药师", store: s3.id, status: "在职" })
    var p6 = make("employees", { name: "赵磊", phone: "158****7766", role: "店长", store: s4.id, status: "在职" })

    // 录音转写
    make("transcripts", { device: "WP-A1023", employee: p1.id, store: s1.id, summary: "顾客咨询感冒药, 推荐联合购买并提醒用法", full_text: "顾客: 最近有点感冒, 有什么药推荐? 李娜: 建议复方感冒药配合维C, 按说明书服用, 多喝水休息。", qc_result: "无问题", occurred_at: isoAgo(30) })
    make("transcripts", { device: "WP-A1023", employee: p2.id, store: s1.id, summary: "处方药销售核验流程完整", full_text: "王强: 请出示一下处方, 我帮您核验。这个药需要按医嘱服用, 不能自行加量。", qc_result: "无问题", occurred_at: isoAgo(55) })
    make("transcripts", { device: "WP-A1087", employee: p3.id, store: s2.id, summary: "向顾客介绍保健品功效, 提及治愈率", full_text: "张伟: 这个保健品吃一个疗程基本就能根治, 我们这边治愈率在九成以上, 很多老顾客都在用。", qc_result: "有问题", occurred_at: isoAgo(40) })
    make("transcripts", { device: "WP-A1087", employee: p4.id, store: s2.id, summary: "销售止咳药未询问基础疾病", full_text: "刘芳: 这个止咳药直接吃就行, 一天三次, 您拿好按说明书吃就行。", qc_result: "有问题", occurred_at: isoAgo(75) })
    make("transcripts", { device: "WP-B2044", employee: p5.id, store: s3.id, summary: "慢病顾客用药指导, 提醒复诊", full_text: "陈静: 降压药要每天固定时间吃, 这个月和您在吃的其他药我核对过了, 没有冲突, 记得下周复诊。", qc_result: "无问题", occurred_at: isoAgo(90) })
    make("transcripts", { device: "WP-A1087", employee: p3.id, store: s2.id, summary: "联合推荐感冒药与退烧药", full_text: "张伟: 感冒药和退烧药一起买, 一起吃好得快, 都不用单独跑了。", qc_result: "有问题", occurred_at: isoAgo(20) })
    make("transcripts", { device: "WP-C3011", employee: p6.id, store: s4.id, summary: "孕哺期顾客用药咨询", full_text: "赵磊: 这个药孕妇也能吃, 没事的, 您放心用就行。", qc_result: "有问题", occurred_at: isoAgo(120) })
    make("transcripts", { device: "WP-A1087", employee: p4.id, store: s2.id, summary: "推荐降压药并说明禁忌", full_text: "刘芳: 这款降压药和您之前用的成分一样, 注意不要和柚子汁同服, 每天固定时间服用。", qc_result: "无问题", occurred_at: isoAgo(140) })

    // 合规问题
    var iss1 = make("inspection_issues", { transcript: "", employee: p3.id, store: s2.id, issue_type: "夸大疗效表达", risk: "高", state: "待整改", quote: "这个保健品吃一个疗程基本就能根治, 我们这边治愈率在九成以上", advice: "立即停用治愈率、根治等绝对化表述, 按合规话术模板介绍保健品仅起辅助作用, 并完成处方药销售合规课程学习。", occurred_at: isoAgo(40) })
    var iss2 = make("inspection_issues", { transcript: "", employee: p3.id, store: s2.id, issue_type: "联合用药风险", risk: "高", state: "申诉中", quote: "感冒药和退烧药一起买, 一起吃好得快", advice: "含对乙酰氨基酚的复方感冒药与退烧药同服会导致成分超量, 推荐前须核对成分表, 建议间隔用药或单选其一。", occurred_at: isoAgo(20) })
    var iss3 = make("inspection_issues", { transcript: "", employee: p4.id, store: s2.id, issue_type: "处方药提醒缺失", risk: "中", state: "待整改", quote: "这个止咳药直接吃就行, 一天三次", advice: "销售处方药前须核验处方并提醒用法用量与禁忌, 补充基础疾病询问环节。", occurred_at: isoAgo(75) })
    var iss4 = make("inspection_issues", { transcript: "", employee: p4.id, store: s2.id, issue_type: "基础疾病询问缺失", risk: "中", state: "待整改", quote: "您拿好, 按说明书吃就行", advice: "销售降压、降糖等慢病用药前, 须询问基础疾病与过敏史并记录。", occurred_at: isoAgo(70) })
    var iss5 = make("inspection_issues", { transcript: "", employee: p1.id, store: s1.id, issue_type: "夸大疗效表达", risk: "中", state: "已完成", quote: "这个药效果特别好, 保证两天见效", advice: "已替换为标准话术, 避免保证类承诺, 复查通过。", occurred_at: isoAgo(200) })
    var iss6 = make("inspection_issues", { transcript: "", employee: p6.id, store: s4.id, issue_type: "特殊人群提醒缺失", risk: "低", state: "申诉中", quote: "这个药孕妇也能吃, 没事的", advice: "孕哺期顾客用药须引导至药师复核流程, 不得口头承诺安全性。", occurred_at: isoAgo(120) })
    var iss7 = make("inspection_issues", { transcript: "", employee: p5.id, store: s3.id, issue_type: "禁忌提醒缺失", risk: "低", state: "已完成", quote: "这个和您在吃的药不冲突", advice: "联合用药建议前须核对在服药品清单, 已完善核对流程。", occurred_at: isoAgo(260) })

    // 整改任务
    make("rectify_tasks", { title: "万达广场店夸大疗效话术整改", owner: p3.id, store: s2.id, source_issue: iss1.id, due_date: isoAhead(3), progress: 40, state: "进行中" })
    make("rectify_tasks", { title: "联合用药成分核对流程上线", owner: p4.id, store: s2.id, source_issue: iss2.id, due_date: isoAhead(5), progress: 0, state: "待整改" })
    make("rectify_tasks", { title: "解放路旗舰店话术合规复查", owner: p1.id, store: s1.id, source_issue: iss5.id, due_date: isoAhead(-1), progress: 100, state: "已完成" })
    make("rectify_tasks", { title: "处方药销售提醒专项培训", owner: p2.id, store: s1.id, source_issue: iss3.id, due_date: isoAhead(-2), progress: 55, state: "逾期" })

    // 申诉
    var ap1 = make("appeals", { issue: iss2.id, reason: "当时已口头提醒顾客两种药需间隔四小时服用, 录音片段未完整收录, 申请复核完整录音。", status: "待复核", reviewer: "", reviewed_at: "" })
    make("appeals", { issue: iss6.id, reason: "顾客自述非孕期, 且当班药师在场确认, 建议调取药师复核记录。", status: "待复核", reviewer: "", reviewed_at: "" })
    make("appeals", { issue: iss3.id, reason: "当日系统处方核验记录正常, 认为提醒已到位。", status: "已驳回", reviewer: "周审核", reviewed_at: isoAgo(300) })
    make("appeals", { issue: iss5.id, reason: "话术已当场更正, 申请认定为低风险。", status: "已通过", reviewer: "周审核", reviewed_at: isoAgo(400) })

    // 把第一条申诉的创建时间回拨 30 小时, 制造「超过 24 小时未复核」提醒
    try {
      $app.db().newQuery("UPDATE appeals SET created = {:c}, updated = {:c} WHERE id = {:id}").bind({ c: isoAgo(30 * 60), id: ap1.id }).execute()
    } catch (updErr) {
      try { $app.logger().error("seed_backdate_failed: " + String((updErr && updErr.message) || updErr)) } catch (logErr2) {}
    }

    return e.json(200, {
      ok: true,
      seeded: {
        regions: 2,
        stores: 4,
        employees: 6,
        transcripts: 8,
        inspection_issues: 7,
        rectify_tasks: 4,
        appeals: 4
      },
      seeded_at: new Date().toISOString()
    })
  } catch (err) {
    var msg = String((err && err.message) || err)
    try { $app.logger().error("admin_seed_failed: " + msg) } catch (logErr) {}
    return e.json(500, {
      error: "admin_seed_failed",
      message: msg,
      fingerprint: msg.slice(0, 80)
    })
  }
})

routerAdd("POST", "/api/admin/sync", function (e) {
  try {
    function countOf(collName) {
      try {
        var rows = $app.findRecordsByFilter(collName, "id != ''", "", 500, 0)
        return rows ? rows.length : 0
      } catch (err) {
        return 0
      }
    }
    return e.json(200, {
      ok: true,
      synced_at: new Date().toISOString(),
      counts: {
        stores: countOf("stores"),
        employees: countOf("employees"),
        transcripts: countOf("transcripts"),
        inspection_issues: countOf("inspection_issues")
      }
    })
  } catch (err) {
    var msg = String((err && err.message) || err)
    try { $app.logger().error("admin_sync_failed: " + msg) } catch (logErr) {}
    return e.json(500, {
      error: "admin_sync_failed",
      message: msg,
      fingerprint: msg.slice(0, 80)
    })
  }
})
