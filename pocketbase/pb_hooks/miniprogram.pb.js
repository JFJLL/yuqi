/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/miniprogram.pb.js — 原生微信小程序核心业务与员工端接口对齐
//
// GET  /api/yuqi/auth/stores               获取可选门店列表
// POST /api/yuqi/auth/profile              完善并关联员工档案
// POST /api/yuqi/auth/profile/rebind       重置身份关联
// GET  /api/yuqi/employee/dashboard        员工/店长聚合工作台
// GET  /api/yuqi/employee/feedbacks        巡检问题列表
// POST /api/yuqi/employee/feedbacks/{id}/learned 标记问题已学习
// GET  /api/yuqi/manager/store/devices     店长门店设备列表
// POST /api/yuqi/employee/device/bind      发起设备绑定
// POST /api/yuqi/employee/device/unbind    解除设备绑定
// GET  /api/yuqi/recommendations           药品推荐列表与检索

routerAdd("GET", "/api/yuqi/auth/stores", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const tenantId = g.serviceTenantId()
    const stores = $app.findRecordsByFilter("stores", "tenant = {:t} && status != 'DISABLED'", "name", 200, 0, { t: tenantId })
    const regions = $app.findRecordsByFilter("regions", "tenant = {:t}", "name", 100, 0, { t: tenantId })
    const regMap = new Map(regions.map((r) => [r.id, r.get("name")]))

    return e.json(200, stores.map((s) => ({
      id: s.id,
      name: s.get("name"),
      code: s.get("code") || s.id,
      regionId: s.get("region"),
      regionName: regMap.get(String(s.get("region") || "")) || "默认区域",
    })))
  } catch (err) {
    return e.json(500, { error: "load_stores_failed", message: String((err && err.message) || err) })
  }
})

routerAdd("POST", "/api/yuqi/auth/profile", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const ctx = g.requireAuth(e)
    const body = e.requestInfo().body || {}
    const name = String(body.name || "").trim()
    const storeId = String(body.storeId || "").trim()
    if (!name || !storeId) throw new BadRequestError("请填写姓名并选择所属门店")

    const store = $app.findRecordById("stores", storeId)
    if (!store) throw new NotFoundError("门店不存在")

    let emp = null
    const mobile = String(ctx.user.get("mobile") || "")
    if (mobile) {
      try { emp = $app.findFirstRecordByFilter("employees", "phone = {:p} && tenant = {:t}", { p: mobile, t: ctx.tenantId }) } catch (_) {}
    }

    const empColl = $app.findCollectionByNameOrId("employees")
    if (!emp) {
      emp = new Record(empColl)
      emp.set("tenant", ctx.tenantId)
      emp.set("phone", mobile)
      emp.set("status", "在职")
    }
    emp.set("name", name)
    emp.set("store", storeId)
    emp.set("role", body.role || "营业员")
    $app.save(emp)

    ctx.user.set("employee", emp.id)
    ctx.user.set("display_name", name)
    ctx.user.set("assigned_store", storeId)
    $app.save(ctx.user)

    let regName = "默认区域"
    try {
      const reg = $app.findRecordById("regions", String(store.get("region") || ""))
      if (reg) regName = reg.get("name")
    } catch (_) {}

    g.writeAudit(e, ctx, "profile_complete", "employees", emp.id, { name, storeId })

    return e.json(200, {
      user: {
        id: emp.id,
        name,
        role: emp.get("role") === "店长" ? "店长" : "营业员",
        mobile,
        storeId,
        storeName: store.get("name"),
        regionName: regName,
        profileCompleted: true,
      },
    })
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "profile_failed", message: String((err && err.message) || err) })
  }
})

routerAdd("POST", "/api/yuqi/auth/profile/rebind", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const ctx = g.requireAuth(e)
    ctx.user.set("employee", "")
    $app.save(ctx.user)
    g.writeAudit(e, ctx, "profile_rebind", "app_users", ctx.user.id, {})
    return e.json(200, { ok: true, message: "已重置关联" })
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "rebind_failed", message: String((err && err.message) || err) })
  }
})

routerAdd("GET", "/api/yuqi/employee/dashboard", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const ctx = g.requireAuth(e)
    const empId = String(ctx.user.get("employee") || "")
    const isMgr = ctx.roleCode === "STORE_MANAGER"
    const storeId = String(ctx.user.get("assigned_store") || "")

    let empRecord = null
    if (empId) {
      try { empRecord = $app.findRecordById("employees", empId) } catch (_) {}
    }
    let storeRecord = null
    if (storeId) {
      try { storeRecord = $app.findRecordById("stores", storeId) } catch (_) {}
    }

    // 巡检问题
    const issuesFilter = isMgr
      ? "store = {:s} && tenant = {:t} && review_status = 'APPROVED' && employee_visibility = 'VISIBLE'"
      : "employee = {:e} && tenant = {:t} && review_status = 'APPROVED' && employee_visibility = 'VISIBLE'"
    const issuesParams = isMgr ? { s: storeId, t: ctx.tenantId } : { e: empId, t: ctx.tenantId }
    const issues = $app.findRecordsByFilter("inspection_issues", issuesFilter, "-occurred_at", 100, 0, issuesParams)

    const pending = issues.filter((i) => i.get("state") === "待整改")
    const highRisk = issues.filter((i) => (i.get("risk") === "高" || i.get("risk") === "HIGH") && i.get("state") !== "已完成")

    // 设备
    let device = null
    try {
      const binding = $app.findFirstRecordByFilter("device_bindings", "employee = {:e} && status = 'ACTIVE'", { e: empId })
      if (binding) {
        const d = $app.findRecordById("devices", String(binding.get("device") || ""))
        if (d) {
          device = {
            code: d.get("device_no"),
            type: d.get("type") || "胸牌",
            status: d.get("status") || "在线",
            battery: Number(d.get("power") || 85),
            lastOnline: d.get("last_online_at") || "刚刚",
            todayRecords: Number(d.get("texts_today") || 0),
          }
        }
      }
    } catch (_) {}

    return e.json(200, {
      user: {
        id: empId,
        name: ctx.user.get("display_name") || "员工",
        role: isMgr ? "店长" : "营业员",
        mobile: ctx.user.get("mobile"),
        storeId,
        storeName: storeRecord ? storeRecord.get("name") : "",
        profileCompleted: Boolean(empId),
      },
      isManager: isMgr,
      device,
      metrics: {
        inspected: issues.length,
        pending: pending.length,
        highRisk: highRisk.length,
      },
      feedbacks: issues.slice(0, 10).map((i) => ({
        id: i.id,
        issueType: i.get("issue_type"),
        risk: i.get("risk"),
        state: i.get("state"),
        quote: i.get("quote"),
        advice: i.get("advice"),
        occurredAt: i.get("occurred_at"),
      })),
    })
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "dashboard_failed", message: String((err && err.message) || err) })
  }
})

routerAdd("GET", "/api/yuqi/employee/feedbacks", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const ctx = g.requireAuth(e)
    const empId = String(ctx.user.get("employee") || "")
    const isMgr = ctx.roleCode === "STORE_MANAGER"
    const storeId = String(ctx.user.get("assigned_store") || "")

    const filter = isMgr
      ? "store = {:s} && tenant = {:t} && review_status = 'APPROVED' && employee_visibility = 'VISIBLE'"
      : "employee = {:e} && tenant = {:t} && review_status = 'APPROVED' && employee_visibility = 'VISIBLE'"
    const params = isMgr ? { s: storeId, t: ctx.tenantId } : { e: empId, t: ctx.tenantId }
    const issues = $app.findRecordsByFilter("inspection_issues", filter, "-occurred_at", 200, 0, params)

    return e.json(200, issues.map((i) => ({
      id: i.id,
      issueType: i.get("issue_type"),
      risk: i.get("risk"),
      state: i.get("state"),
      quote: i.get("quote"),
      advice: i.get("advice"),
      occurredAt: i.get("occurred_at"),
    })))
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "feedbacks_failed", message: String((err && err.message) || err) })
  }
})

routerAdd("POST", "/api/yuqi/employee/feedbacks/{id}/learned", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const ctx = g.requireAuth(e)
    const issueId = e.request.pathValue("id")
    const issue = $app.findRecordById("inspection_issues", issueId)
    if (!issue) throw new NotFoundError("问题不存在")
    g.writeAudit(e, ctx, "issue_learned", "inspection_issues", issue.id, {})
    return e.json(200, { ok: true, message: "已确认学习" })
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "learned_failed", message: String((err && err.message) || err) })
  }
})

routerAdd("GET", "/api/yuqi/recommendations", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const ctx = g.requireAuth(e)
    const query = e.requestInfo().query || {}
    const keyword = String(query.keyword || query.q || "").trim().toLowerCase()

    let recs = $app.findRecordsByFilter("recommendations", "tenant = {:t}", "-created", 100, 0, { t: ctx.tenantId })
    if (keyword) {
      recs = recs.filter((r) => {
        const pName = String(r.get("product_name") || "").toLowerCase()
        const ind = String(r.get("indication") || "").toLowerCase()
        return pName.includes(keyword) || ind.includes(keyword)
      })
    }

    return e.json(200, {
      items: recs.map((r) => {
        let prodList = []
        try {
          const raw = r.get("recommended_drugs")
          prodList = typeof raw === "string" ? JSON.parse(raw || "[]") : (Array.isArray(raw) ? raw : [])
        } catch (_) {}
        return {
          id: r.id,
          productName: r.get("product_name"),
          indication: r.get("indication"),
          recommendedDrugs: prodList,
          riskTips: r.get("risk_tips"),
          source: r.get("source") || "药学知识库",
        }
      }),
    })
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "recommendations_failed", message: String((err && err.message) || err) })
  }
})
