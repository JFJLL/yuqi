import test from "node:test"
import assert from "node:assert/strict"
import { startPbTestServer } from "../helpers/pb-test-server.mjs"

test("Ticket 06: 录音、转写与 ASR 运维集成测试", async (t) => {
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

  // 2. 创建测试门店、员工、转写记录与 ASR 任务
  const storeRes = await req("POST", "/api/collections/stores/records", {
    name: "广州天河店",
    code: "STORE-GZ-001",
    status: "营业中",
  }, superHeaders)
  const storeId = storeRes.data.id

  const empRes = await req("POST", "/api/collections/employees/records", {
    name: "陈药师",
    phone: "13600000001",
    role: "营业员",
    store: storeId,
    status: "在职",
  }, superHeaders)
  const empId = empRes.data.id

  const transRes = await req("POST", "/api/collections/transcripts/records", {
    store: storeId,
    employee: empId,
    device: "DEV-GZ-01",
    summary: "顾客咨询止咳药与降压药同服注意事项",
    full_text: "顾客：你好，这个止咳药和降压药能一起吃吗？药师：需要间隔半小时服用，避免相互作用。",
    qc_result: "无问题",
    occurred_at: "2026-08-26 10:30:00",
  }, superHeaders)
  assert.equal(transRes.status, 200, "创建转写记录成功")
  const transId = transRes.data.id

  // 3. 检索转写列表并按关键词过滤
  const listRes = await req("GET", "/api/collections/transcripts/records?filter=(summary~'止咳药')", null, superHeaders)
  assert.equal(listRes.status, 200)
  assert.equal(listRes.data.items.length, 1)
  assert.equal(listRes.data.items[0].id, transId)

  // 4. 创建 ASR 任务并测试状态转换
  const asrJobRes = await req("POST", "/api/collections/asr_jobs/records", {
    transcript: transId,
    device: "DEV-GZ-01",
    employee: empId,
    store: storeId,
    status: "failed",
    error_message: "网络抖动超时",
  }, superHeaders)
  assert.equal(asrJobRes.status, 200, "创建 ASR 任务成功")
  const jobId = asrJobRes.data.id

  // 重试 ASR 任务
  const retryRes = await req("PATCH", "/api/collections/asr_jobs/records/" + jobId, {
    status: "queued",
    attempts: 2,
    error_message: "",
  }, superHeaders)
  assert.equal(retryRes.status, 200, "重试 ASR 任务状态更新为 queued")
  assert.equal(retryRes.data.status, "queued")
})
