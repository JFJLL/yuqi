import test from "node:test"
import assert from "node:assert/strict"
import { startPbTestServer } from "../helpers/pb-test-server.mjs"

test("Ticket 14: 操作审计、接口与同步日志集成测试", async (t) => {
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

  // 2. 写入操作审计日志
  const auditRes = await req("POST", "/api/collections/audit_logs/records", {
    actor_name: "超级管理员",
    actor_type: "user",
    action: "update_rule_status",
    target_type: "compliance_rules",
    target_id: "RULE-001",
    detail_json: { rule: "严禁推荐下架药品", enabled: false, operator: "admin" },
  }, superHeaders)
  assert.equal(auditRes.status, 200, "写入审计记录成功")
  const auditId = auditRes.data.id

  // 3. 写入接口同步日志
  const syncRes = await req("POST", "/api/collections/sync_logs/records", {
    type: "转写推送",
    object: "SESSION-REC-001",
    store: "上海中山路店",
    status: "成功",
    result: "已完成实时转写与分段同步",
    occurred_at: "2026-08-26 18:00:00",
  }, superHeaders)
  assert.equal(syncRes.status, 200, "写入同步日志成功")

  // 4. 检索审计记录
  const listRes = await req("GET", "/api/collections/audit_logs/records?filter=(target_id='RULE-001')", null, superHeaders)
  assert.equal(listRes.status, 200)
  assert.equal(listRes.data.items.length, 1)
  assert.equal(listRes.data.items[0].id, auditId)
})
