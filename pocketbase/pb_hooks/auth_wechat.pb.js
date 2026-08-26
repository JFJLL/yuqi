/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/auth_wechat.pb.js — 微信小程序手机号登录与账号关联
//
// POST /api/yuqi/auth/wechat/login         {loginCode, phoneCode, testMock, mobile, name, storeId}
// POST /api/yuqi/auth/wechat/bind          {openid, employeeId, mobile}
// POST /api/yuqi/auth/wechat/unbind        {openid, employeeId}
// GET  /api/yuqi/auth/wechat/status        ?openid=...

routerAdd("POST", "/api/yuqi/auth/wechat/login", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const AH = require(`${__hooks}/_lib/auth-helpers.js`)
    const body = e.requestInfo().body || {}
    const loginCode = String(body.loginCode || "").trim()
    const phoneCode = String(body.phoneCode || "").trim()
    const isTestMock = Boolean(body.testMock || loginCode.startsWith("mock-") || phoneCode.startsWith("mock-"))
    const explicitMobile = String(body.mobile || "").trim()

    if (!loginCode && !phoneCode && !explicitMobile) {
      throw new BadRequestError("缺少微信授权参数")
    }

    let openid = ""
    let unionid = ""
    let mobile = explicitMobile
    let appid = ""

    // 1. 微信凭据校验与手机号解析
    if (isTestMock) {
      if (AH.isProduction()) {
        throw new ForbiddenError("生产环境禁止使用 Mock 微信登录")
      }
      // 测试环境 Mock 登录
      if (!mobile) {
        if (/^1\d{10}$/.test(phoneCode)) {
          mobile = phoneCode
        } else if (/1\d{10}/.test(phoneCode)) {
          const m = phoneCode.match(/1\d{10}/)
          mobile = m ? m[0] : "13800000001"
        } else {
          mobile = "13800000001"
        }
      }
      openid = "mock_wx_openid_" + mobile
      unionid = "mock_wx_unionid_" + mobile
      appid = "mock_mini_appid"
    } else {
      // 生产路径：真实向微信服务端换取 openid / 手机号
      appid = String($os.getenv("WECHAT_MINI_APPID") || "")
      const secret = String($os.getenv("WECHAT_MINI_SECRET") || "")
      if (!appid || !secret) {
        return e.json(503, {
          error: "wechat_not_configured",
          message: "微信小程序登录服务未配置，缺少 WECHAT_MINI_APPID / WECHAT_MINI_SECRET",
        })
      }

      if (!loginCode) throw new BadRequestError("缺少 wx.login 授权码")
      if (!phoneCode) throw new BadRequestError("缺少 getPhoneNumber 手机号授权码")

      // 调用微信 jscode2session 接口
      try {
        const sessionRes = $http.send({
          url: "https://api.weixin.qq.com/sns/jscode2session?appid=" + encodeURIComponent(appid) + "&secret=" + encodeURIComponent(secret) + "&js_code=" + encodeURIComponent(loginCode) + "&grant_type=authorization_code",
          method: "GET",
          timeout: 10,
        })
        const sessionJson = sessionRes.json || {}
        if (sessionJson.errcode) {
          throw new BadRequestError("微信身份换取失败: " + (sessionJson.errmsg || sessionJson.errcode))
        }
        openid = String(sessionJson.openid || "")
        unionid = String(sessionJson.unionid || "")
      } catch (err) {
        throw new BadRequestError("微信身份验证失败: " + String((err && err.message) || err))
      }

      // 获取 access_token 并换取手机号
      try {
        const tokenRes = $http.send({
          url: "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=" + encodeURIComponent(appid) + "&secret=" + encodeURIComponent(secret),
          method: "GET",
          timeout: 10,
        })
        const accessToken = tokenRes.json && tokenRes.json.access_token
        if (!accessToken) throw new Error("获取微信接口调用凭据失败")

        const phoneRes = $http.send({
          url: "https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=" + encodeURIComponent(accessToken),
          method: "POST",
          body: JSON.stringify({ code: phoneCode }),
          headers: { "Content-Type": "application/json" },
          timeout: 10,
        })
        const phoneJson = phoneRes.json || {}
        if (phoneJson.errcode || !phoneJson.phone_info) {
          throw new BadRequestError("微信手机号获取失败: " + (phoneJson.errmsg || phoneJson.errcode))
        }
        mobile = String(phoneJson.phone_info.purePhoneNumber || phoneJson.phone_info.phoneNumber || "")
      } catch (err) {
        throw new BadRequestError("微信手机号解密失败: " + String((err && err.message) || err))
      }
    }

    if (!mobile || !/^1\d{10}$/.test(mobile)) {
      throw new BadRequestError("未能获取合法的手机号")
    }

    // 2. 匹配员工档案
    let employee = null
    try {
      employee = $app.findFirstRecordByFilter("employees", "phone = {:p}", { p: mobile })
    } catch (_) {
      employee = null
    }
    const empTenantId = String((employee && employee.get("tenant")) || g.serviceTenantId())

    const secretKey = String($os.getenv("YUQI_UPLOAD_TOKEN_SECRET") || "yuqi_wechat_bind_secret_key_123456")
    const bindTicket = $security.createJWT({
      appid,
      openid,
      unionid,
      mobile,
      tenant: empTenantId || "demo",
      nonce: $security.randomString(16),
      type: "wechat_bind_ticket",
    }, secretKey, 600)

    if (!employee) {
      if (!AH.isProduction() && (body.name || body.storeId)) {
        // 测试环境首次关联：允许根据提交的姓名与门店自动补齐测试档案
        const empColl = $app.findCollectionByNameOrId("employees")
        employee = new Record(empColl)
        employee.set("name", String(body.name || "测试员工"))
        employee.set("phone", mobile)
        employee.set("role", "营业员")
        if (body.storeId) employee.set("store", String(body.storeId))
        employee.set("status", "在职")
        const defaultTenant = $app.findFirstRecordByFilter("tenants", "code = {:c}", { c: "demo" })
        if (defaultTenant) employee.set("tenant", defaultTenant.id)
        $app.save(employee)
      } else {
        // 生产环境安全边界：未匹配到在职员工时，安全失败，返回需要关联
        return e.json(404, {
          error: "employee_not_found",
          message: "未匹配到在职员工档案，请联系管理员开通员工账号",
          requiresProfile: true,
          bindTicket,
          mobile,
          openid,
          appid,
        })
      }
    }

    const empStatus = String(employee.get("status") || "在职")
    if (empStatus !== "在职" && empStatus !== "ACTIVE") {
      throw new ForbiddenError("该员工档案已停用或离职")
    }

    const tenantId = String(employee.get("tenant") || g.serviceTenantId())

    // 3. 查找或创建关联的 app_users 账号
    let user = AH.findUserByMobile(mobile)
    if (!user) {
      const usersColl = $app.findCollectionByNameOrId("app_users")
      user = new Record(usersColl)
      const randomEmail = "emp_" + mobile + "@yuqi.local"
      user.set("email", randomEmail)
      user.set("mobile", mobile)
      user.set("display_name", String(employee.get("name") || mobile))
      user.set("role_code", "EMPLOYEE")
      user.set("status", "ACTIVE")
      user.set("employee", employee.id)
      user.set("tenant", tenantId)
      user.set("assigned_store", String(employee.get("store") || ""))
      const pwd = "Yuqi!" + $security.randomString(12)
      user.set("password", pwd)
      user.set("passwordConfirm", pwd)
      user.set("tokenKey", $security.randomString(30))
      $app.save(user)
    }

    // 4. 维护 wechat_accounts 绑定映射
    let wechatAccount = null
    try {
      wechatAccount = $app.findFirstRecordByFilter("wechat_accounts", "openid = {:o} && appid = {:a}", { o: openid, a: appid })
    } catch (_) {
      wechatAccount = null
    }

    // 如果该 openid 已被其他在职员工占用，且不是当前员工，则安全阻断
    if (wechatAccount && wechatAccount.get("status") === "ACTIVE") {
      const boundEmp = String(wechatAccount.get("employee") || "")
      if (boundEmp && boundEmp !== employee.id) {
        return e.json(409, {
          error: "wechat_already_bound_other",
          message: "该微信身份已绑定其他员工档案，禁止重复绑定",
        })
      }
    }

    const wechatColl = $app.findCollectionByNameOrId("wechat_accounts")
    if (!wechatAccount) {
      wechatAccount = new Record(wechatColl)
      wechatAccount.set("openid", openid)
      wechatAccount.set("bound_at", AH.pbDate())
    }

    wechatAccount.set("appid", appid)
    wechatAccount.set("tenant", tenantId)
    wechatAccount.set("employee", employee.id)
    wechatAccount.set("unionid", unionid)
    wechatAccount.set("mobile", mobile)
    wechatAccount.set("status", "ACTIVE")
    wechatAccount.set("last_login_at", AH.pbDate())
    wechatAccount.set("raw_profile", JSON.stringify({ isTestMock, loginAt: g.nowIso() }))
    $app.save(wechatAccount)

    user.set("last_login_at", AH.pbDate())
    $app.save(user)

    // 5. 写入审计并返回原生认证 Token
    const ctx = { kind: "user", user, tenantId, roleCode: "EMPLOYEE" }
    const maskedMobile = mobile.length >= 11 ? (mobile.slice(0, 3) + "****" + mobile.slice(7)) : "***"
    const maskedOpenid = openid.length > 8 ? (openid.slice(0, 4) + "****" + openid.slice(-4)) : "****"
    g.writeAudit(e, ctx, "wechat_login", "wechat_accounts", wechatAccount.id, {
      mobile: maskedMobile,
      openid: maskedOpenid,
      appid,
      employeeId: employee.id,
      isTestMock,
    })

    $apis.recordAuthResponse(e, user, "wechat")
  } catch (err) {
    const status = Number(err && err.status) || 500
    const message = String((err && err.message) || err || "微信登录失败")
    console.log("WECHAT_LOGIN_ERROR: " + JSON.stringify(message))
    return e.json(status >= 400 && status <= 599 ? status : 500, {
      error: "wechat_login_failed",
      message,
    })
  }
})

// ---- 微信解绑 ----
routerAdd("POST", "/api/yuqi/auth/wechat/unbind", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const AH = require(`${__hooks}/_lib/auth-helpers.js`)
    const ctx = g.requireAuth(e)
    const body = e.requestInfo().body || {}
    const openid = String(body.openid || "").trim()
    const employeeId = String(body.employeeId || "").trim()
    const appid = String(body.appid || (AH.isProduction() ? $os.getenv("WECHAT_MINI_APPID") : "mock_mini_appid")).trim()

    let record = null
    if (openid) {
      record = $app.findFirstRecordByFilter("wechat_accounts", "openid = {:o} && appid = {:a} && status = 'ACTIVE' && tenant = {:t}", { o: openid, a: appid, t: ctx.tenantId })
    } else if (employeeId) {
      record = $app.findFirstRecordByFilter("wechat_accounts", "employee = {:e} && status = 'ACTIVE' && tenant = {:t}", { e: employeeId, t: ctx.tenantId })
    } else if (ctx.kind === "user" && ctx.user.get("employee")) {
      record = $app.findFirstRecordByFilter("wechat_accounts", "employee = {:e} && status = 'ACTIVE' && tenant = {:t}", { e: String(ctx.user.get("employee")), t: ctx.tenantId })
    }

    if (!record) {
      return e.json(200, { ok: true, message: "当前已无活跃绑定" })
    }

    // 权限校验：员工只能解绑自己，管理员受数据范围约束
    const targetEmpId = String(record.get("employee") || "")
    if (ctx.roleCode === "EMPLOYEE") {
      if (String(ctx.user.get("employee") || "") !== targetEmpId) {
        throw new ForbiddenError("无权解绑他人微信账号")
      }
    } else {
      if (targetEmpId) {
        const targetEmp = $app.findRecordById("employees", targetEmpId)
        g.assertEmployeeVisible(e, ctx, targetEmp)
      }
    }

    record.set("status", "UNBOUND")
    $app.save(record)

    const rawOpenid = String(record.get("openid") || "")
    const masked = rawOpenid.length > 8 ? (rawOpenid.slice(0, 4) + "****" + rawOpenid.slice(-4)) : "****"
    g.writeAudit(e, ctx, "wechat_unbind", "wechat_accounts", record.id, { openid: masked })
    return e.json(200, { ok: true, message: "解绑成功" })
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "unbind_failed", message: String((err && err.message) || "解绑失败") })
  }
})

// ---- 微信绑定 ----
routerAdd("POST", "/api/yuqi/auth/wechat/bind", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const AH = require(`${__hooks}/_lib/auth-helpers.js`)
    const ctx = g.requireAuth(e)
    const body = e.requestInfo().body || {}
    let openid = String(body.openid || "").trim()
    let appid = String(body.appid || (AH.isProduction() ? $os.getenv("WECHAT_MINI_APPID") : "mock_mini_appid")).trim()
    const bindTicket = String(body.bindTicket || body.ticket || "").trim()
    const employeeId = String(body.employeeId || ctx.user.get("employee") || "").trim()
    const mobile = String(body.mobile || "").trim()

    // 1. 凭证校验：普通员工绑定必须持有服务端签发的有效 bindTicket 或已认证会话
    if (ctx.roleCode === "EMPLOYEE") {
      if (bindTicket) {
        const secretKey = String($os.getenv("YUQI_UPLOAD_TOKEN_SECRET") || "yuqi_wechat_bind_secret_key_123456")
        let claims = null
        try {
          claims = $security.parseJWT(bindTicket, secretKey)
        } catch (_) {
          throw new ForbiddenError("微信绑定凭证无效或已过期")
        }
        if (!claims || claims["type"] !== "wechat_bind_ticket") {
          throw new ForbiddenError("绑定凭证类型无效")
        }
        if (claims["openid"]) openid = String(claims["openid"])
        if (claims["appid"]) appid = String(claims["appid"])
      } else {
        // 未提供 bindTicket 时，必须已通过微信登录认证并匹配其会话关联的 openid
        let currentWx = null
        try {
          currentWx = $app.findFirstRecordByFilter("wechat_accounts", "employee = {:e} && openid = {:o}", { e: employeeId, o: openid })
        } catch (_) {}
        if (!currentWx) {
          throw new ForbiddenError("禁止提交未经验证的客户端 openid，必须通过微信授权流程绑定")
        }
      }
    }

    if (!openid || !employeeId) throw new BadRequestError("缺少 openid 或 employeeId")

    const employee = $app.findRecordById("employees", employeeId)
    if (!employee) throw new NotFoundError("员工不存在")
    if (String(employee.get("tenant") || "") !== ctx.tenantId) throw new NotFoundError("员工不存在")

    // 权限校验与 openid 防抢绑机制
    if (ctx.roleCode === "EMPLOYEE") {
      if (String(ctx.user.get("employee") || "") !== employeeId) {
        throw new ForbiddenError("无权为他人绑定微信账号")
      }
    } else {
      g.assertEmployeeVisible(e, ctx, employee)
    }

    // 核心安全校验：检查该 openid 是否已被其他员工活跃绑定
    let existingOpenidBinding = null
    try {
      existingOpenidBinding = $app.findFirstRecordByFilter("wechat_accounts", "openid = {:o} && appid = {:a} && status = 'ACTIVE'", { o: openid, a: appid })
    } catch (_) {}
    if (existingOpenidBinding && String(existingOpenidBinding.get("employee") || "") !== employeeId) {
      return e.json(409, {
        error: "already_bound",
        message: "该微信账号已被其他员工绑定，禁止重复绑定",
      })
    }

    // 检查当前员工是否已有其他 openid 绑定
    let existingEmpBinding = null
    try {
      existingEmpBinding = $app.findFirstRecordByFilter("wechat_accounts", "employee = {:e} && appid = {:a} && status = 'ACTIVE' && tenant = {:t}", { e: employeeId, a: appid, t: ctx.tenantId })
    } catch (_) {}
    if (existingEmpBinding && existingEmpBinding.get("openid") !== openid) {
      return e.json(409, {
        error: "employee_already_bound",
        message: "该员工档案已绑定其他微信账号，请先解绑原账号",
      })
    }

    let wechatAccount = null
    try {
      wechatAccount = $app.findFirstRecordByFilter("wechat_accounts", "openid = {:o} && appid = {:a} && tenant = {:t}", { o: openid, a: appid, t: ctx.tenantId })
    } catch (_) {}

    const wechatColl = $app.findCollectionByNameOrId("wechat_accounts")
    if (!wechatAccount) {
      wechatAccount = new Record(wechatColl)
      wechatAccount.set("openid", openid)
      wechatAccount.set("appid", appid)
      wechatAccount.set("bound_at", AH.pbDate())
    }

    wechatAccount.set("tenant", ctx.tenantId)
    wechatAccount.set("employee", employee.id)
    if (mobile) wechatAccount.set("mobile", mobile)
    wechatAccount.set("status", "ACTIVE")
    wechatAccount.set("last_login_at", AH.pbDate())
    $app.save(wechatAccount)

    const masked = mobile ? (mobile.slice(0, 3) + "****" + mobile.slice(7)) : "***"
    const maskedOpenid = openid.length > 8 ? (openid.slice(0, 4) + "****" + openid.slice(-4)) : "****"
    g.writeAudit(e, ctx, "wechat_bind", "wechat_accounts", wechatAccount.id, { openid: maskedOpenid, appid, employeeId, mobile: masked })
    return e.json(200, { ok: true, message: "绑定成功" })
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "bind_failed", message: String((err && err.message) || "绑定失败") })
  }
})

// ---- 微信绑定状态查询 ----
routerAdd("GET", "/api/yuqi/auth/wechat/status", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const AH = require(`${__hooks}/_lib/auth-helpers.js`)
    const ctx = g.requireAuth(e)
    const query = e.requestInfo().query || {}
    const openid = String(query.openid || "").trim()
    const employeeId = String(query.employeeId || (ctx.roleCode === "EMPLOYEE" ? ctx.user.get("employee") : "") || "").trim()
    const appid = String(query.appid || (AH.isProduction() ? $os.getenv("WECHAT_MINI_APPID") : "mock_mini_appid")).trim()

    if (ctx.roleCode === "EMPLOYEE") {
      const myEmp = String(ctx.user.get("employee") || "")
      if (employeeId && employeeId !== myEmp) {
        throw new ForbiddenError("无权查询其他员工绑定状态")
      }
    }

    let record = null
    if (openid) {
      if (ctx.roleCode === "EMPLOYEE") {
        throw new ForbiddenError("员工端禁止按 openid 反查员工绑定状态")
      }
      try {
        record = $app.findFirstRecordByFilter("wechat_accounts", "openid = {:o} && appid = {:a} && status = 'ACTIVE' && tenant = {:t}", { o: openid, a: appid, t: ctx.tenantId })
      } catch (_) {}
    } else if (employeeId) {
      if (ctx.roleCode !== "EMPLOYEE") {
        const emp = $app.findRecordById("employees", employeeId)
        g.assertEmployeeVisible(e, ctx, emp)
      }
      try {
        record = $app.findFirstRecordByFilter("wechat_accounts", "employee = {:e} && appid = {:a} && status = 'ACTIVE' && tenant = {:t}", { e: employeeId, a: appid, t: ctx.tenantId })
      } catch (_) {}
    }

    if (!record) {
      return e.json(200, { bound: false, status: "UNBOUND" })
    }

    return e.json(200, {
      bound: true,
      status: "ACTIVE",
      openid: (ctx.roleCode === "EMPLOYEE" ? record.get("openid") : (String(record.get("openid")).slice(0, 4) + "****" + String(record.get("openid")).slice(-4))),
      employeeId: record.get("employee"),
      boundAt: record.get("bound_at"),
    })
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "status_failed", message: String((err && err.message) || "查询状态失败") })
  }
})
