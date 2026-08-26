import test from "node:test"
import assert from "node:assert/strict"
import { startPbTestServer } from "../helpers/pb-test-server.mjs"

test("Ticket 04: 员工管理与微信绑定集成测试", async (t) => {
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

  // 2. 创建测试门店与员工
  const storeRes = await req("POST", "/api/collections/stores/records", {
    name: "北京王府井旗舰店",
    code: "STORE-BJ-001",
    status: "营业中",
  }, superHeaders)
  const storeId = storeRes.data.id

  const empRes = await req("POST", "/api/collections/employees/records", {
    name: "刘执业药师",
    phone: "13812345678",
    role: "执业药师",
    store: storeId,
    status: "在职",
  }, superHeaders)
  assert.equal(empRes.status, 200, "新增员工成功")
  const empId = empRes.data.id

  // 3. 员工登录建立微信账号绑定
  const wxLoginRes = await req("POST", "/api/yuqi/auth/wechat/login", {
    loginCode: "mock-login-test",
    phoneCode: "13812345678",
    testMock: true,
  })
  assert.equal(wxLoginRes.status, 200, "微信快捷登录成功")
  assert.equal(wxLoginRes.data.record.mobile, "13812345678")

  // 4. 查询绑定状态
  const wechatRows = await req("GET", "/api/collections/wechat_accounts/records?filter=(employee='" + empId + "')", null, superHeaders)
  assert.equal(wechatRows.status, 200)
  assert.equal(wechatRows.data.items.length, 1)
  assert.equal(wechatRows.data.items[0].status, "ACTIVE")

  // 5. 解绑微信账号
  const unbindRes = await req("POST", "/api/yuqi/auth/wechat/unbind", {
    employeeId: empId,
  }, { Authorization: "Bearer " + wxLoginRes.data.token })
  assert.equal(unbindRes.status, 200, "解绑成功")

  const wechatRowsAfter = await req("GET", "/api/collections/wechat_accounts/records?filter=(employee='" + empId + "')", null, superHeaders)
  assert.equal(wechatRowsAfter.data.items[0].status, "UNBOUND", "状态更新为 UNBOUND")
})
