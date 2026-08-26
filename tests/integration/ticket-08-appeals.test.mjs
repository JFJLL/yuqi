import test from "node:test"
import assert from "node:assert/strict"
import { startPbTestServer } from "../helpers/pb-test-server.mjs"

test("Ticket 08: 申诉复核双栏与状态闭环集成测试", async (t) => {
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

  // 2. 创建测试门店、员工与巡检问题
  const storeRes = await req("POST", "/api/collections/stores/records", {
    name: "杭州湖滨店",
    code: "STORE-HZ-001",
    status: "营业中",
  }, superHeaders)
  const storeId = storeRes.data.id

  const empRes = await req("POST", "/api/collections/employees/records", {
    name: "吴店员",
    phone: "13400000001",
    role: "营业员",
    store: storeId,
    status: "在职",
  }, superHeaders)
  const empId = empRes.data.id

  const issueRes = await req("POST", "/api/collections/inspection_issues/records", {
    store: storeId,
    employee: empId,
    issue_type: "未提示禁忌",
    risk: "中",
    state: "申诉中",
    quote: "店员：这个药饭后吃就行。顾客：好的。",
    advice: "需提示孕妇及哺乳期妇女慎用。",
    occurred_at: "2026-08-26 15:00:00",
  }, superHeaders)
  const issueId = issueRes.data.id

  // 3. 员工提交申诉
  const appealRes = await req("POST", "/api/collections/appeals/records", {
    issue: issueId,
    reason: "顾客当时出示了病历本且非妊娠期，已在沟通前段进行过确认。",
    status: "待复核",
  }, superHeaders)
  assert.equal(appealRes.status, 200, "提交申诉成功")
  const appealId = appealRes.data.id

  // 4. 复核通过
  const approveRes = await req("PATCH", "/api/collections/appeals/records/" + appealId, {
    status: "已通过",
    reviewed_at: "2026-08-26 15:30:00",
  }, superHeaders)
  assert.equal(approveRes.status, 200)
  assert.equal(approveRes.data.status, "已通过")

  const closeIssueRes = await req("PATCH", "/api/collections/inspection_issues/records/" + issueId, {
    state: "已完成",
  }, superHeaders)
  assert.equal(closeIssueRes.status, 200)
  assert.equal(closeIssueRes.data.state, "已完成")
})
