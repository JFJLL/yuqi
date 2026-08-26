import test from "node:test"
import assert from "node:assert/strict"
import { startPbTestServer } from "../helpers/pb-test-server.mjs"

test("Ticket 13: 系统参数、规则与知识库配置集成测试", async (t) => {
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

  // 2. 写入系统参数
  const settingRes = await req("POST", "/api/collections/app_settings/records", {
    key: "analysis_model",
    value: "qwen-plus",
  }, superHeaders)
  assert.equal(settingRes.status, 200, "保存系统参数成功")

  // 3. 更新规则状态
  const ruleRes = await req("POST", "/api/collections/compliance_rules/records", {
    name: "严禁推荐已下架或召回药品",
    risk: "高",
    description: "药品销售中发现下架或停售药品时立即拦截提醒",
    enabled: true,
  }, superHeaders)
  assert.equal(ruleRes.status, 200, "创建合规规则成功")
  const ruleId = ruleRes.data.id

  const updateRuleRes = await req("PATCH", "/api/collections/compliance_rules/records/" + ruleId, {
    enabled: false,
  }, superHeaders)
  assert.equal(updateRuleRes.status, 200)
  assert.equal(updateRuleRes.data.enabled, false, "规则状态成功更新为停用")
})
