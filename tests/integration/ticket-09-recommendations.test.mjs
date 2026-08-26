import test from "node:test"
import assert from "node:assert/strict"
import { startPbTestServer } from "../helpers/pb-test-server.mjs"

test("Ticket 09: 员工荐药与业务记录集成测试", async (t) => {
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
    name: "武汉江汉路店",
    code: "STORE-WH-001",
    status: "营业中",
  }, superHeaders)
  const storeId = storeRes.data.id

  const empRes = await req("POST", "/api/collections/employees/records", {
    name: "孙营业员",
    phone: "13300000001",
    role: "营业员",
    store: storeId,
    status: "在职",
  }, superHeaders)
  const empId = empRes.data.id

  // 3. 创建荐药记录
  const recRes = await req("POST", "/api/collections/recommendations/records", {
    store: storeId,
    employee: empId,
    query: "干咳无痰三天，晚上咳得厉害",
    result_json: {
      products: [
        { name: "苏黄止咳胶囊", brand: "扬子江", specification: "0.45g*24粒" },
        { name: "西瓜霜润喉片", brand: "三金", specification: "24片" },
      ],
      rationale: "风邪犯肺型咳嗽，以宣肺止咳利咽为主。",
    },
    safety: "未发现明确冲突",
    source_count: 3,
    sync_status: "TEST_DATA",
    occurred_at: "2026-08-26 16:00:00",
  }, superHeaders)
  assert.equal(recRes.status, 200, "创建荐药记录成功")
  const recId = recRes.data.id

  // 4. 检索荐药列表
  const listRes = await req("GET", "/api/collections/recommendations/records?filter=(query~'干咳')", null, superHeaders)
  assert.equal(listRes.status, 200)
  assert.equal(listRes.data.items.length, 1)
  assert.equal(listRes.data.items[0].id, recId)
})
