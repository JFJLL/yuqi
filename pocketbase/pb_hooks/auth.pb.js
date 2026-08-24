/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/auth.pb.js — 认证路由 (PocketBase 原生 Auth Collection + 原生 Token)
//
// POST /api/yuqi/auth/login                 {username, password}      管理端登录
// POST /api/yuqi/auth/logout                登出 (token_version 失效)
// POST /api/yuqi/auth/change-password       修改密码
// GET  /api/yuqi/auth/me                    当前用户信息 + 范围 + 未读通知数
// POST /api/yuqi/auth/employee/send-code    {mobile}                   员工验证码
// POST /api/yuqi/auth/employee/login        {mobile, code}             员工验证码登录
// POST /api/yuqi/upload-token               短期上传令牌 (管理员)
//
// JSVM 注意: routerAdd 的 handler 无法访问文件级词法闭包,
// 所有辅助函数/守卫必须在 handler 函数体内 require() 后使用。

// ---- 管理端登录 ----
routerAdd("POST", "/api/yuqi/auth/login", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const AH = require(`${__hooks}/_lib/auth-helpers.js`)
    const body = e.requestInfo().body || {}
    const username = String(body.username || "").trim()
    const password = String(body.password || "")
    if (!username || !password) throw new BadRequestError("请输入用户名和密码")

    const user = AH.findUserByEmail(username) || AH.findUserByMobile(username)
    if (!user) throw new BadRequestError("用户名或密码错误")
    if (!user.validatePassword(password)) throw new BadRequestError("用户名或密码错误")
    const status = String(user.get("status") || "ACTIVE")
    if (status !== "ACTIVE") throw new ForbiddenError("账号已停用")

    user.set("last_login_at", AH.pbDate())
    $app.save(user)

    const ctx = { kind: "user", user, tenantId: String(user.get("tenant") || ""), roleCode: String(user.get("role_code") || "") }
    g.writeAudit(e, ctx, "user_login", "app_users", user.id, { username })
    $apis.recordAuthResponse(e, user, "password")
  } catch (err) {
    try {
      const g = require(`${__hooks}/_lib/guards.js`)
      if (err && err.status && err.status >= 400 && err.status < 600) {
        const msg = String(err.message || "登录失败")
        g.writeAudit(e, { kind: "guest", tenantId: "", roleCode: "" }, "user_login_failed", "app_users", "", { message: msg.slice(0, 100) })
        return e.json(err.status, { error: "login_failed", message: msg })
      }
    } catch (_) {}
    return e.json(500, { error: "login_failed", message: "登录失败" })
  }
})

// ---- 登出 (会话失效) ----
routerAdd("POST", "/api/yuqi/auth/logout", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const AH = require(`${__hooks}/_lib/auth-helpers.js`)
    const ctx = g.requireAuth(e)
    if (ctx.kind === "user") {
      const user = ctx.user
      const version = Number(user.get("token_version") || 0) + 1
      user.set("token_version", version)
      user.set("token_valid_from", AH.pbDate())
      $app.save(user)
      g.writeAudit(e, ctx, "user_logout", "app_users", user.id, {})
    }
    return e.json(200, { ok: true })
  } catch (err) {
    // 未登录登出也返回成功
    return e.json(200, { ok: true })
  }
})

// ---- 修改密码 ----
routerAdd("POST", "/api/yuqi/auth/change-password", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const AH = require(`${__hooks}/_lib/auth-helpers.js`)
    const ctx = g.requireAuth(e)
    if (ctx.kind !== "user") throw new ForbiddenError("仅登录用户可修改密码")
    const body = e.requestInfo().body || {}
    const oldPassword = String(body.old_password || "")
    const newPassword = String(body.new_password || "")
    if (newPassword.length < 8) throw new BadRequestError("新密码至少 8 位")
    const user = ctx.user
    if (!user.validatePassword(oldPassword)) throw new BadRequestError("原密码错误")
    user.set("password", newPassword)
    const version = Number(user.get("token_version") || 0) + 1
    user.set("token_version", version)
    user.set("token_valid_from", AH.pbDate())
    $app.save(user)
    g.writeAudit(e, ctx, "user_change_password", "app_users", user.id, {})
    return e.json(200, { ok: true })
  } catch (err) {
    return e.json(Number(err && err.status) || 500, { error: "change_password_failed", message: String((err && err.message) || "修改密码失败") })
  }
})

// ---- 当前用户 ----
routerAdd("GET", "/api/yuqi/auth/me", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const ctx = g.requireAuth(e)
    if (ctx.kind !== "user") throw new ForbiddenError("仅登录用户")
    const user = ctx.user
    const scope = g.userScope(user)
    let unread = 0
    try {
      const rows = $app.findRecordsByFilter("notifications", "user = {:uid} && is_read = false", "", 200, 0, { uid: user.id })
      unread = rows.length
    } catch (_) {
      unread = 0
    }
    return e.json(200, {
      id: user.id,
      display_name: user.get("display_name"),
      email: user.get("email"),
      mobile: user.get("mobile"),
      role_code: user.get("role_code"),
      status: user.get("status"),
      tenant: user.get("tenant"),
      employee: user.get("employee"),
      assigned_org: user.get("assigned_org"),
      assigned_store: user.get("assigned_store"),
      last_login_at: user.get("last_login_at"),
      scope,
      unread_notifications: unread,
      server_time: g.nowIso(),
    })
  } catch (err) {
    return e.json(Number(err && err.status) || 500, { error: "me_failed", message: String((err && err.message) || "获取用户信息失败") })
  }
})

// ---- 员工验证码发送 ----
routerAdd("POST", "/api/yuqi/auth/employee/send-code", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const AH = require(`${__hooks}/_lib/auth-helpers.js`)
    const body = e.requestInfo().body || {}
    const mobile = String(body.mobile || "").trim()
    if (!/^1\d{10}$/.test(mobile)) throw new BadRequestError("手机号格式不正确")

    // 员工必须存在且在职
    let employee = null
    try {
      employee = $app.findFirstRecordByFilter("employees", "phone = {:p}", { p: mobile })
    } catch (_) {
      employee = null
    }
    if (!employee) throw new NotFoundError("该手机号未关联员工")
    const empStatus = String(employee.get("status") || "")
    if (empStatus && empStatus !== "在职" && empStatus !== "ACTIVE") throw new ForbiddenError("员工已停职或离职")
    const tenantId = String(employee.get("tenant") || g.serviceTenantId())

    // 60s 内禁止重复发送
    const recent = $app.findRecordsByFilter("sms_codes", "mobile = {:m} && status = 'ACTIVE'", "-created", 1, 0, { m: mobile })
    if (recent.length > 0) {
      const sentAt = String(recent[0].get("sent_at") || "")
      if (sentAt) {
        const ms = new Date(String(sentAt).replace(" ", "T")).getTime()
        if (Date.now() - ms < 60 * 1000) {
          throw new TooManyrequestsError("发送过于频繁，请 60 秒后再试")
        }
      }
    }
    // 每小时限次
    const hourAgo = AH.pbDate(new Date(Date.now() - 3600 * 1000))
    const hourly = $app.findRecordsByFilter("sms_codes", "mobile = {:m} && sent_at >= {:t}", "", 200, 0, { m: mobile, t: hourAgo })
    if (hourly.length >= 5) throw new TooManyrequestsError("发送次数已达上限，请 1 小时后再试")

    // 生产未配置真实短信服务时不发送固定码
    if (AH.isProduction()) {
      const provider = String($os.getenv("YUQI_SMS_PROVIDER") || "")
      if (!provider) {
        throw new Error("短信服务未配置")
      }
    }

    const devCode = AH.fixedDevCode()
    const code = devCode || (() => {
      let c = ""
      for (let i = 0; i < 6; i++) c += String(Math.floor(Math.random() * 10))
      return c
    })()

    const coll = $app.findCollectionByNameOrId("sms_codes")
    const rec = new Record(coll)
    rec.set("tenant", tenantId)
    rec.set("mobile", mobile)
    rec.set("code_hash", g.hashCode(tenantId + ":" + mobile + ":" + code))
    rec.set("expires_at", AH.pbDate(new Date(Date.now() + 5 * 60 * 1000)))
    rec.set("failed_attempts", 0)
    rec.set("sent_at", AH.pbDate())
    rec.set("request_ip", g.clientIp(e))
    rec.set("status", "ACTIVE")
    $app.save(rec)

    // 旧验证码作废
    try {
      $app.db().newQuery("UPDATE `sms_codes` SET `status` = 'EXPIRED' WHERE `mobile` = {:m} AND `id` <> {:id} AND `status` = 'ACTIVE'").bind({ m: mobile, id: rec.id }).execute()
    } catch (_) {}

    g.writeAudit(e, { kind: "service", tenantId }, "employee_sms_send", "sms_codes", rec.id, { mobile })
    return e.json(200, {
      sent: true,
      expires_in: 300,
      dev_code: devCode ? devCode : undefined,
      sms_configured: AH.isProduction() ? Boolean($os.getenv("YUQI_SMS_PROVIDER")) : true,
    })
  } catch (err) {
    const status = Number(err && err.status) || 500
    const message = String((err && err.message) || "验证码发送失败")
    if (status === 500 && /短信服务未配置/.test(message)) {
      return e.json(503, { error: "sms_not_configured", message: "短信服务未配置" })
    }
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "sms_send_failed", message })
  }
})

// ---- 员工验证码登录 ----
routerAdd("POST", "/api/yuqi/auth/employee/login", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const AH = require(`${__hooks}/_lib/auth-helpers.js`)
    const body = e.requestInfo().body || {}
    const mobile = String(body.mobile || "").trim()
    const code = String(body.code || "").trim()
    if (!/^1\d{10}$/.test(mobile) || !code) throw new BadRequestError("手机号或验证码不正确")

    const user = AH.findUserByMobile(mobile)
    if (!user) throw new BadRequestError("该手机号未开通员工账号")
    const status = String(user.get("status") || "ACTIVE")
    if (status !== "ACTIVE") throw new ForbiddenError("账号已停用")
    const employee = g.requireEmployeeActive(user)
    if (String(employee.get("phone") || "") !== mobile) throw new ForbiddenError("账号与手机号不匹配")
    const tenantId = String(user.get("tenant") || employee.get("tenant") || "")

    // 校验验证码
    let codeRec = null
    try {
      const rows = $app.findRecordsByFilter("sms_codes", "mobile = {:m} && status = 'ACTIVE'", "-created", 1, 0, { m: mobile })
      codeRec = rows.length > 0 ? rows[0] : null
    } catch (_) {
      codeRec = null
    }
    if (!codeRec) throw new BadRequestError("请先获取验证码")

    const expiresAt = String(codeRec.get("expires_at") || "")
    if (expiresAt && new Date(String(expiresAt).replace(" ", "T")).getTime() < Date.now()) {
      codeRec.set("status", "EXPIRED")
      $app.save(codeRec)
      throw new BadRequestError("验证码已过期")
    }

    const failed = Number(codeRec.get("failed_attempts") || 0)
    if (failed >= 5) throw new TooManyrequestsError("验证码错误次数过多，请重新获取")

    const tenantForHash = String(codeRec.get("tenant") || "")
    const expectedHash = String(codeRec.get("code_hash") || "")
    const ok = expectedHash && $security.equal(expectedHash, g.hashCode(tenantForHash + ":" + mobile + ":" + code))
    if (!ok) {
      const nextFailed = failed + 1
      codeRec.set("failed_attempts", nextFailed)
      if (nextFailed >= 5) codeRec.set("status", "FAILED")
      $app.save(codeRec)
      throw new BadRequestError("验证码错误")
    }

    codeRec.set("status", "USED")
    codeRec.set("consumed_at", AH.pbDate())
    $app.save(codeRec)

    user.set("last_login_at", AH.pbDate())
    $app.save(user)

    const ctx = { kind: "user", user, tenantId, roleCode: String(user.get("role_code") || "") }
    g.writeAudit(e, ctx, "employee_login", "app_users", user.id, { mobile })
    $apis.recordAuthResponse(e, user, "otp")
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "employee_login_failed", message: String((err && err.message) || "登录失败") })
  }
})

// ---- 短期上传令牌 (管理员) ----
routerAdd("POST", "/api/yuqi/upload-token", (e) => {
  try {
    const g = require(`${__hooks}/_lib/guards.js`)
    const AH = require(`${__hooks}/_lib/auth-helpers.js`)
    const ctx = g.requireAuth(e)
    g.requireRole(e, ctx, ["SUPER_ADMIN", "ADMIN", "COMPLIANCE"])
    const secret = String($os.getenv("YUQI_UPLOAD_TOKEN_SECRET") || "")
    if (!secret) throw new InternalServerError("上传令牌密钥未配置")
    const nonce = $security.randomString(24)
    const now = new Date()
    const payload = {
      user: ctx.user.id,
      tenant: ctx.tenantId,
      nonce,
      action: "asr_upload",
    }
    const token = $security.newJWT(payload, secret, 600 * 1e9) // 10 分钟
    const coll = $app.findCollectionByNameOrId("upload_tokens")
    const rec = new Record(coll)
    rec.set("tenant", ctx.tenantId)
    rec.set("user", ctx.user.id)
    rec.set("nonce", nonce)
    rec.set("action", "asr_upload")
    rec.set("expires_at", AH.pbDate(new Date(now.getTime() + 600 * 1000)))
    $app.save(rec)
    g.writeAudit(e, ctx, "upload_token_issue", "upload_tokens", rec.id, {})
    return e.json(200, { token, expires_in: 600, nonce })
  } catch (err) {
    const status = Number(err && err.status) || 500
    return e.json(status >= 400 && status <= 599 ? status : 500, { error: "upload_token_failed", message: String((err && err.message) || "令牌签发失败") })
  }
})
