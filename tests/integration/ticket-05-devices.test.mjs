import test from "node:test"
import assert from "node:assert/strict"
import { startPbTestServer } from "../helpers/pb-test-server.mjs"

test("Ticket 05: 统一设备管理与生命周期集成测试", async (t) => {
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

  // 2. 创建设备、门店、员工 A、员工 B
  const storeRes = await req("POST", "/api/collections/stores/records", {
    name: "上海徐家汇店",
    code: "STORE-SH-002",
    status: "营业中",
  }, superHeaders)
  const storeId = storeRes.data.id

  const emp1Res = await req("POST", "/api/collections/employees/records", {
    name: "员工小李",
    phone: "13700000001",
    role: "营业员",
    store: storeId,
    status: "在职",
  }, superHeaders)
  const emp1Id = emp1Res.data.id

  const emp2Res = await req("POST", "/api/collections/employees/records", {
    name: "员工小张",
    phone: "13700000002",
    role: "营业员",
    store: storeId,
    status: "在职",
  }, superHeaders)
  const emp2Id = emp2Res.data.id

  const devRes = await req("POST", "/api/collections/devices/records", {
    device_no: "DEV-4G-9988",
    type: "4G智能工牌",
    status: "在线",
    power: 95,
  }, superHeaders)
  assert.equal(devRes.status, 200, "创建设备成功")
  const devId = devRes.data.id

  // 3. 初始绑定: 设备绑定至员工 A
  const bindRes = await req("POST", "/api/collections/device_bindings/records", {
    device: devId,
    employee: emp1Id,
    store: storeId,
    effective_date: "2026-08-26",
    status: "已绑定",
  }, superHeaders)
  assert.equal(bindRes.status, 200, "绑定设备成功")
  const binding1Id = bindRes.data.id

  // 4. 调拨: 设备从员工 A 调拨给员工 B
  await req("PATCH", "/api/collections/device_bindings/records/" + binding1Id, {
    status: "已解绑",
  }, superHeaders)

  const bind2Res = await req("POST", "/api/collections/device_bindings/records", {
    device: devId,
    employee: emp2Id,
    store: storeId,
    effective_date: "2026-08-26",
    status: "已绑定",
  }, superHeaders)
  assert.equal(bind2Res.status, 200, "调拨设备成功")
  const binding2Id = bind2Res.data.id

  // 5. 解绑设备
  const unbindRes = await req("PATCH", "/api/collections/device_bindings/records/" + binding2Id, {
    status: "已解绑",
  }, superHeaders)
  assert.equal(unbindRes.status, 200, "解绑设备成功")

  // 6. 写入运维操作日志
  const logRes = await req("POST", "/api/collections/device_logs/records", {
    device: devId,
    type: "调拨与解绑",
    content: "设备已完成从小李至小张的调拨及最终回收解绑",
    status: "成功",
  }, superHeaders)
  assert.equal(logRes.status, 200, "记录设备日志成功")
})
