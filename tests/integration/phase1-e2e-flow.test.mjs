import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { startPbTestServer, bootstrapTestEnvironment } from "../helpers/pb-test-server.mjs"
import { handleRiskAnalysis } from "../../server/business-worker.mjs"

describe("一期轻量闭环 · 完整端到端贯通验收 (E2E Flows)", () => {
  let server
  let env

  before(async () => {
    server = await startPbTestServer()
    env = await bootstrapTestEnvironment(server)
  })

  after(async () => {
    if (server) await server.stop()
  })

  it("Flow 1: 销售合规全链路贯通闭环 (创建-录音-转写-规则分析-复核-推送-申诉驳回-整改退回-重提-确认关闭-报表审计)", async () => {
    // 1. 管理员登录已在 env.tokens.admin 就绪
    assert.ok(env.tokens.admin, "管理员登录 Token 有效")

    // 2. 创建区域、门店与员工
    const regRes = await server.req("POST", "/api/regions", {
      name: "华北大区",
      code: "R-HB",
      status: "ACTIVE",
    }, { Authorization: `Bearer ${env.tokens.admin}` })
    assert.equal(regRes.status, 200)
    const regId = regRes.data.id

    const storeRes = await server.req("POST", "/api/stores", {
      name: "北京海淀店",
      region: regId,
      address: "海淀区中关村大街1号",
      status: "ACTIVE",
    }, { Authorization: `Bearer ${env.tokens.admin}` })
    assert.equal(storeRes.status, 200)
    const storeId = storeRes.data.id

    const empRes = await server.req("POST", "/api/employees", {
      name: "王小明",
      phone: "13912345678",
      role: "店员",
      store: storeId,
      status: "在职",
    }, { Authorization: `Bearer ${env.tokens.admin}` })
    assert.equal(empRes.status, 200)
    const empId = empRes.data.id

    // 创建员工账号
    const empUserRes = await server.req("POST", "/api/yuqi/admin/users", {
      email: "wangxm@demo.local",
      password: "Passw0rd!",
      display_name: "王小明",
      role_code: "EMPLOYEE",
      employee: empId,
      assigned_store: storeId,
      mobile: "13912345678",
    }, { Authorization: `Bearer ${env.tokens.admin}` })
    assert.equal(empUserRes.status, 200)
    const empUserId = empUserRes.data.id

    // 3. 创建设备
    const devRes = await server.req("POST", "/api/devices", {
      device_no: "DEV-HD-001",
      type: "smart_badge",
      status: "ONLINE",
      power: 100,
    }, { Authorization: `Bearer ${env.tokens.admin}` })
    assert.equal(devRes.status, 200)
    const devId = devRes.data.id

    // 4. 员工知情同意 (录音制度确认)
    // 员工登录获取 Token
    const sendCode = await server.req("POST", "/api/yuqi/auth/employee/send-code", { mobile: "13912345678" })
    assert.equal(sendCode.status, 200)
    const empLogin = await server.req("POST", "/api/yuqi/auth/employee/login", {
      mobile: "13912345678",
      code: sendCode.data.code || "123456",
    })
    assert.equal(empLogin.status, 200)
    const empToken = empLogin.data.token

    const consentRes = await server.req("POST", "/api/yuqi/employee/consent", {
      policy_version: "v1.0",
      agreed: true,
    }, { Authorization: `Bearer ${empToken}` })
    assert.equal(consentRes.status, 200)

    // 5. 设备绑定申请与审批
    const bindReq = await server.req("POST", "/api/yuqi/device-bindings/request", {
      device_no: "DEV-HD-001",
    }, { Authorization: `Bearer ${empToken}` })
    assert.equal(bindReq.status, 200)
    const bindingId = bindReq.data.id

    const bindApprove = await server.req("POST", `/api/yuqi/device-bindings/${bindingId}/approve`, {
      action: "approve",
    }, { Authorization: `Bearer ${env.tokens.admin}` })
    assert.equal(bindApprove.status, 200)
    assert.equal(bindApprove.data.status, "ACTIVE")

    // 6. 音频登记与转写生成
    const audioRes = await server.req("POST", "/api/audio_files", {
      object_key: "oss/2026/08/25/dev-hd-001-001.mp3",
      file_name: "dev-hd-001-001.mp3",
      device_sn: "DEV-HD-001",
      status: "COMPLETED",
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    assert.equal(audioRes.status, 200)
    const audioId = audioRes.data.id

    const trRes = await server.req("POST", "/api/transcripts", {
      device: "DEV-HD-001",
      employee: empId,
      store: storeId,
      asr_status: "SUCCESS",
      full_text: "这个药吃了三天包好，不用去医院开处方直接吃就行",
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    assert.equal(trRes.status, 200)
    const trId = trRes.data.id

    // 7. 会话与分段落库
    const sessRes = await server.req("POST", "/api/sessions", {
      audio_file: audioId,
      transcript: trId,
      employee: empId,
      store: storeId,
      device_sn: "DEV-HD-001",
      status: "COMPLETED",
      transcript_version: 1,
      version: 1,
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    assert.equal(sessRes.status, 200)
    const sessId = sessRes.data.id

    await server.req("POST", "/api/transcript_segments", {
      session: sessId,
      transcript: trId,
      version: 1,
      sequence: 0,
      start_ms: 10000,
      end_ms: 15000,
      speaker: "S1",
      speaker_role: "staff",
      text: "这个阿莫西林是处方药，我直接拿给你不用处方，帮你刷医保就行",
      confidence: 0.95,
    }, { "X-Yuqi-Service-Token": env.serviceToken })

    // 8. 触发规则分析任务 (模拟 Worker 处理)
    process.env.YUQI_PB_URL = server.url
    process.env.YUQI_SERVICE_TOKEN = env.serviceToken

    const analysisRes = await handleRiskAnalysis({
      payload_json: { session_id: sessId, transcript_version: 1, analysis_version: 1 },
    })
    assert.ok(analysisRes.analyzed)
    assert.ok((analysisRes.issues || analysisRes.created_issues) >= 1, "应命中规则并生成疑似问题")

    // 9. 查询新生成的疑似问题
    const issuesList = await server.req("GET", `/api/issues?session=${sessId}`, null, {
      Authorization: `Bearer ${env.tokens.admin}`,
    })
    assert.equal(issuesList.status, 200)
    assert.ok(issuesList.data.items.length > 0)
    const issue = issuesList.data.items[0]
    assert.equal(issue.review_status, "PENDING")
    assert.equal(issue.employee_visibility, "HIDDEN")

    // 10. 合规人员复核通过并推送给员工
    const reviewRes = await server.req("POST", `/api/yuqi/issues/${issue.id}/review`, {
      action: "approve",
      comment: "确认存在无处方售药导向，合规复核通过",
    }, { Authorization: `Bearer ${env.tokens.compliance}` })
    assert.equal(reviewRes.status, 200)
    assert.equal(reviewRes.data.review_status, "APPROVED")

    const pushRes = await server.req("POST", `/api/yuqi/issues/${issue.id}/push`, {}, {
      Authorization: `Bearer ${env.tokens.compliance}`,
    })
    assert.equal(pushRes.status, 200)
    assert.equal(pushRes.data.employee_visibility, "VISIBLE")

    // 11. 员工端查看已推送问题
    const empIssues = await server.req("GET", "/api/yuqi/employee/issues", null, {
      Authorization: `Bearer ${empToken}`,
    })
    assert.equal(empIssues.status, 200)
    assert.ok(empIssues.data.items.some((x) => x.id === issue.id))

    const empIssueDetail = await server.req("GET", `/api/yuqi/employee/issues/${issue.id}`, null, {
      Authorization: `Bearer ${empToken}`,
    })
    assert.equal(empIssueDetail.status, 200)
    assert.ok(empIssueDetail.data.issue.title)

    // 12. 员工发起申诉
    const appealRes = await server.req("POST", "/api/yuqi/employee/appeals", {
      issue: issue.id,
      reason: "客户带了外院处方单照片，我按处方单发药的",
    }, { Authorization: `Bearer ${empToken}` })
    assert.equal(appealRes.status, 200)
    const appealId = appealRes.data.id

    // 13. 管理员/合规驳回申诉
    const rejectAppeal = await server.req("POST", `/api/yuqi/appeals/${appealId}/review`, {
      action: "reject",
      comment: "照片未留存合规审方记录，申诉不成立，需进行处方审方流程整改",
    }, { Authorization: `Bearer ${env.tokens.compliance}` })
    assert.equal(rejectAppeal.status, 200)

    // 14. 派发整改任务
    const rectRes = await server.req("POST", `/api/yuqi/issues/${issue.id}/rectifications`, {
      title: "处方药审方留存规范整改",
      requirements: "重新学习处方药发药审方留存标准流程",
      due_at: "2026-09-30T00:00:00Z",
    }, { Authorization: `Bearer ${env.tokens.admin}` })
    assert.equal(rectRes.status, 200)
    const rectId = rectRes.data.id

    // 15. 员工第一次提交整改
    await server.req("POST", `/api/yuqi/rectifications/${rectId}/submit`, {
      submission_text: "已阅读流程",
    }, { Authorization: `Bearer ${empToken}` })

    // 16. 店长/管理员退回整改
    const returnRect = await server.req("POST", `/api/yuqi/rectifications/${rectId}/revise`, {
      comment: "整改说明太简短，请详细说明后续审方操作规范",
    }, { Authorization: `Bearer ${env.tokens.admin}` })
    assert.equal(returnRect.status, 200)
    assert.equal(returnRect.data.status, "NEEDS_REVISION")

    // 17. 员工补充后重新提交整改
    const resubmitRect = await server.req("POST", `/api/yuqi/rectifications/${rectId}/submit`, {
      submission_text: "已完成《处方药合规销售与审方存根留档手册》专项复训，并经店长现场核对处方扫码留存流程",
    }, { Authorization: `Bearer ${empToken}` })
    assert.equal(resubmitRect.status, 200)
    assert.equal(resubmitRect.data.status, "SUBMITTED")

    // 18. 店长/管理员确认整改合格并关闭问题
    const confirmRect = await server.req("POST", `/api/yuqi/rectifications/${rectId}/confirm`, {
      comment: "考核合格，整改闭环，准予关闭",
    }, { Authorization: `Bearer ${env.tokens.admin}` })
    assert.equal(confirmRect.status, 200)
    assert.equal(confirmRect.data.status, "CONFIRMED")

    // 19. 验证问题状态已关闭
    const finalIssue = await server.req("GET", `/api/issues/${issue.id}`, null, {
      Authorization: `Bearer ${env.tokens.admin}`,
    })
    assert.equal(finalIssue.status, 200)
    assert.equal(finalIssue.data.close_status, "CLOSED")
    assert.equal(finalIssue.data.rectification_status, "CONFIRMED")

    // 20. 验证报表更新与导出
    const rpt = await server.req("GET", "/api/reports/overview", null, {
      Authorization: `Bearer ${env.tokens.admin}`,
    })
    assert.equal(rpt.status, 200)
    assert.ok(rpt.data.rectifications.confirmed >= 1)

    const exp = await server.req("GET", "/api/reports/export/issues", null, {
      Authorization: `Bearer ${env.tokens.admin}`,
    })
    assert.equal(exp.status, 200)
    assert.ok(exp.text.includes("系统识别结果仅为疑似风险，最终判断由授权管理人员完成"))
  })

  it("Flow 2: 申诉成立闭环 (疑似问题-复核推送-申诉成立-原始命中保留-有效问题扣减-误报统计更新)", async () => {
    // 1. 创建会话与分段
    const sessId = await server.req("POST", "/api/sessions", {
      store: env.stores.storeA,
      employee: env.employees.zhang,
      status: "COMPLETED",
      transcript_version: 1,
      version: 1,
    }, { "X-Yuqi-Service-Token": env.serviceToken }).then(r => r.data.id)

    // 2. 创建疑似问题 (EXAGGERATED_EFFICACY)
    const issRes = await server.req("POST", "/api/issues", {
      session: sessId,
      store: env.stores.storeA,
      employee: env.employees.zhang,
      rule_code: "EXAGGERATED_EFFICACY",
      title: "夸大疗效疑似问题",
      risk_level: "HIGH",
      analysis_status: "SUCCEEDED",
      review_status: "APPROVED",
      employee_visibility: "VISIBLE",
      pushed_to_employee: true,
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    const issueId = issRes.data.id

    // 3. 员工发起申诉
    const appealRes = await server.req("POST", "/api/yuqi/employee/appeals", {
      issue: issueId,
      reason: "当时是顾客原话描述'三天包好'，店员随后明确纠正应按疗程服用，并非店员夸大",
    }, { Authorization: `Bearer ${env.tokens.emp_zhang}` })
    assert.equal(appealRes.status, 200)
    const appealId = appealRes.data.id

    // 4. 合规人员申诉复核通过 (申诉成立)
    const reviewAppeal = await server.req("POST", `/api/yuqi/appeals/${appealId}/review`, {
      action: "approve",
      comment: "回听完整录音证实为顾客自述且店员已纠正，申诉成立，标记为误报并关闭",
    }, { Authorization: `Bearer ${env.tokens.compliance}` })
    assert.equal(reviewAppeal.status, 200)
    assert.equal(reviewAppeal.data.status, "APPROVED")

    // 5. 校验: 原始规则命中依然保留, is_false_positive 为 true, close_status 为 CLOSED
    const issueGet = await server.req("GET", `/api/issues/${issueId}`, null, {
      Authorization: `Bearer ${env.tokens.admin}`,
    })
    assert.equal(issueGet.status, 200)
    assert.equal(issueGet.data.rule_code, "EXAGGERATED_EFFICACY", "原始命中规则编码必须保留")
    assert.equal(issueGet.data.is_false_positive, true, "必须标记为误报")
    assert.equal(issueGet.data.appeal_status, "APPROVED")
    assert.equal(issueGet.data.close_status, "CLOSED")

    // 6. 校验报表统计
    const rpt = await server.req("GET", "/api/reports/overview", null, {
      Authorization: `Bearer ${env.tokens.admin}`,
    })
    assert.equal(rpt.status, 200)
    assert.ok(rpt.data.issues.false_positive >= 1, "误报统计数增加")
    assert.ok(rpt.data.appeals.approved >= 1, "申诉通过数增加")
    assert.ok(rpt.data.appeals.approval_rate > 0, "申诉通过率更新")
  })
})
