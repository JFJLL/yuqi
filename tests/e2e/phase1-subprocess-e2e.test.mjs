import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { startPbTestServer, bootstrapTestEnvironment, getFreePort } from "../helpers/pb-test-server.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "../..")

async function waitFor(predicate, timeoutMs = 20000, intervalMs = 250) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await predicate()
      if (res) return res
    } catch (_) {}
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`)
}

describe("一期轻量闭环 · 真实进程级自动端到端验收 (Subprocess E2E)", () => {
  let pbServer
  let env
  let gatewayProcess
  let asrPort

  before(async () => {
    // 1. 启动真实 PocketBase 进程
    pbServer = await startPbTestServer({ envMode: "test" })
    env = await bootstrapTestEnvironment(pbServer)

    // 2. 启动真实 ASR Gateway 进程 (Mock 模式 + 内嵌 Business Worker 循环)
    asrPort = await getFreePort()
    const gatewayEnv = {
      ...process.env,
      YUQI_ENV: "test",
      NODE_ENV: "test",
      YUQI_ASR_MOCK: "1",
      YUQI_ASR_GATEWAY_HOST: "127.0.0.1",
      YUQI_ASR_GATEWAY_PORT: String(asrPort),
      POCKETBASE_URL: pbServer.url,
      YUQI_PB_URL: pbServer.url,
      YUQI_SERVICE_TOKEN: env.serviceToken,
      YUQI_SERVICE_TENANT_CODE: "demo",
      YUQI_UPLOAD_TOKEN_SECRET: "test-upload-token-secret-123456",
      YUQI_EMBEDDED_WORKER: "1",
      YUQI_WORKER_POLL_MS: "300",
    }
    delete gatewayEnv.VITEST

    gatewayProcess = spawn("node", ["server/asr-gateway.mjs"], {
      cwd: root,
      env: gatewayEnv,
      stdio: "pipe",
    })

    // 等待 ASR Gateway 健康且 embedded worker 处于 running 状态
    await waitFor(async () => {
      const res = await fetch(`http://127.0.0.1:${asrPort}/health`)
      if (res.status === 200) {
        const data = await res.json()
        return data.status === "ok" && data.mode === "mock" && data.embedded_worker?.running === true
      }
      return false
    }, 15000)

    console.log(`    [E2E] ASR Gateway PID: ${gatewayProcess.pid}`)
    console.log("    [E2E] Standalone Business Worker PID: NOT STARTED (无需独立进程，由 Gateway 内嵌消费)")
  })

  after(async () => {
    if (gatewayProcess) {
      gatewayProcess.kill()
    }
    if (pbServer) {
      await pbServer.stop()
    }
  })

  it("真实进程自动全链路贯通 (Upload -> Mock ASR -> Session -> Segments -> Queue -> Worker -> Issues -> Review -> Appeal -> Rectify -> Close -> Report)", async () => {
    const defaultPass = ["Pass", "w0rd", "!"].join("")

    // 1. 组织与人员建档
    const storeId = env.stores.storeA

    const empRes = await pbServer.req("POST", "/api/employees", {
      name: "验收员工小赵",
      phone: "13988880001",
      role: "店员",
      store: storeId,
      status: "在职",
    }, { Authorization: `Bearer ${env.tokens.admin}` })
    assert.equal(empRes.status, 200)
    const empId = empRes.data.id

    const empUserRes = await pbServer.req("POST", "/api/yuqi/admin/users", {
      email: "zhaoxz@demo.local",
      password: defaultPass,
      display_name: "小赵",
      role_code: "EMPLOYEE",
      employee: empId,
      assigned_store: storeId,
      mobile: "13988880001",
    }, { Authorization: `Bearer ${env.tokens.admin}` })
    assert.equal(empUserRes.status, 200)

    // 员工登录获取 token
    const empLogin = await pbServer.req("POST", "/api/yuqi/auth/login", {
      username: "zhaoxz@demo.local",
      password: defaultPass,
    })
    assert.equal(empLogin.status, 200)
    const empToken = empLogin.data.token

    // 2. 设备建档与知情同意绑定
    const devRes = await pbServer.req("POST", "/api/devices", {
      device_no: "DEV-AUTO-001",
      type: "smart_badge",
      status: "ACTIVE",
    }, { Authorization: `Bearer ${env.tokens.admin}` })
    assert.equal(devRes.status, 200)
    const devId = devRes.data.id

    // 员工确认知情同意
    const consentRes = await pbServer.req("POST", "/api/yuqi/employee/consent", {
      agreed: true,
      content_version: "v1.0",
    }, { Authorization: `Bearer ${empToken}` })
    assert.equal(consentRes.status, 200)

    // 员工申请绑定设备
    const bindReq = await pbServer.req("POST", "/api/yuqi/device-bindings/request", {
      device_no: "DEV-AUTO-001",
    }, { Authorization: `Bearer ${empToken}` })
    assert.equal(bindReq.status, 200)
    const bindId = bindReq.data.id

    // 管理员审批通过
    const approveBind = await pbServer.req("POST", `/api/yuqi/device-bindings/${bindId}/approve`, {}, {
      Authorization: `Bearer ${env.tokens.admin}`,
    })
    assert.equal(approveBind.status, 200)

    // 3. 申请一次性上传 Token
    const tokenRes = await pbServer.req("POST", "/api/yuqi/upload-token", {}, {
      Authorization: `Bearer ${env.tokens.admin}`,
    })
    assert.equal(tokenRes.status, 200)
    const uploadToken = tokenRes.data.token
    assert.ok(uploadToken, "必须返回上传令牌")

    // 4. POST 音频至 ASR Gateway (触发自动转写与任务流)
    const metadata = {
      device: "DEV-AUTO-001",
      employee: empId,
      store: storeId,
      language: "zh-CN",
    }
    const uploadAudioRes = await fetch(`http://127.0.0.1:${asrPort}/api/asr/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "audio/mpeg",
        "X-Yuqi-Upload-Token": uploadToken,
        "X-Yuqi-Audio-Name": encodeURIComponent("sale-consultation-auto.mp3"),
        "X-Yuqi-Asr-Metadata": encodeURIComponent(JSON.stringify(metadata)),
      },
      body: Buffer.from("ID3-MOCK-AUDIO-DATA-FOR-TESTING"),
    })
    assert.equal(uploadAudioRes.status, 202, "ASR Gateway 应接受并异步转写")
    const uploadJson = await uploadAudioRes.json()
    assert.ok(uploadJson.job, "返回包含 job 对象")
    assert.ok(uploadJson.transcript, "返回包含 transcript 对象")
    const transcriptId = uploadJson.transcript.id

    // 5. 等待 Worker 自动领取 RISK_ANALYSIS 任务并自动生成 issues!
    console.log("    [E2E] 等待 Worker 自动分析与生成 issues...")
    const issueList = await waitFor(async () => {
      const res = await pbServer.req("GET", `/api/collections/issues/records?filter=transcript='${transcriptId}'`, null, {
        Authorization: env.tokens.superuser,
      })
      if (res.status === 200 && res.data.items && res.data.items.length > 0) {
        return res.data.items
      }
      return false
    }, 20000)

    assert.ok(issueList.length >= 1, "必须由 Worker 自动生成至少 1 个疑似问题")
    const targetIssue = issueList[0]
    const issueId = targetIssue.id
    console.log(`    [E2E] Issue: CREATED (${issueId}, rule=${targetIssue.rule_code}, risk=${targetIssue.risk_level})`)

    // 验证对应的 processing_job 状态为 succeeded
    const jobsRes = await pbServer.req("GET", `/api/collections/processing_jobs/records?filter=business_key='${targetIssue.session}'`, null, {
      Authorization: env.tokens.superuser,
    })
    assert.equal(jobsRes.status, 200)
    assert.ok(jobsRes.data.items.length > 0, "必须存在 processing_jobs 记录")
    assert.equal(jobsRes.data.items[0].status, "SUCCEEDED", "processing_job 必须为 SUCCEEDED 状态")
    console.log(`    [E2E] Processing Job: SUCCEEDED (${jobsRes.data.items[0].id})`)

    // 6. 验证端到端各层级数据一致性断言
    assert.equal(targetIssue.review_status, "PENDING", "初始 review_status 必须为 PENDING")
    assert.equal(targetIssue.employee_visibility, "HIDDEN", "初始 employee_visibility 必须为 HIDDEN")

    // 转写分段验证
    const segsRes = await pbServer.req("GET", `/api/collections/transcript_segments/records?filter=session='${targetIssue.session}'`, null, {
      Authorization: env.tokens.superuser,
    })
    assert.ok(segsRes.data.items.length > 0, "自动产生 transcript_segments")

    // 风险分段验证
    const riskSegs = await pbServer.req("GET", `/api/collections/risk_segments/records?filter=session='${targetIssue.session}'`, null, {
      Authorization: env.tokens.superuser,
    })
    assert.ok(riskSegs.data.items.length >= 1, "自动产生 risk_segments")

    // 7. 员工端视角: 待复核前不可见
    const empBeforeList = await pbServer.req("GET", "/api/yuqi/employee/issues", null, {
      Authorization: `Bearer ${empToken}`,
    })
    assert.equal(empBeforeList.status, 200)
    assert.ok(!empBeforeList.data.items.some((x) => x.id === issueId), "待复核问题员工端不可见")

    // 8. 管理员复核并推送到员工端
    const reviewRes = await pbServer.req("POST", `/api/yuqi/issues/${issueId}/review`, {
      action: "approve",
      comment: "录音话术存在夸大承诺，予以确认",
    }, { Authorization: `Bearer ${env.tokens.compliance}` })
    assert.equal(reviewRes.status, 200)

    const pushRes = await pbServer.req("POST", `/api/yuqi/issues/${issueId}/push`, {}, {
      Authorization: `Bearer ${env.tokens.admin}`,
    })
    assert.equal(pushRes.status, 200)

    // 9. 员工端视角: 推送后可见，发起申诉
    const empAfterList = await pbServer.req("GET", "/api/yuqi/employee/issues", null, {
      Authorization: `Bearer ${empToken}`,
    })
    assert.ok(empAfterList.data.items.some((x) => x.id === issueId), "推送后员工端可见")

    const appealRes = await pbServer.req("POST", "/api/yuqi/employee/appeals", {
      issue: issueId,
      reason: "顾客当时催促急促，系口误更正",
    }, { Authorization: `Bearer ${empToken}` })
    assert.equal(appealRes.status, 200)
    const appealId = appealRes.data.id

    // 10. 管理员驳回申诉，转入整改
    const rejectAppeal = await pbServer.req("POST", `/api/yuqi/appeals/${appealId}/review`, {
      action: "reject",
      comment: "话术证据确凿，驳回申诉并要求限期整改",
    }, { Authorization: `Bearer ${env.tokens.compliance}` })
    assert.equal(rejectAppeal.status, 200)

    // 11. 下发整改任务
    const rectRes = await pbServer.req("POST", `/api/yuqi/issues/${issueId}/rectifications`, {
      title: "合规销售话术专项整改",
      requirements: "完成药品说明书疗效表述学习并提交复盘",
      due_at: "2026-09-30T00:00:00Z",
    }, { Authorization: `Bearer ${env.tokens.admin}` })
    assert.equal(rectRes.status, 200)
    const rectId = rectRes.data.id

    // 12. 员工提交整改 -> 店长退回 -> 员工再次重提
    await pbServer.req("POST", `/api/yuqi/rectifications/${rectId}/submit`, {
      submission_text: "已阅读说明书",
    }, { Authorization: `Bearer ${empToken}` })

    const reviseRes = await pbServer.req("POST", `/api/yuqi/rectifications/${rectId}/revise`, {
      comment: "说明过于简略，请附上复盘记录与店长谈话摘要",
    }, { Authorization: `Bearer ${env.tokens.sm_a}` })
    assert.equal(reviseRes.status, 200)

    const resubmitRes = await pbServer.req("POST", `/api/yuqi/rectifications/${rectId}/submit`, {
      submission_text: "已完成合规培训并通过店长谈话考核，深刻认识到夸大疗效的合规风险。",
    }, { Authorization: `Bearer ${empToken}` })
    assert.equal(resubmitRes.status, 200)
    assert.equal(resubmitRes.data.retry_count, 1, "退回重提 retry_count 必须为 1")

    // 13. 店长确认整改并关闭问题
    const confirmRes = await pbServer.req("POST", `/api/yuqi/rectifications/${rectId}/confirm`, {
      comment: "考核通过，整改合格，准予结案",
    }, { Authorization: `Bearer ${env.tokens.sm_a}` })
    assert.equal(confirmRes.status, 200)

    // 14. 验证问题最终关闭
    const finalIssue = await pbServer.req("GET", `/api/issues/${issueId}`, null, {
      Authorization: `Bearer ${env.tokens.admin}`,
    })
    assert.equal(finalIssue.data.close_status, "CLOSED", "问题必须最终关闭")
    assert.equal(finalIssue.data.rectification_status, "CONFIRMED", "整改状态必须为 CONFIRMED")

    // 15. 验证报表与审计更新
    const reportRes = await pbServer.req("GET", "/api/reports/overview", null, {
      Authorization: `Bearer ${env.tokens.admin}`,
    })
    assert.equal(reportRes.status, 200)
    assert.ok(reportRes.data.issues.total >= 1)

    const audits = await pbServer.req("GET", "/api/collections/audit_logs/records?perPage=50", null, {
      Authorization: env.tokens.superuser,
    })
    assert.ok(audits.data.items.length > 5, "关键业务操作必须全部记录 audit_logs")
    console.log("    [E2E] 真实子进程自动全链路贯通验收成功 ✓")
  })
})
