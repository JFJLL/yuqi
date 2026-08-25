// pb_hooks/_lib/guards.js — 统一认证/授权/数据范围/审计守卫
//
// 使用方式 (在 handler 内):
//   const g = require(`${__hooks}/_lib/guards.js`)
//   const ctx = g.requireAuth(e)          // 未登录抛 401
//   g.requireRole(e, ctx, ["ADMIN","COMPLIANCE"])
//   const { filter, params } = g.buildScopeFilter(e, ctx, { storeField: "store" })
//
// 注意: JSVM handler 隔离执行, 模块通过 require 在每个 handler 内加载。

module.exports = {
  // ---- 常量 ----
  ROLES: {
    SUPER_ADMIN: "SUPER_ADMIN",
    ADMIN: "ADMIN",
    COMPLIANCE: "COMPLIANCE",
    REGION_MANAGER: "REGION_MANAGER",
    STORE_MANAGER: "STORE_MANAGER",
    EMPLOYEE: "EMPLOYEE",
    AUDITOR: "AUDITOR",
  },

  nowIso(now) {
    const d = now || new Date()
    return d.toISOString()
  },

  safeMessage(error, fallback) {
    const text = String((error && error.message) || error || fallback || "请求失败")
    return text.replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]").slice(0, 500)
  },

  hashCode(code) {
    try {
      return $security.sha256(String(code || ""))
    } catch (_) {
      return String(code || "")
    }
  },

  // ---- 内部服务身份 ----
  isServiceRequest(e) {
    const expected = String($os.getenv("YUQI_SERVICE_TOKEN") || "")
    if (!expected) return false
    const token = String(e.request.header.get("X-Yuqi-Service-Token") || "")
    return token === expected
  },

  serviceTenantId() {
    const code = String($os.getenv("YUQI_SERVICE_TENANT_CODE") || "demo")
    let tenant = null
    try {
      tenant = $app.findFirstRecordByFilter("tenants", "code = {:code}", { code })
    } catch (_) {
      tenant = null
    }
    if (!tenant) throw new InternalServerError("内部服务租户未配置")
    return tenant.id
  },

  clientIp(e) {
    try {
      return String(e.realIP() || e.remoteIP() || "")
    } catch (_) {
      try {
        return String(e.remoteIP() || "")
      } catch (_) {
        return ""
      }
    }
  },

  requestId(e) {
    const rid = String(e.request.header.get("X-Yuqi-Request-Id") || "")
    if (rid && rid.length <= 80) return rid
    try {
      return $security.randomString(16)
    } catch (_) {
      return ""
    }
  },

  // ---- 认证上下文 ----
  // 返回 { kind: "user", user, tenantId, roleCode, scope } 或抛错
  requireAuth(e) {
    const svc = this.isServiceRequest(e)
    if (svc) {
      return {
        kind: "service",
        tenantId: this.serviceTenantId(),
        roleCode: "SERVICE",
      }
    }
    const auth = e.auth
    if (!auth) throw new UnauthorizedError("未登录")
    if (e.hasSuperuserAuth && e.hasSuperuserAuth()) {
      // 浏览器/业务 API 禁止超级管理员身份; 超级管理员仅通过 Dashboard/CLI 使用
      throw new ForbiddenError("business_api_forbidden_superuser")
    }
    const usersCollectionId = (() => {
      try {
        return $app.findCollectionByNameOrId("app_users").id
      } catch (_) {
        return ""
      }
    })()
    // v0.40 JSVM: Record 不暴露 collectionId 属性, 需通过 collection() 获取
    const authCollectionId = (() => {
      try {
        return String(auth.collection().id || "")
      } catch (_) {
        return String(auth.collectionId || "")
      }
    })()
    if (!usersCollectionId || authCollectionId !== String(usersCollectionId)) {
      throw new ForbiddenError("invalid_auth_collection")
    }
    const status = String(auth.get("status") || "")
    if (status && status !== "ACTIVE") throw new ForbiddenError("账号已停用")

    // token_version 会话失效检查 (通过 token iat 与 token_valid_from 比较)
    try {
      const raw = String(e.request.header.get("Authorization") || "").replace(/^Bearer\s+/i, "")
      if (raw) {
        const claims = $security.parseUnverifiedJWT(raw)
        const iatMs = Number(claims && claims["iat"]) * 1000
        const validFrom = String(auth.get("token_valid_from") || "")
        if (validFrom && Number.isFinite(iatMs)) {
          const fromMs = new Date(String(validFrom).replace(" ", "T")).getTime()
          if (Number.isFinite(fromMs) && iatMs < fromMs) {
            throw new UnauthorizedError("登录已失效，请重新登录")
          }
        }
      }
    } catch (err) {
      if (err && Number(err.status) === 401) throw err
      // 解析失败不阻断 (可能是非 JWT 或 SDK 场景), 由 PB 原生校验兜底
    }

    const tenantId = String(auth.get("tenant") || "")
    if (!tenantId) throw new ForbiddenError("账号缺少租户")
    const roleCode = String(auth.get("role_code") || "")
    return {
      kind: "user",
      user: auth,
      tenantId,
      roleCode,
      scope: this.userScope(auth),
    }
  },

  // 用户数据范围 (user_data_scopes, 无记录时按角色回退)
  userScope(user) {
    let scope = null
    try {
      scope = $app.findFirstRecordByFilter("user_data_scopes", "user = {:uid}", { uid: user.id })
    } catch (_) {
      scope = null
    }
    const role = String(user.get("role_code") || "")
    if (scope && String(scope.get("status") || "ACTIVE") === "ACTIVE") {
      return {
        type: String(scope.get("scope_type") || "SELF"),
        orgNode: String(scope.get("org_node") || ""),
        store: String(scope.get("store") || ""),
        employee: String(user.get("employee") || ""),
      }
    }
    // 按角色回退
    if (role === "SUPER_ADMIN" || role === "ADMIN" || role === "COMPLIANCE") {
      return { type: "ALL", orgNode: "", store: "", employee: String(user.get("employee") || "") }
    }
    if (role === "REGION_MANAGER") {
      return { type: "ORG_TREE", orgNode: String(user.get("assigned_org") || ""), store: "", employee: String(user.get("employee") || "") }
    }
    if (role === "STORE_MANAGER") {
      return { type: "STORE", orgNode: "", store: String(user.get("assigned_store") || ""), employee: String(user.get("employee") || "") }
    }
    if (role === "AUDITOR") {
      return { type: "ALL", orgNode: "", store: "", employee: String(user.get("employee") || "") }
    }
    return { type: "SELF", orgNode: "", store: "", employee: String(user.get("employee") || "") }
  },

  requireRole(e, ctx, roles) {
    if (ctx.kind === "service") return
    if (roles.indexOf(ctx.roleCode) >= 0) return
    throw new ForbiddenError("无权执行该操作")
  },

  requireEmployeeActive(user) {
    const employeeId = String(user.get("employee") || "")
    if (!employeeId) throw new ForbiddenError("账号未关联员工")
    let employee = null
    try {
      employee = $app.findRecordById("employees", employeeId)
    } catch (_) {
      employee = null
    }
    if (!employee) throw new ForbiddenError("员工档案不存在")
    const status = String(employee.get("status") || "")
    if (status && status !== "在职" && status !== "ACTIVE") {
      throw new ForbiddenError("员工已停职或离职")
    }
    return employee
  },

  // ---- 区域子树 ----
  regionSubtreeIds(regionId) {
    const ids = [String(regionId || "")]
    const frontier = [String(regionId || "")]
    for (let depth = 0; depth < 8 && frontier.length > 0; depth++) {
      const next = []
      for (let i = 0; i < frontier.length; i++) {
        let children = []
        try {
          children = $app.findRecordsByFilter("regions", "parent = {:p}", "", 500, 0, { p: frontier[i] })
        } catch (_) {
          children = []
        }
        for (let j = 0; j < children.length; j++) {
          const id = String(children[j].id)
          if (ids.indexOf(id) < 0) {
            ids.push(id)
            next.push(id)
          }
        }
      }
      frontier.length = 0
      for (let k = 0; k < next.length; k++) frontier.push(next[k])
    }
    return ids
  },

  // ---- 数据范围过滤 ----
  // config: { storeField, employeeField, orgField, storeFieldType: "relation"|"text", employeeFieldType }
  buildScopeFilter(e, ctx, config) {
    const cfg = config || {}
    const storeField = cfg.storeField || "store"
    const employeeField = cfg.employeeField || "employee"
    const tenantField = cfg.tenantField || "tenant"
    const storeType = cfg.storeFieldType || "relation"
    const empType = cfg.employeeFieldType || "relation"

    const parts = []
    const params = {}
    parts.push(tenantField + " = {:tenant}")
    params.tenant = ctx.tenantId

    if (ctx.kind === "service") {
      return { filter: parts.join(" && "), params }
    }

    const scope = ctx.scope || { type: "SELF" }
    const overrides = cfg.scopeFilterOverrides || {}
    if (overrides[scope.type]) {
      const built = overrides[scope.type](ctx, e)
      if (built && built.filter) {
        parts.push(built.filter)
        for (const pk of Object.keys(built.params || {})) params[pk] = built.params[pk]
      }
      return { filter: parts.join(" && "), params }
    }
    if (scope.type === "ALL") {
      // 仅租户
    } else if (scope.type === "ORG_TREE") {
      const ids = this.regionSubtreeIds(scope.orgNode)
      if (ids.length === 0 || (ids.length === 1 && !ids[0])) {
        parts.push("id = {:noData}")
        params.noData = "-"
      } else {
        const storeClauses = []
        for (let i = 0; i < ids.length; i++) {
          const key = "region" + i
          storeClauses.push(storeField + (storeType === "text" ? "" : ".region") + " = {:" + key + "}")
          params[key] = ids[i]
        }
        parts.push("(" + storeClauses.join(" || ") + ")")
      }
    } else if (scope.type === "STORE") {
      parts.push(storeField + " = {:scopeStore}")
      params.scopeStore = scope.store
    } else if (scope.type === "SELF") {
      parts.push(employeeField + " = {:scopeEmployee}")
      params.scopeEmployee = scope.employee
    }
    return { filter: parts.join(" && "), params }
  },

  // 断言单条记录可见
  assertVisible(e, ctx, record, config) {
    if (ctx.kind === "service") return
    const cfg = config || {}
    if (cfg.assertVisibleOverride) {
      cfg.assertVisibleOverride(e, ctx, record)
      return
    }
    const tenant = String(record.get(cfg.tenantField || "tenant") || "")
    if (tenant && tenant !== ctx.tenantId) throw new NotFoundError("记录不存在")
    const scope = ctx.scope || { type: "SELF" }
    if (scope.type === "ALL") return
    let collectionName = ""
    try {
      collectionName = String(record.collection().name || "")
    } catch (_) {}
    if (scope.type === "STORE") {
      if (collectionName === "stores") {
        if (record.id !== scope.store) throw new NotFoundError("记录不存在")
        return
      }
      const storeField = cfg.storeField || "store"
      const storeId = String(record.get(storeField) || "")
      if (storeId !== scope.store) throw new NotFoundError("记录不存在")
      return
    }
    if (scope.type === "ORG_TREE") {
      if (collectionName === "stores") {
        const regionId = String(record.get("region") || "")
        const ids = this.regionSubtreeIds(scope.orgNode)
        if (!regionId || ids.indexOf(regionId) < 0) throw new NotFoundError("记录不存在")
        return
      }
      if (collectionName === "regions") {
        const ids = this.regionSubtreeIds(scope.orgNode)
        if (ids.indexOf(record.id) < 0) throw new NotFoundError("记录不存在")
        return
      }
      const storeField = cfg.storeField || "store"
      let storeId = String(record.get(storeField) || "")
      if (storeId) {
        try {
          const store = $app.findRecordById("stores", storeId)
          const regionId = String(store.get("region") || "")
          const ids = this.regionSubtreeIds(scope.orgNode)
          if (ids.indexOf(regionId) < 0) throw new NotFoundError("记录不存在")
        } catch (err) {
          if (err && Number(err.status) === 404) throw err
          throw new NotFoundError("记录不存在")
        }
      }
      return
    }
    if (scope.type === "SELF") {
      const employeeField = cfg.employeeField || "employee"
      const empId = String(record.get(employeeField) || "")
      if (empId && empId !== scope.employee) throw new NotFoundError("记录不存在")
    }
  },

  // ---- 审计 ----
  writeAudit(e, ctx, action, targetType, targetId, detail) {
    try {
      const collection = $app.findCollectionByNameOrId("audit_logs")
      const rec = new Record(collection)
      rec.set("tenant", ctx.tenantId || "")
      if (ctx.kind === "user" && ctx.user) {
        rec.set("actor", ctx.user.id)
        rec.set("actor_name", String(ctx.user.get("display_name") || ctx.user.get("email") || ctx.user.id))
        rec.set("actor_type", "user")
      } else {
        rec.set("actor_name", "service")
        rec.set("actor_type", "service")
      }
      rec.set("action", String(action || "").slice(0, 80))
      rec.set("target_type", String(targetType || "").slice(0, 60))
      rec.set("target_id", String(targetId || "").slice(0, 60))
      if (detail) {
        try {
          rec.set("detail_json", detail)
        } catch (_) {
          rec.set("detail_json", { note: "audit detail omitted" })
        }
      }
      rec.set("ip", this.clientIp(e))
      rec.set("request_id", this.requestId(e))
      $app.save(rec)
    } catch (err) {
      try {
        $app.logger().error("audit write failed: " + this.safeMessage(err))
      } catch (_) {}
    }
  },
}
