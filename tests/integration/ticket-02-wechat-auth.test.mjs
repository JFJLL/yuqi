import test from "node:test"
import assert from "node:assert/strict"
import { startPbTestServer } from "../helpers/pb-test-server.mjs"

test("Ticket 02: 微信小程序登录与账号关联集成测试", async (t) => {
  const server = await startPbTestServer({ envMode: "test" })
  const { req, superuserEmail, superuserPassword } = server

  t.after(async () => {
    await server.stop()
  })

  // 1. Superuser 登录
  const superAuth = await req("POST", "/api/collections/_superusers/auth-with-password", {
    identity: superuserEmail,
    password: superuserPassword,
  })
  assert.equal(superAuth.status, 200, "Superuser 登录成功")
  const superToken = superAuth.data.token
  const superHeaders = { Authorization: "Bearer " + superToken }

  // 2. 创建测试租户和测试员工
  const tenantRes = await req("POST", "/api/collections/tenants/records", {
    code: "demo",
    name: "演示租户",
    status: "ACTIVE",
  }, superHeaders)
  const tenantId = tenantRes.data.id

  const createEmpRes = await req("POST", "/api/collections/employees/records", {
    name: "测试张药师",
    phone: "13912345678",
    role: "营业员",
    status: "在职",
    tenant: tenantId,
  }, superHeaders)
  assert.equal(createEmpRes.status, 200, "创建测试员工成功")
  const empData = createEmpRes.data

  // 3. 测试环境 Mock 微信登录 (loginCode + phoneCode)
  const mockLoginRes = await req("POST", "/api/yuqi/auth/wechat/login", {
    loginCode: "mock-wx-code-1",
    phoneCode: "13912345678",
    testMock: true,
  })
  if (mockLoginRes.status !== 200) {
    console.error("Mock login failed details:", mockLoginRes.data)
  }
  assert.equal(mockLoginRes.status, 200, "Mock 微信登录成功: " + JSON.stringify(mockLoginRes.data))
  assert.ok(mockLoginRes.data.token, "返回有效 PocketBase 认证 Token")
  assert.equal(mockLoginRes.data.record.mobile, "13912345678", "匹配到正确的手机号")

  // 4. 检查 wechat_accounts 表中记录
  const wechatRowsRes = await req("GET", "/api/collections/wechat_accounts/records?filter=(openid='mock_wx_openid_13912345678')", null, superHeaders)
  assert.equal(wechatRowsRes.status, 200)
  assert.equal(wechatRowsRes.data.items.length, 1, "成功写入 wechat_accounts 绑定记录")
  assert.equal(wechatRowsRes.data.items[0].status, "ACTIVE", "绑定状态为 ACTIVE")
  assert.equal(wechatRowsRes.data.items[0].employee, empData.id, "关联正确的 employee ID")

  // 5. 停用员工后微信登录被拒绝
  await req("PATCH", "/api/collections/employees/records/" + empData.id, {
    status: "离职",
  }, superHeaders)

  const disabledLoginRes = await req("POST", "/api/yuqi/auth/wechat/login", {
    loginCode: "mock-wx-code-1",
    phoneCode: "13912345678",
    testMock: true,
  })
  assert.equal(disabledLoginRes.status, 403, "停用员工登录返回 403 拒绝")

  // 6. 微信解绑
  const unbindRes = await req("POST", "/api/yuqi/auth/wechat/unbind", {
    openid: "mock_wx_openid_13912345678",
  }, { Authorization: "Bearer " + mockLoginRes.data.token })
  assert.equal(unbindRes.status, 200, "解绑接口调用成功")

  // 7. 负向测试：员工抢绑防御 (409 Conflict)
  // 创建员工 A 和员工 B
  const empARes = await req("POST", "/api/collections/employees/records", {
    name: "员工A",
    phone: "13800001111",
    role: "营业员",
    status: "在职",
    tenant: tenantId,
  }, superHeaders)
  const empBRes = await req("POST", "/api/collections/employees/records", {
    name: "员工B",
    phone: "13800002222",
    role: "营业员",
    status: "在职",
    tenant: tenantId,
  }, superHeaders)

  const loginA = await req("POST", "/api/yuqi/auth/wechat/login", {
    loginCode: "mock-wx-code-A",
    phoneCode: "13800001111",
    testMock: true,
  })
  assert.equal(loginA.status, 200, "员工A登录成功")
  const tokenA = loginA.data.token

  const loginB = await req("POST", "/api/yuqi/auth/wechat/login", {
    loginCode: "mock-wx-code-B",
    phoneCode: "13800002222",
    testMock: true,
  })
  assert.equal(loginB.status, 200, "员工B登录成功")

  const openidB = "mock_wx_openid_13800002222"

  // 员工 A 尝试把 员工 B 的 openid 强行绑定到员工 A 名下
  const stealRes = await req("POST", "/api/yuqi/auth/wechat/bind", {
    openid: openidB,
    employeeId: empARes.data.id,
  }, { Authorization: "Bearer " + tokenA })
  assert.ok(stealRes.status === 409 || stealRes.status === 403, "抢绑已被占用或未验证 openid 必须被拒绝 (409/403)")

  // 员工 A 尝试直接提交未经服务端签发的伪造 raw openid 进行绑定
  const fakeOpenidBind = await req("POST", "/api/yuqi/auth/wechat/bind", {
    openid: "client_supplied_unverified_openid_xyz",
    employeeId: empARes.data.id,
    mobile: "13800001111",
  }, { Authorization: "Bearer " + tokenA })
  assert.equal(fakeOpenidBind.status, 403, "未携带有效绑定凭据提交伪造 openid 必须被 403 拒绝")

  // 员工 A 尝试通过 openid 反查员工 B 的绑定信息
  const statusOtherRes = await req("GET", "/api/yuqi/auth/wechat/status?openid=" + openidB, null, { Authorization: "Bearer " + tokenA })
  assert.equal(statusOtherRes.status, 403, "员工端禁止通过 openid 探查他人绑定状态 (403)")
})

test("Ticket 02: 生产环境下未配置微信凭据时安全失败 (503)", async (t) => {
  const server = await startPbTestServer({ envMode: "production" })
  const { req } = server

  t.after(async () => {
    await server.stop()
  })

  // 生产环境直接调用微信登录（未配置 WECHAT_MINI_APPID）
  const realLoginRes = await req("POST", "/api/yuqi/auth/wechat/login", {
    loginCode: "real-wx-login-code",
    phoneCode: "real-wx-phone-code",
    testMock: false,
  })
  assert.equal(realLoginRes.status, 503, "未配置真实微信凭据时安全返回 503")
  assert.equal(realLoginRes.data.error, "wechat_not_configured")
})
