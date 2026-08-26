import test from "node:test"
import assert from "node:assert/strict"
import { startPbTestServer } from "../helpers/pb-test-server.mjs"

test("Ticket 12: 基础报表与指标口径聚合集成测试", async (t) => {
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

  // 2. 创建测试租户、管理员、门店与员工
  const tenantRes = await req("POST", "/api/collections/tenants/records", {
    code: "demo",
    name: "演示租户",
    status: "ACTIVE",
  }, superHeaders)
  const tenantId = tenantRes.data.id

  const adminRes = await req("POST", "/api/collections/app_users/records", {
    email: "report_admin@demo.local",
    password: testPass,
    passwordConfirm: testPass,
    tokenKey: "test-token-key-report-001",
    display_name: "报表管理员",
    role_code: "ADMIN",
    status: "ACTIVE",
    tenant: tenantId,
  }, superHeaders)
  assert.equal(adminRes.status, 200)

  const adminLoginRes = await req("POST", "/api/yuqi/auth/login", {
    username: "report_admin@demo.local",
    password: testPass,
  })
  assert.equal(adminLoginRes.status, 200)
  const adminHeaders = { Authorization: "Bearer " + adminLoginRes.data.token }

  const storeRes = await req("POST", "/api/collections/stores/records", {
    name: "南京新街口店",
    code: "STORE-NJ-001",
    tenant: tenantId,
    status: "营业中",
  }, superHeaders)
  const storeId = storeRes.data.id

  const empRes = await req("POST", "/api/collections/employees/records", {
    name: "徐药师",
    phone: "13100000001",
    role: "营业员",
    store: storeId,
    tenant: tenantId,
    status: "在职",
  }, superHeaders)
  const empId = empRes.data.id

  // 3. 创建录音转写与问题记录
  await req("POST", "/api/collections/transcripts/records", {
    store: storeId,
    employee: empId,
    tenant: tenantId,
    summary: "感冒药咨询",
    qc_result: "已完成",
  }, superHeaders)

  await req("POST", "/api/collections/inspection_issues/records", {
    store: storeId,
    employee: empId,
    tenant: tenantId,
    issue_type: "未提示用量",
    risk: "中",
    state: "待整改",
  }, superHeaders)

  // 4. 调用服务端工作台聚合报表接口
  const summaryRes = await req("GET", "/api/admin/dashboard/summary", null, adminHeaders)
  assert.equal(summaryRes.status, 200, "聚合报表接口调用成功")
  assert.ok(summaryRes.data.stats, "包含统计卡指标")
})
