import test from "node:test"
import assert from "node:assert/strict"
import { startPbTestServer } from "../helpers/pb-test-server.mjs"

test("Ticket 03: 区域、门店与店长管理集成测试", async (t) => {
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

  // 2. 创建区域 (带负责人信息与状态)
  const regionRes = await req("POST", "/api/collections/regions/records", {
    name: "华东大区",
    code: "REGION_EAST",
    manager_name: "赵区域总",
    manager_mobile: "13811112222",
    status: "启用",
  }, superHeaders)
  assert.equal(regionRes.status, 200, "创建区域成功")
  const regionId = regionRes.data.id

  // 3. 创建门店
  const storeRes = await req("POST", "/api/collections/stores/records", {
    name: "上海南京东路旗舰店",
    code: "STORE-SH-001",
    region: regionId,
    address: "上海市黄浦区南京东路100号",
    status: "营业中",
  }, superHeaders)
  assert.equal(storeRes.status, 200, "创建门店成功")
  const storeId = storeRes.data.id

  // 4. 创建在职员工并设置为店长
  const empRes = await req("POST", "/api/collections/employees/records", {
    name: "王店长",
    phone: "13800138000",
    role: "店长",
    store: storeId,
    status: "在职",
  }, superHeaders)
  assert.equal(empRes.status, 200, "创建店长员工成功")
  const empId = empRes.data.id

  // 关联店长至门店
  const updateStoreRes = await req("PATCH", "/api/collections/stores/records/" + storeId, {
    manager_name: "王店长",
    manager_mobile: "13800138000",
    manager_employee: empId,
  }, superHeaders)
  assert.equal(updateStoreRes.status, 200, "设置门店店长成功")
  assert.equal(updateStoreRes.data.manager_name, "王店长")

  // 5. 校验门店列表可正确按区域过滤
  const filterStoresRes = await req("GET", "/api/collections/stores/records?filter=(region='" + regionId + "')", null, superHeaders)
  assert.equal(filterStoresRes.status, 200)
  assert.equal(filterStoresRes.data.items.length, 1)
  assert.equal(filterStoresRes.data.items[0].code, "STORE-SH-001")
})
