import test from "node:test"
import assert from "node:assert/strict"
import { startPbTestServer } from "../helpers/pb-test-server.mjs"

test("Ticket 15: 小程序巡检闭环、申诉与个人中心集成测试", async (t) => {
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
  assert.equal(superAuth.status, 200)
  const superHeaders = { Authorization: "Bearer " + superAuth.data.token }

  // 2. 创建租户、门店、员工
  const tenantRes = await req("POST", "/api/collections/tenants/records", {
    code: "demo",
    name: "演示租户",
    status: "ACTIVE",
  }, superHeaders)
  const tenantId = tenantRes.data.id

  const storeRes = await req("POST", "/api/collections/stores/records", {
    name: "苏州观前店",
    code: "STORE-SZ-002",
    tenant: tenantId,
    status: "营业中",
  }, superHeaders)
  const storeId = storeRes.data.id

  const empRes = await req("POST", "/api/collections/employees/records", {
    name: "韩药师",
    phone: "13800000099",
    role: "营业员",
    store: storeId,
    tenant: tenantId,
    status: "在职",
  }, superHeaders)
  const empId = empRes.data.id

  // 3. 员工微信登录
  const wxLoginRes = await req("POST", "/api/yuqi/auth/wechat/login", {
    loginCode: "mock-code-han",
    phoneCode: "13800000099",
    testMock: true,
  })
  assert.equal(wxLoginRes.status, 200, "员工微信登录成功")
  const empToken = wxLoginRes.data.token
  const empHeaders = { Authorization: "Bearer " + empToken }

  // 4. 员工个人资料查询
  const profileRes = await req("GET", "/api/yuqi/employee/profile", null, empHeaders)
  assert.equal(profileRes.status, 200, "获取个人资料成功")
  assert.equal(profileRes.data.employee.name, "韩药师")

  // 5. 创建一条已复核的问题并推送给员工
  const issueRes = await req("POST", "/api/collections/issues/records", {
    store: storeId,
    employee: empId,
    tenant: tenantId,
    rule_code: "RX_NO_PRESCRIPTION",
    risk_level: "HIGH",
    title: "处方药未审核",
    summary: "处方药未经药师审方",
    evidence_text: "店员：这个处方药可以直接拿。",
    advice: "处方药必须经执业药师审核处方后方可调配销售。",
    review_status: "APPROVED",
    employee_visibility: "VISIBLE",
    close_status: "OPEN",
    appeal_status: "NONE",
    rectification_status: "NONE",
  }, superHeaders)
  assert.equal(issueRes.status, 200, "创建已复核推送问题成功")
  const issueId = issueRes.data.id

  // 6. 员工端通过 /api/yuqi/employee/appeals 提交申诉
  const appealRes = await req("POST", "/api/yuqi/employee/appeals", {
    issue: issueId,
    reason: "该顾客提供了电子处方，已在收银台完成药师在线审方。",
  }, empHeaders)
  assert.equal(appealRes.status, 200, "员工端提交申诉成功")

  // 7. 员工端设备查询
  const devRes = await req("GET", "/api/yuqi/employee/device", null, empHeaders)
  assert.equal(devRes.status, 200, "员工端设备接口可用")
})
