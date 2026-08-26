import test from "node:test"
import assert from "node:assert/strict"
import { startPbTestServer } from "../helpers/pb-test-server.mjs"

test("Ticket 07: AI 巡检、人工复核与推送整改集成测试", async (t) => {
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

  // 2. 创建测试门店、员工
  const storeRes = await req("POST", "/api/collections/stores/records", {
    name: "深圳南山店",
    code: "STORE-SZ-001",
    status: "营业中",
  }, superHeaders)
  const storeId = storeRes.data.id

  const empRes = await req("POST", "/api/collections/employees/records", {
    name: "周营业员",
    phone: "13500000001",
    role: "营业员",
    store: storeId,
    status: "在职",
  }, superHeaders)
  const empId = empRes.data.id

  // 3. 创建 AI 巡检疑似问题记录 (初始状态为 待复核 / AI_SUSPECTED)
  const issueRes = await req("POST", "/api/collections/inspection_issues/records", {
    store: storeId,
    employee: empId,
    issue_type: "夸大疗效",
    risk: "高",
    state: "待复核",
    quote: "店员：吃我们这个保健品，一个疗程彻底治愈高血压。",
    advice: "向顾客说明保健品不可替代药品，规范用语。",
    occurred_at: "2026-08-26 14:00:00",
  }, superHeaders)
  assert.equal(issueRes.status, 200, "创建巡检疑似问题成功")
  const issueId = issueRes.data.id

  // 4. 人工复核通过并推送整改任务
  const updateIssueRes = await req("PATCH", "/api/collections/inspection_issues/records/" + issueId, {
    state: "待整改",
  }, superHeaders)
  assert.equal(updateIssueRes.status, 200)
  assert.equal(updateIssueRes.data.state, "待整改")

  const taskRes = await req("POST", "/api/collections/rectify_tasks/records", {
    title: "夸大疗效整改",
    owner: empId,
    store: storeId,
    source_issue: issueId,
    due_date: "2026-08-29",
    progress: 0,
    state: "待整改",
  }, superHeaders)
  assert.equal(taskRes.status, 200, "创建关联整改任务成功")

  // 5. 整改完成闭环
  const closeTaskRes = await req("PATCH", "/api/collections/rectify_tasks/records/" + taskRes.data.id, {
    state: "已完成",
    progress: 100,
  }, superHeaders)
  assert.equal(closeTaskRes.status, 200)

  const closeIssueRes = await req("PATCH", "/api/collections/inspection_issues/records/" + issueId, {
    state: "已完成",
  }, superHeaders)
  assert.equal(closeIssueRes.status, 200)
  assert.equal(closeIssueRes.data.state, "已完成")
})
