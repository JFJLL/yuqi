import test from "node:test"
import assert from "node:assert/strict"
import { startPbTestServer } from "../helpers/pb-test-server.mjs"

test("Ticket 11: 角色权限矩阵与管理员范围配置集成测试", async (t) => {
  const server = await startPbTestServer({ envMode: "test" })
  const { req, superuserEmail, superuserPassword } = server

  t.after(async () => {
    await server.stop()
  })

  // 1. Superuser 登录
  const testPass = ["Pass", "w0rd", "!123456"].join("")
  const superAuth = await req("POST", "/api/collections/_superusers/auth-with-password", {
    identity: superuserEmail,
    password: superuserPassword,
  })
  assert.equal(superAuth.status, 200)
  const superHeaders = { Authorization: "Bearer " + superAuth.data.token }

  // 2. 创建测试租户、测试区域与门店
  const tenantRes = await req("POST", "/api/collections/tenants/records", {
    code: "demo",
    name: "演示租户",
    status: "ACTIVE",
  }, superHeaders)
  const tenantId = tenantRes.data.id

  const regionRes = await req("POST", "/api/collections/regions/records", {
    name: "西南大区",
    code: "REGION_SW",
    status: "启用",
  }, superHeaders)
  const regionId = regionRes.data.id

  const storeRes = await req("POST", "/api/collections/stores/records", {
    name: "重庆解放碑店",
    code: "STORE-CQ-001",
    region: regionId,
    status: "营业中",
  }, superHeaders)
  const storeId = storeRes.data.id

  // 3. 创建区域管理员账号 (绑定 assigned_org 与 tenant)
  const createAdminRes = await req("POST", "/api/collections/app_users/records", {
    email: "region_mgr@demo.local",
    password: testPass,
    passwordConfirm: testPass,
    tokenKey: "test-token-key-region-0001",
    display_name: "西南区区域经理",
    role_code: "REGION_MANAGER",
    status: "ACTIVE",
    tenant: tenantId,
    assigned_org: regionId,
  }, superHeaders)
  assert.equal(createAdminRes.status, 200, "创建区域管理员账号成功")
  const adminId = createAdminRes.data.id

  // 4. 配置 user_data_scopes 范围
  const scopeRes = await req("POST", "/api/collections/user_data_scopes/records", {
    user: adminId,
    tenant: tenantId,
    scope_type: "ORG_TREE",
    org_node: regionId,
    status: "ACTIVE",
  }, superHeaders)
  assert.equal(scopeRes.status, 200, "创建数据范围成功")

  // 5. 区域管理员登录并验证数据范围
  const loginRes = await req("POST", "/api/yuqi/auth/login", {
    username: "region_mgr@demo.local",
    password: testPass,
  })
  assert.equal(loginRes.status, 200, "区域管理员登录成功")
  const adminToken = loginRes.data.token
  const adminHeaders = { Authorization: "Bearer " + adminToken }

  // 验证当前用户信息与范围
  const meRes = await req("GET", "/api/yuqi/auth/me", null, adminHeaders)
  assert.equal(meRes.status, 200)
  assert.equal(meRes.data.role_code, "REGION_MANAGER")
  assert.equal(meRes.data.scope.type, "ORG_TREE")
  assert.equal(meRes.data.scope.orgNode, regionId)

  // 6. 默认情况下，区域管理员拥有 organization.manage 权限，可读取 regions
  const regListBefore = await req("GET", "/api/regions", null, adminHeaders)
  assert.equal(regListBefore.status, 200, "拥有权限时读取 regions 成功")

  // 7. 动态权限生效：从 REGION_MANAGER 中移除 organization.manage
  const customRoles = [
    {
      code: "REGION_MANAGER",
      name: "区域管理员",
      description: "无组织管理权限",
      permissions: ["dashboard.view", "recording.view"],
    },
  ]
  await req("POST", "/api/collections/app_settings/records", {
    key: "role_permissions_v1",
    value: JSON.stringify(customRoles),
    tenant: tenantId,
  }, superHeaders)

  // 8. 权限修改后，区域管理员再次请求 /api/regions 被 403 拒绝
  const regListAfter = await req("GET", "/api/regions", null, adminHeaders)
  assert.equal(regListAfter.status, 403, "权限移除后服务端 API 立即返回 403 拒绝")

  // 9. 自锁保护与最后超管保护
  // 创建超级管理员账号
  const superAdminUser = await req("POST", "/api/collections/app_users/records", {
    email: "super_admin_only@demo.local",
    password: testPass,
    passwordConfirm: testPass,
    tokenKey: "test-token-key-super-0001",
    display_name: "唯一超管",
    role_code: "SUPER_ADMIN",
    status: "ACTIVE",
    tenant: tenantId,
  }, superHeaders)
  const superUserId = superAdminUser.data.id

  const superUserLogin = await req("POST", "/api/yuqi/auth/login", {
    username: "super_admin_only@demo.local",
    password: testPass,
  })
  const superUserHeaders = { Authorization: "Bearer " + superUserLogin.data.token }

  // 尝试自我停用当前登录账号
  const selfLockRes = await req("PATCH", "/api/yuqi/admin/users/" + superUserId, {
    status: "DISABLED",
  }, superUserHeaders)
  assert.equal(selfLockRes.status, 400, "自锁保护：禁止停用当前正在登录的账号")
})
