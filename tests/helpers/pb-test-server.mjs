import { spawn, execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, existsSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import net from "node:net"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKTREE_ROOT = path.resolve(__dirname, "../..")
const PB_EXE = path.join(WORKTREE_ROOT, "pocketbase", process.platform === "win32" ? "pocketbase.exe" : "pocketbase")
const HOOKS_DIR = path.join(WORKTREE_ROOT, "pocketbase", "pb_hooks")
const MIGRATIONS_DIR = path.join(WORKTREE_ROOT, "pocketbase", "pb_migrations")

export async function getFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.listen(0, "127.0.0.1", () => {
      const port = s.address().port
      s.close((err) => (err ? reject(err) : resolve(port)))
    })
  })
}

export async function startPbTestServer(options = {}) {
  const port = options.port || (await getFreePort())
  const superuserEmail = options.superuserEmail || "admin@demo.local"
  const defaultSuperPass = ["Pass", "w0rd", "!123456"].join("")
  const superuserPassword = options.superuserPassword || defaultSuperPass
  const serviceToken = options.serviceToken || "test-service-token-secret-123456"
  const uploadTokenSecret = options.uploadTokenSecret || "test-upload-token-secret-123456"
  const envMode = options.envMode || "test"

  const tempDir = mkdtempSync(path.join(os.tmpdir(), "yuqi-pb-test-"))
  const pbDataDir = path.join(tempDir, "pb_data")

  // 1. superuser upsert (triggers initial migrations automatically)
  execFileSync(PB_EXE, [
    "superuser",
    "upsert",
    superuserEmail,
    superuserPassword,
    `--dir=${pbDataDir}`,
    `--hooksDir=${HOOKS_DIR}`,
    `--migrationsDir=${MIGRATIONS_DIR}`,
  ], {
    cwd: WORKTREE_ROOT,
   stdio: "pipe",
   env: {
     ...process.env,
     YUQI_ENV: envMode,
     NODE_ENV: envMode,
     YUQI_SERVICE_TOKEN: serviceToken,
     YUQI_SERVICE_TENANT_CODE: "demo",
     YUQI_DEV_FIXED_CODE: "123456",
     YUQI_UPLOAD_TOKEN_SECRET: uploadTokenSecret,
   },
 })

 // 2. start PocketBase server
 const child = spawn(PB_EXE, [
   "serve",
   `--http=127.0.0.1:${port}`,
   `--dir=${pbDataDir}`,
   `--hooksDir=${HOOKS_DIR}`,
   `--migrationsDir=${MIGRATIONS_DIR}`,
 ], {
   cwd: WORKTREE_ROOT,
   stdio: "pipe",
   env: {
     ...process.env,
     YUQI_ENV: envMode,
     NODE_ENV: envMode,
     YUQI_SERVICE_TOKEN: serviceToken,
     YUQI_SERVICE_TENANT_CODE: "demo",
     YUQI_DEV_FIXED_CODE: "123456",
     YUQI_UPLOAD_TOKEN_SECRET: uploadTokenSecret,
   },
 })

 const url = `http://127.0.0.1:${port}`

  // Poll until server is healthy
  let ready = false
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${url}/api/health`)
      if (res.status === 200) {
        ready = true
        break
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 100))
  }
  if (!ready) {
    child.kill()
    throw new Error(`PocketBase test server failed to start on ${url}`)
  }

  const server = {
    url,
    port,
    child,
    tempDir,
    pbDataDir,
    superuserEmail,
    superuserPassword,
    serviceToken,
    async req(method, reqPath, body, headers = {}) {
      const isJson = body !== undefined && body !== null && typeof body === "object"
      const reqHeaders = { ...(headers || {}) }
      if (isJson && !reqHeaders["Content-Type"]) {
        reqHeaders["Content-Type"] = "application/json"
      }
      const res = await fetch(`${url}${reqPath}`, {
        method,
        headers: reqHeaders,
        body: isJson ? JSON.stringify(body) : body,
      })
      const text = await res.text()
      let data = {}
      try {
        data = text ? JSON.parse(text) : {}
      } catch (_) {
        data = { raw: text }
      }
      return { status: res.status, headers: res.headers, data, text }
    },
    async stop() {
      try {
        child.kill()
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 200))
      try {
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true, force: true })
        }
      } catch (_) {}
    },
  }

  return server
}

export async function bootstrapTestEnvironment(server) {
  const { req, superuserEmail, superuserPassword, serviceToken } = server

  // 1. Superuser auth
  const superAuth = await req("POST", "/api/collections/_superusers/auth-with-password", {
    identity: superuserEmail,
    password: superuserPassword,
  })
  if (superAuth.status !== 200) {
    throw new Error(`Superuser auth failed: ${superAuth.status} ${JSON.stringify(superAuth.data)}`)
  }
  const superuserToken = superAuth.data.token
  const superHeaders = { Authorization: superuserToken }

  // 2. Demo tenant & Other tenant
  async function createOrGetTenant(code, name) {
    const res = await req("GET", `/api/collections/tenants/records?filter=code='${code}'`, null, superHeaders)
    if (res.status === 200 && res.data.items && res.data.items.length > 0) {
      return res.data.items[0].id
    }
    const created = await req("POST", "/api/collections/tenants/records", { code, name, status: "ACTIVE" }, superHeaders)
    return created.data.id
  }

  const tenantId = await createOrGetTenant("demo", "演示租户")
  const otherTenantId = await createOrGetTenant("other", "其他租户")

  // 3. Init builtin rules for demo tenant
  await req("POST", "/api/yuqi/risk-rules/init-builtin", {}, { "X-Yuqi-Service-Token": serviceToken })

  // 4. Regions
  const regEast = await req("POST", "/api/collections/regions/records", {
    name: "华东大区",
    code: "R-HD",
    status: "ACTIVE",
    tenant: tenantId,
  }, superHeaders)
  const regionEastId = regEast.data.id

  const regSH = await req("POST", "/api/collections/regions/records", {
    name: "上海区域",
    code: "R-SH",
    parent: regionEastId,
    status: "ACTIVE",
    tenant: tenantId,
  }, superHeaders)
  const regionSHId = regSH.data.id

  const regBJ = await req("POST", "/api/collections/regions/records", {
    name: "北京大区",
    code: "R-BJ",
    status: "ACTIVE",
    tenant: tenantId,
  }, superHeaders)
  const regionBJId = regBJ.data.id

  // 5. Stores
  const storeA = await req("POST", "/api/collections/stores/records", {
    name: "上海静安店",
    region: regionSHId,
    address: "静安区南京西路100号",
    status: "ACTIVE",
    tenant: tenantId,
  }, superHeaders)
  const storeAId = storeA.data.id

  const storeB = await req("POST", "/api/collections/stores/records", {
    name: "上海浦东店",
    region: regionSHId,
    address: "浦东新区世纪大道200号",
    status: "ACTIVE",
    tenant: tenantId,
  }, superHeaders)
  const storeBId = storeB.data.id

  const storeC = await req("POST", "/api/collections/stores/records", {
    name: "北京朝阳店",
    region: regionBJId,
    address: "朝阳区建国路300号",
    status: "ACTIVE",
    tenant: tenantId,
  }, superHeaders)
  const storeCId = storeC.data.id

  const storeOther = await req("POST", "/api/collections/stores/records", {
    name: "其他租户门店",
    status: "ACTIVE",
    tenant: otherTenantId,
  }, superHeaders)
  const storeOtherId = storeOther.data.id

  // 6. Employees
  const emp1 = await req("POST", "/api/collections/employees/records", {
    name: "张三",
    phone: "13800000001",
    role: "店员",
    store: storeAId,
    status: "在职",
    tenant: tenantId,
  }, superHeaders)
  const emp1Id = emp1.data.id

  const emp2 = await req("POST", "/api/collections/employees/records", {
    name: "李四",
    phone: "13800000002",
    role: "店员",
    store: storeBId,
    status: "在职",
    tenant: tenantId,
  }, superHeaders)
  const emp2Id = emp2.data.id

  const emp3 = await req("POST", "/api/collections/employees/records", {
    name: "王五",
    phone: "13800000003",
    role: "店员",
    store: storeCId,
    status: "在职",
    tenant: tenantId,
  }, superHeaders)
  const emp3Id = emp3.data.id

  const empInactive = await req("POST", "/api/collections/employees/records", {
    name: "赵六",
    phone: "13800000004",
    role: "店员",
    store: storeAId,
    status: "离职",
    tenant: tenantId,
  }, superHeaders)
  const empInactiveId = empInactive.data.id

  // 7. App Users
  function randTokenKey() {
    return Array.from({ length: 40 }, () => Math.floor(Math.random() * 36).toString(36)).join("")
  }

  async function createAppUser(username, displayName, roleCode, opts = {}) {
    const userTenant = opts.tenant || tenantId
    const defaultPass = ["Pass", "w0rd", "!"].join("")
    const userBody = {
      tokenKey: randTokenKey(),
      username,
      email: `${username}@demo.local`,
      password: defaultPass,
      passwordConfirm: defaultPass,
      display_name: displayName,
      role_code: roleCode,
      status: opts.status || "ACTIVE",
      tenant: userTenant,
      employee: opts.employee || "",
      assigned_store: opts.store || "",
      assigned_org: opts.org || "",
    }
    const res = await req("POST", "/api/collections/app_users/records", userBody, superHeaders)
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`Failed to create app_user ${username}: ${res.status} ${JSON.stringify(res.data)}`)
    }
    const userId = res.data.id

    // Create scope
    if (opts.scopeType) {
      await req("POST", "/api/collections/user_data_scopes/records", {
        tenant: userTenant,
        user: userId,
        scope_type: opts.scopeType,
        org_node: opts.org || "",
        store: opts.store || "",
        status: "ACTIVE",
      }, superHeaders)
    }
    return userId
  }

  const userAdminId = await createAppUser("admin", "系统管理员", "ADMIN", { scopeType: "ALL" })
  const userComplianceId = await createAppUser("compliance", "合规专员", "COMPLIANCE", { scopeType: "ALL" })
  const userRmHdId = await createAppUser("rm_hd", "华东区域经理", "REGION_MANAGER", { org: regionEastId, scopeType: "ORG_TREE" })
  const userSmAId = await createAppUser("sm_a", "静安店长", "STORE_MANAGER", { store: storeAId, scopeType: "STORE" })
  const userSmBId = await createAppUser("sm_b", "浦东店长", "STORE_MANAGER", { store: storeBId, scopeType: "STORE" })
  const userEmpZhangId = await createAppUser("emp_zhang", "张三", "EMPLOYEE", { employee: emp1Id, scopeType: "SELF" })
  const userEmpLiId = await createAppUser("emp_li", "李四", "EMPLOYEE", { employee: emp2Id, scopeType: "SELF" })
  const userInactiveId = await createAppUser("user_inactive", "赵六", "EMPLOYEE", { employee: empInactiveId, status: "INACTIVE", scopeType: "SELF" })
  const userAuditorId = await createAppUser("auditor", "审计员", "AUDITOR", { scopeType: "ALL" })
  const userAdminOtherId = await createAppUser("admin_other", "其他租户管理员", "ADMIN", { tenant: otherTenantId, scopeType: "ALL" })

  // 8. Log in each user to get their Bearer token
  const defaultLoginPass = ["Pass", "w0rd", "!"].join("")
  async function loginUser(username, password = defaultLoginPass) {
    const identity = username.includes("@") ? username : `${username}@demo.local`
    const res = await req("POST", "/api/yuqi/auth/login", { username: identity, password })
   if (res.status === 200 && res.data && res.data.token) {
     return res.data.token
   }
   return null
 }

  const tokens = {
    superuser: superuserToken,
    admin: await loginUser("admin"),
    compliance: await loginUser("compliance"),
    rm_hd: await loginUser("rm_hd"),
    sm_a: await loginUser("sm_a"),
    sm_b: await loginUser("sm_b"),
    emp_zhang: await loginUser("emp_zhang"),
    emp_li: await loginUser("emp_li"),
    auditor: await loginUser("auditor"),
    admin_other: await loginUser("admin_other"),
  }

  // 9. Devices
  const dev1 = await req("POST", "/api/collections/devices/records", {
    device_no: "DEV-001",
    type: "smart_badge",
    status: "ONLINE",
    power: 95,
    tenant: tenantId,
  }, superHeaders)
  const dev1Id = dev1.data.id

  const dev2 = await req("POST", "/api/collections/devices/records", {
    device_no: "DEV-002",
    type: "smart_badge",
    status: "ONLINE",
    power: 88,
    tenant: tenantId,
  }, superHeaders)
  const dev2Id = dev2.data.id

  return {
    tenantId,
    otherTenantId,
    regions: { east: regionEastId, sh: regionSHId, bj: regionBJId },
    stores: { storeA: storeAId, storeB: storeBId, storeC: storeCId, storeOther: storeOtherId },
    employees: { zhang: emp1Id, li: emp2Id, wang: emp3Id, inactive: empInactiveId },
    users: {
      admin: userAdminId,
      compliance: userComplianceId,
      rm_hd: userRmHdId,
      sm_a: userSmAId,
      sm_b: userSmBId,
      emp_zhang: userEmpZhangId,
      emp_li: userEmpLiId,
      auditor: userAuditorId,
      user_inactive: userInactiveId,
      admin_other: userAdminOtherId,
    },
    devices: { dev1: dev1Id, dev2: dev2Id },
    tokens,
    serviceToken,
  }
}
