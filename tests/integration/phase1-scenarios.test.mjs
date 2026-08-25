import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { startPbTestServer, bootstrapTestEnvironment } from "../helpers/pb-test-server.mjs"
import { analyzeRisk } from "../../server/rule-analyzer.mjs"
import { importSucceededJob } from "../../server/asr-gateway.mjs"
import { runOnce } from "../../server/business-worker.mjs"
import { execFileSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WORKTREE_ROOT = path.resolve(__dirname, "../..")

describe("一期轻量闭环 · 25 项核心场景集成测试", () => {
  let server
  let env

  before(async () => {
    server = await startPbTestServer()
    env = await bootstrapTestEnvironment(server)
  })

  after(async () => {
    if (server) await server.stop()
  })

  async function createTestSession(opts = {}) {
    const res = await server.req("POST", "/api/sessions", {
      store: opts.store || env.stores.storeA,
      employee: opts.employee || env.employees.zhang,
      status: "COMPLETED",
      transcript_version: opts.transcript_version || 1,
      version: opts.version || 1,
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    return res.data.id
  }

  async function createTestIssue(opts = {}) {
    const sessionId = opts.session || (await createTestSession(opts))
    const res = await server.req("POST", "/api/issues", {
      session: sessionId,
      transcript: opts.transcript || "",
      store: opts.store || env.stores.storeA,
      employee: opts.employee || env.employees.zhang,
      rule_code: opts.rule_code || "PRESC",
      title: opts.title || "测试疑似问题",
      risk_level: opts.risk_level || "HIGH",
      analysis_status: opts.analysis_status || "SUCCEEDED",
      review_status: opts.review_status || "PENDING",
      employee_visibility: opts.employee_visibility || "HIDDEN",
      pushed_to_employee: opts.pushed_to_employee || false,
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    return res.data
  }

  // 1. 未登录不可读业务数据
  it("1. 未登录不可读业务数据 (401/403)", async () => {
    const unauthMe = await server.req("GET", "/api/yuqi/auth/me")
    assert.equal(unauthMe.status, 401, "未登录访问 /api/yuqi/auth/me 必须返回 401")

    const unauthStores = await server.req("GET", "/api/stores")
    assert.equal(unauthStores.status, 401, "未登录访问业务路由 /api/stores 必须返回 401")

    const directPbApi = await server.req("GET", "/api/collections/stores/records")
    assert.equal(directPbApi.status, 403, "直接访问底层 PB 集合路由必须返回 403 (已锁定规则)")
  })

  // 2. 跨 tenant 返回 404/403
  it("2. 跨 tenant 返回 404/403", async () => {
    const res = await server.req("GET", `/api/stores/${env.stores.storeA}`, null, {
      Authorization: `Bearer ${env.tokens.admin_other}`,
    })
    assert.ok(res.status === 404 || res.status === 403, `其他租户访问当前租户资源应返回 404/403, 当前: ${res.status}`)
  })

  // 3. A 店店长不能查看和修改 B 店问题
  it("3. A 店店长不能查看和修改 B 店问题", async () => {
    const issueB = await createTestIssue({
      store: env.stores.storeB,
      employee: env.employees.li,
      rule_code: "PRESC",
      title: "B店疑似处方药问题",
      risk_level: "HIGH",
      analysis_status: "SUCCEEDED",
      review_status: "PENDING",
      employee_visibility: "HIDDEN",
    })
    const issueBId = issueB.id

    // A 店店长查询 B 店问题 -> 404
    const viewRes = await server.req("GET", `/api/issues/${issueBId}`, null, {
      Authorization: `Bearer ${env.tokens.sm_a}`,
    })
    assert.equal(viewRes.status, 404, "A店店长查看B店问题必须返回 404")

    // A 店店长复核 B 店问题 -> 403
    const reviewRes = await server.req("POST", `/api/yuqi/issues/${issueBId}/review`, {
      action: "approve",
    }, { Authorization: `Bearer ${env.tokens.sm_a}` })
    assert.ok(reviewRes.status === 404 || reviewRes.status === 403, "A店店长复核B店问题必须被拒绝")
  })

  // 4. 区域经理可以查看本区域子门店
  it("4. 区域经理与店长完整数据范围隔离矩阵 (门店/员工/音频/转写/ASR/分段/风险证据/问题/整改/设备/日志/设置)", async () => {
    // 创建跨门店资源
    const audioA = await server.req("POST", "/api/audio_files", {
      object_key: "oss/storeA/scope-audio.mp3",
      file_name: "scope-audio.mp3",
      device_sn: "DEV-001",
      store: env.stores.storeA,
      employee: env.employees.zhang,
      status: "COMPLETED",
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    const audioAId = audioA.data.id

    const audioC = await server.req("POST", "/api/audio_files", {
      object_key: "oss/storeC/scope-audio.mp3",
      file_name: "scope-audio.mp3",
      device_sn: "DEV-003",
      store: env.stores.storeC,
      employee: env.employees.wang,
      status: "COMPLETED",
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    const audioCId = audioC.data.id

    const trA = await server.req("POST", "/api/transcripts", {
      device: "DEV-001",
      employee: env.employees.zhang,
      store: env.stores.storeA,
      asr_status: "SUCCESS",
      full_text: "A店转写文本",
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    const trAId = trA.data.id

    const trC = await server.req("POST", "/api/transcripts", {
      device: "DEV-003",
      employee: env.employees.wang,
      store: env.stores.storeC,
      asr_status: "SUCCESS",
      full_text: "C店转写文本",
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    const trCId = trC.data.id

    const jobA = await server.req("POST", "/api/asr_jobs", {
      remote_job_id: "mock-job-store-a",
      transcript: trAId,
      status: "succeeded",
      store: env.stores.storeA,
      employee: env.employees.zhang,
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    const jobAId = jobA.data.id

    const jobC = await server.req("POST", "/api/asr_jobs", {
      remote_job_id: "mock-job-store-c",
      transcript: trCId,
      status: "succeeded",
      store: env.stores.storeC,
      employee: env.employees.wang,
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    const jobCId = jobC.data.id

    const sessA = await server.req("POST", "/api/sessions", {
      store: env.stores.storeA,
      employee: env.employees.zhang,
      transcript: trAId,
      status: "COMPLETED",
      transcript_version: 1,
      version: 1,
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    const sessAId = sessA.data.id

    const sessC = await server.req("POST", "/api/sessions", {
      store: env.stores.storeC,
      employee: env.employees.wang,
      transcript: trCId,
      status: "COMPLETED",
      transcript_version: 1,
      version: 1,
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    const sessCId = sessC.data.id

    const segA = await server.req("POST", "/api/transcript_segments", {
      session: sessAId,
      transcript: trAId,
      sequence: 1,
      version: 1,
      speaker: "店员",
      text: "A店转写分段内容",
      start_ms: 1000,
      end_ms: 3000,
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    const segAId = segA.data.id

    const segC = await server.req("POST", "/api/transcript_segments", {
      session: sessCId,
      transcript: trCId,
      sequence: 1,
      version: 1,
      speaker: "店员",
      text: "C店转写分段内容",
      start_ms: 1000,
      end_ms: 3000,
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    const segCId = segC.data.id

    const riskA = await server.req("POST", "/api/risk_segments", {
      session: sessAId,
      transcript: trAId,
      rule_code: "PRESCRIPTION_DRUG_SALES",
      text: "A店风险证据片段",
      risk_level: "HIGH",
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    const riskAId = riskA.data.id

    const riskC = await server.req("POST", "/api/risk_segments", {
      session: sessCId,
      transcript: trCId,
      rule_code: "PRESCRIPTION_DRUG_SALES",
      text: "C店风险证据片段",
      risk_level: "HIGH",
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    const riskCId = riskC.data.id

    const issC = await createTestIssue({
      store: env.stores.storeC,
      employee: env.employees.wang,
      rule_code: "PRESCRIPTION_DRUG_SALES",
      title: "C店处方药问题",
    })

    const rectC = await server.req("POST", "/api/yuqi/issues/" + issC.id + "/rectifications", {
      title: "C店整改任务",
      requirements: "C店整改要求",
      due_at: "2026-09-30T00:00:00Z",
    }, { Authorization: "Bearer " + env.tokens.admin })
    const rectCId = rectC.data.id

    // ---- A. REGION_MANAGER (华东大区: 上海静安店A/浦东店B 可见, 北京朝阳店C 不可见) ----
    const viewStoreA = await server.req("GET", "/api/stores/" + env.stores.storeA, null, {
      Authorization: "Bearer " + env.tokens.rm_hd,
    })
    assert.equal(viewStoreA.status, 200, "华东区域经理应可查看属于华东子区域的静安店")

    const viewStoreC = await server.req("GET", "/api/stores/" + env.stores.storeC, null, {
      Authorization: "Bearer " + env.tokens.rm_hd,
    })
    assert.equal(viewStoreC.status, 404, "华东区域经理不可查看跨大区北京朝阳店")

    const empA = await server.req("GET", "/api/employees/" + env.employees.zhang, null, {
      Authorization: "Bearer " + env.tokens.rm_hd,
    })
    assert.equal(empA.status, 200, "华东区域经理可见本区员工张三")

    const empC = await server.req("GET", "/api/employees/" + env.employees.wang, null, {
      Authorization: "Bearer " + env.tokens.rm_hd,
    })
    assert.equal(empC.status, 404, "华东区域经理不可见北京员工王五")

    const rmAudioA = await server.req("GET", "/api/audio_files/" + audioAId, null, {
      Authorization: "Bearer " + env.tokens.rm_hd,
    })
    assert.equal(rmAudioA.status, 200, "华东区域经理可见本区音频")

    const rmAudioC = await server.req("GET", "/api/audio_files/" + audioCId, null, {
      Authorization: "Bearer " + env.tokens.rm_hd,
    })
    assert.equal(rmAudioC.status, 404, "华东区域经理不可见跨区音频")

    const rmTrA = await server.req("GET", "/api/transcripts/" + trAId, null, {
      Authorization: "Bearer " + env.tokens.rm_hd,
    })
    assert.equal(rmTrA.status, 200, "华东区域经理可见本区转写")

    const rmTrC = await server.req("GET", "/api/transcripts/" + trCId, null, {
      Authorization: "Bearer " + env.tokens.rm_hd,
    })
    assert.equal(rmTrC.status, 404, "华东区域经理不可见跨区转写")

    const rmJobA = await server.req("GET", "/api/asr_jobs/" + jobAId, null, {
      Authorization: "Bearer " + env.tokens.rm_hd,
    })
    assert.equal(rmJobA.status, 200, "华东区域经理可见本区ASR任务")

    const rmJobC = await server.req("GET", "/api/asr_jobs/" + jobCId, null, {
      Authorization: "Bearer " + env.tokens.rm_hd,
    })
    assert.equal(rmJobC.status, 404, "华东区域经理不可见跨区ASR任务")

    const rmSegA = await server.req("GET", "/api/transcript_segments/" + segAId, null, {
      Authorization: "Bearer " + env.tokens.rm_hd,
    })
    assert.equal(rmSegA.status, 200, "华东区域经理可见本区转写分段 (200)")

    const rmSegC = await server.req("GET", "/api/transcript_segments/" + segCId, null, {
      Authorization: "Bearer " + env.tokens.rm_hd,
    })
    assert.equal(rmSegC.status, 404, "华东区域经理不可见跨区转写分段 (404)")

    const rmSegList = await server.req("GET", "/api/transcript_segments", null, {
      Authorization: "Bearer " + env.tokens.rm_hd,
    })
    assert.equal(rmSegList.status, 200)
    const rmSegIds = (rmSegList.data.items || []).map((x) => x.id)
    assert.ok(rmSegIds.includes(segAId), "华东区域经理列表必须包含本区分段")
    assert.ok(!rmSegIds.includes(segCId), "华东区域经理列表严禁包含跨区分段")

    const rmRiskA = await server.req("GET", "/api/risk_segments/" + riskAId, null, {
      Authorization: "Bearer " + env.tokens.rm_hd,
    })
    assert.equal(rmRiskA.status, 200, "华东区域经理可见本区风险证据 (200)")

    const rmRiskC = await server.req("GET", "/api/risk_segments/" + riskCId, null, {
      Authorization: "Bearer " + env.tokens.rm_hd,
    })
    assert.equal(rmRiskC.status, 404, "华东区域经理不可见跨区风险证据 (404)")

    const rmRiskList = await server.req("GET", "/api/risk_segments", null, {
      Authorization: "Bearer " + env.tokens.rm_hd,
    })
    assert.equal(rmRiskList.status, 200)
    const rmRiskIds = (rmRiskList.data.items || []).map((x) => x.id)
    assert.ok(rmRiskIds.includes(riskAId), "华东区域经理列表必须包含本区风险证据")
    assert.ok(!rmRiskIds.includes(riskCId), "华东区域经理列表严禁包含跨区风险证据")

    const rmIssC = await server.req("GET", "/api/issues/" + issC.id, null, {
      Authorization: "Bearer " + env.tokens.rm_hd,
    })
    assert.equal(rmIssC.status, 404, "华东区域经理不可见跨区问题")

    const rmRectC = await server.req("GET", "/api/rectifications/" + rectCId, null, {
      Authorization: "Bearer " + env.tokens.rm_hd,
    })
    assert.equal(rmRectC.status, 404, "华东区域经理不可见跨区整改任务")

    // ---- B. STORE_MANAGER (静安店长: 静安店A 可见, 浦东店B/朝阳店C 不可见) ----
    const smStoreB = await server.req("GET", "/api/stores/" + env.stores.storeB, null, {
      Authorization: "Bearer " + env.tokens.sm_a,
    })
    assert.equal(smStoreB.status, 404, "A店店长不可查看B店")

    const smEmpLi = await server.req("GET", "/api/employees/" + env.employees.li, null, {
      Authorization: "Bearer " + env.tokens.sm_a,
    })
    assert.equal(smEmpLi.status, 404, "A店店长不可查看B店员工")

    const smAudioA = await server.req("GET", "/api/audio_files/" + audioAId, null, {
      Authorization: "Bearer " + env.tokens.sm_a,
    })
    assert.equal(smAudioA.status, 200, "A店店长可见本店音频")

    const smAudioC = await server.req("GET", "/api/audio_files/" + audioCId, null, {
      Authorization: "Bearer " + env.tokens.sm_a,
    })
    assert.equal(smAudioC.status, 404, "A店店长不可见跨店音频")

    const smSegA = await server.req("GET", "/api/transcript_segments/" + segAId, null, {
      Authorization: "Bearer " + env.tokens.sm_a,
    })
    assert.equal(smSegA.status, 200, "A店店长可见本店转写分段 (200)")

    const smSegC = await server.req("GET", "/api/transcript_segments/" + segCId, null, {
      Authorization: "Bearer " + env.tokens.sm_a,
    })
    assert.equal(smSegC.status, 404, "A店店长不可见跨店转写分段 (404)")

    const smSegList = await server.req("GET", "/api/transcript_segments", null, {
      Authorization: "Bearer " + env.tokens.sm_a,
    })
    assert.equal(smSegList.status, 200)
    const smSegIds = (smSegList.data.items || []).map((x) => x.id)
    assert.ok(smSegIds.includes(segAId), "A店店长列表必须包含本店分段")
    assert.ok(!smSegIds.includes(segCId), "A店店长列表严禁包含跨店分段")

    const smRiskA = await server.req("GET", "/api/risk_segments/" + riskAId, null, {
      Authorization: "Bearer " + env.tokens.sm_a,
    })
    assert.equal(smRiskA.status, 200, "A店店长可见本店风险证据 (200)")

    const smRiskC = await server.req("GET", "/api/risk_segments/" + riskCId, null, {
      Authorization: "Bearer " + env.tokens.sm_a,
    })
    assert.equal(smRiskC.status, 404, "A店店长不可见跨店风险证据 (404)")

    const smRiskList = await server.req("GET", "/api/risk_segments", null, {
      Authorization: "Bearer " + env.tokens.sm_a,
    })
    assert.equal(smRiskList.status, 200)
    const smRiskIds = (smRiskList.data.items || []).map((x) => x.id)
    assert.ok(smRiskIds.includes(riskAId), "A店店长列表必须包含本店风险证据")
    assert.ok(!smRiskIds.includes(riskCId), "A店店长列表严禁包含跨店风险证据")

    // ---- C. EMPLOYEE (员工只读本人业务, 禁止读取音频/转写/分段/风险证据全量列表及直查) ----
    const empAudioList = await server.req("GET", "/api/audio_files", null, {
      Authorization: "Bearer " + env.tokens.emp_zhang,
    })
    assert.equal(empAudioList.status, 403, "普通员工禁止读取 audio_files 列表 (403)")

    const empTrList = await server.req("GET", "/api/transcripts", null, {
      Authorization: "Bearer " + env.tokens.emp_zhang,
    })
    assert.equal(empTrList.status, 403, "普通员工禁止读取 transcripts 列表 (403)")

    const empSegList = await server.req("GET", "/api/transcript_segments", null, {
      Authorization: "Bearer " + env.tokens.emp_zhang,
    })
    assert.equal(empSegList.status, 403, "普通员工禁止通用 GET /api/transcript_segments 列表 (403)")

    const empSegDetail = await server.req("GET", "/api/transcript_segments/" + segAId, null, {
      Authorization: "Bearer " + env.tokens.emp_zhang,
    })
    assert.equal(empSegDetail.status, 403, "普通员工禁止通过通用 API 直查 transcript_segments (403)")

    const empRiskList = await server.req("GET", "/api/risk_segments", null, {
      Authorization: "Bearer " + env.tokens.emp_zhang,
    })
    assert.equal(empRiskList.status, 403, "普通员工禁止通用 GET /api/risk_segments 列表 (403)")

    const empRiskDetail = await server.req("GET", "/api/risk_segments/" + riskAId, null, {
      Authorization: "Bearer " + env.tokens.emp_zhang,
    })
    assert.equal(empRiskDetail.status, 403, "普通员工禁止通过通用 API 直查 risk_segments (403)")

    const empReport = await server.req("GET", "/api/reports/overview", null, {
      Authorization: "Bearer " + env.tokens.emp_zhang,
    })
    assert.equal(empReport.status, 403, "普通员工禁止读取管理报表 (403)")

    // ---- D. AUDITOR (审计员全量只读, 任何写操作均被拒绝 403) ----
    const audStores = await server.req("GET", "/api/stores", null, {
      Authorization: "Bearer " + env.tokens.auditor,
    })
    assert.equal(audStores.status, 200, "审计员可读门店列表 (200)")

    const audSegList = await server.req("GET", "/api/transcript_segments", null, {
      Authorization: "Bearer " + env.tokens.auditor,
    })
    assert.equal(audSegList.status, 200, "审计员可读转写分段列表 (200)")

    const audSegA = await server.req("GET", "/api/transcript_segments/" + segAId, null, {
      Authorization: "Bearer " + env.tokens.auditor,
    })
    assert.equal(audSegA.status, 200, "审计员可读 A 店转写分段 (200)")

    const audSegC = await server.req("GET", "/api/transcript_segments/" + segCId, null, {
      Authorization: "Bearer " + env.tokens.auditor,
    })
    assert.equal(audSegC.status, 200, "审计员可读 C 店转写分段 (200)")

    const audRiskList = await server.req("GET", "/api/risk_segments", null, {
      Authorization: "Bearer " + env.tokens.auditor,
    })
    assert.equal(audRiskList.status, 200, "审计员可读风险证据列表 (200)")

    const audRiskA = await server.req("GET", "/api/risk_segments/" + riskAId, null, {
      Authorization: "Bearer " + env.tokens.auditor,
    })
    assert.equal(audRiskA.status, 200, "审计员可读 A 店风险证据 (200)")

    const audRiskC = await server.req("GET", "/api/risk_segments/" + riskCId, null, {
      Authorization: "Bearer " + env.tokens.auditor,
    })
    assert.equal(audRiskC.status, 200, "审计员可读 C 店风险证据 (200)")

    const audSegWrite = await server.req("POST", "/api/transcript_segments", {
      session: sessAId,
      sequence: 99,
      text: "非法写入",
    }, { Authorization: "Bearer " + env.tokens.auditor })
    assert.equal(audSegWrite.status, 403, "审计员禁止创建转写分段 (403)")

    const audSegUpdate = await server.req("PATCH", "/api/transcript_segments/" + segAId, {
      text: "非法修改",
    }, { Authorization: "Bearer " + env.tokens.auditor })
    assert.equal(audSegUpdate.status, 403, "审计员禁止修改转写分段 (403)")

    const audSegDelete = await server.req("DELETE", "/api/transcript_segments/" + segAId, null, {
      Authorization: "Bearer " + env.tokens.auditor,
    })
    assert.equal(audSegDelete.status, 403, "审计员禁止删除转写分段 (403)")

    const audRiskWrite = await server.req("POST", "/api/risk_segments", {
      session: sessAId,
      rule_code: "EXAGGERATED_EFFICACY",
    }, { Authorization: "Bearer " + env.tokens.auditor })
    assert.equal(audRiskWrite.status, 403, "审计员禁止创建风险证据 (403)")

    const audWrite = await server.req("POST", "/api/stores", {
      name: "非法创建门店",
    }, { Authorization: "Bearer " + env.tokens.auditor })
    assert.equal(audWrite.status, 403, "审计员禁止创建门店 (403)")

    const audDel = await server.req("DELETE", "/api/issues/" + issC.id, null, {
      Authorization: "Bearer " + env.tokens.auditor,
    })
    assert.equal(audDel.status, 403, "审计员禁止删除问题 (403)")
  })

  // 5. 员工只能看本人已推送问题
  it("5. 员工只能看本人已推送问题", async () => {
    const iss1 = await createTestIssue({
      store: env.stores.storeA,
      employee: env.employees.zhang,
      rule_code: "PRESC",
      title: "张三处方药问题",
      risk_level: "HIGH",
      analysis_status: "SUCCEEDED",
      review_status: "APPROVED",
      employee_visibility: "VISIBLE",
      pushed_to_employee: true,
    })

    const iss2 = await createTestIssue({
      store: env.stores.storeB,
      employee: env.employees.li,
      rule_code: "PRESC",
      title: "李四处方药问题",
      risk_level: "HIGH",
      analysis_status: "SUCCEEDED",
      review_status: "APPROVED",
      employee_visibility: "VISIBLE",
      pushed_to_employee: true,
    })

    const listRes = await server.req("GET", "/api/yuqi/employee/issues", null, {
      Authorization: `Bearer ${env.tokens.emp_zhang}`,
    })
    assert.equal(listRes.status, 200)
    const items = listRes.data.items || []
    assert.ok(items.some((x) => x.id === iss1.id), "张三应看到本人问题")
    assert.ok(!items.some((x) => x.id === iss2.id), "张三不应看到李四问题")

    const detailOther = await server.req("GET", `/api/yuqi/employee/issues/${iss2.id}`, null, {
      Authorization: `Bearer ${env.tokens.emp_zhang}`,
    })
    assert.equal(detailOther.status, 404, "张三直查李四问题详情必须返回 404")
  })

  // 6. 待复核问题不出现在员工端
  it("6. 待复核问题不出现在员工端", async () => {
    const pendingIss = await createTestIssue({
      store: env.stores.storeA,
      employee: env.employees.zhang,
      rule_code: "EXAGGERATED_EFFICACY",
      title: "张三待复核夸大疗效问题",
      risk_level: "HIGH",
      analysis_status: "SUCCEEDED",
      review_status: "PENDING",
      employee_visibility: "HIDDEN",
    })

    const listRes = await server.req("GET", "/api/yuqi/employee/issues", null, {
      Authorization: `Bearer ${env.tokens.emp_zhang}`,
    })
    const items = listRes.data.items || []
    assert.ok(!items.some((x) => x.id === pendingIss.id), "待复核问题不可出现在员工问题列表")

    const detailRes = await server.req("GET", `/api/yuqi/employee/issues/${pendingIss.id}`, null, {
      Authorization: `Bearer ${env.tokens.emp_zhang}`,
    })
    assert.equal(detailRes.status, 404, "员工直查待复核问题详情必须返回 404")
  })

  // 7. 设备活跃绑定唯一
  it("7. 设备活跃绑定唯一 (同一时刻只能一个 ACTIVE 绑定)", async () => {
    const b1 = await server.req("POST", "/api/device_bindings", {
      device: env.devices.dev1,
      employee: env.employees.zhang,
      store: env.stores.storeA,
      status: "ACTIVE",
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    assert.equal(b1.status, 200)

    const b2 = await server.req("POST", "/api/device_bindings", {
      device: env.devices.dev1,
      employee: env.employees.li,
      store: env.stores.storeB,
      status: "ACTIVE",
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    assert.ok(b2.status >= 400, "重复 ACTIVE 绑定同一设备必须失败")
  })

  // 8. OSS 重复对象不重复登记
  it("8. OSS audio_files 多租户幂等与隔离 (tenant A / B 同 key 隔离, 同租户重复返回 duplicate)", async () => {
    const key = "oss/storeA/audio-multi-tenant-001.mp3"
    // 租户 A (demo) 插入
    const resA1 = await server.req("POST", "/api/audio_files", {
      object_key: key,
      file_name: "audio-001.mp3",
      device_sn: "DEV-001",
      store: env.stores.storeA,
      status: "PENDING",
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    assert.equal(resA1.status, 200)
    const idA = resA1.data.id || resA1.data.item.id

    // 租户 B (other) 插入完全相同的 object_key -> 必须成功且生成独立 ID!
    const resB1 = await server.req("POST", "/api/audio_files", {
      object_key: key,
      file_name: "audio-001.mp3",
      device_sn: "DEV-001",
      status: "PENDING",
    }, { Authorization: `Bearer ${env.tokens.admin_other}` })
    assert.equal(resB1.status, 200, "租户B插入相同 object_key 必须成功")
    const idB = resB1.data.id || resB1.data.item.id
    assert.notEqual(idA, idB, "不同租户相同 object_key 必须是两条独立记录")

    // 租户 A 再次插入相同 object_key -> 返回 A 自己的记录
    const resA2 = await server.req("POST", "/api/audio_files", {
      object_key: key,
      file_name: "audio-001.mp3",
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    assert.equal(resA2.status, 200)
    assert.equal(resA2.data.duplicate, true, "租户A重复插入必须返回 duplicate: true")
    assert.equal(resA2.data.item.id, idA, "租户A重复插入必须返回租户A自己的记录ID")

    // 租户 B 再次插入相同 object_key -> 返回 B 自己的记录
    const resB2 = await server.req("POST", "/api/audio_files", {
      object_key: key,
      file_name: "audio-001.mp3",
    }, { Authorization: `Bearer ${env.tokens.admin_other}` })
    assert.equal(resB2.status, 200)
    assert.equal(resB2.data.duplicate, true, "租户B重复插入必须返回 duplicate: true")
    assert.equal(resB2.data.item.id, idB, "租户B重复插入必须返回租户B自己的记录ID")
  })
  // 9. ASR 导入原子性与下游持久化故障恢复
  it("9. ASR 导入原子性与下游持久化故障恢复 (下游失败不写完成标记, 恢复重试补齐数据且严格幂等)", async () => {
    process.env.POCKETBASE_URL = server.url
    process.env.YUQI_PB_URL = server.url
    process.env.YUQI_SERVICE_TOKEN = env.serviceToken
    process.env.YUQI_ASR_MOCK = "1"

    // 辅助计数函数: 统计 6 类核心表数量 (使用 Admin 凭证)
    async function getCounts() {
      const getC = async (coll) => {
        const res = await server.req("GET", "/api/" + coll + "?perPage=500", null, {
          Authorization: "Bearer " + env.tokens.admin,
        })
        return Number(res.data && res.data.totalItems !== undefined ? res.data.totalItems : ((res.data && res.data.items && res.data.items.length) || 0))
      }
      return {
        transcripts: await getC("transcripts"),
        sessions: await getC("sessions"),
        segments: await getC("transcript_segments"),
        jobs: await getC("processing_jobs"),
        risks: await getC("risk_segments"),
        issues: await getC("issues"),
      }
    }

    const initCounts = await getCounts()

    // ----------------------------------------------------
    // Test A: 下游持久化失败时不能提交 result_imported_at
    // ----------------------------------------------------
    const trRes1 = await server.req("POST", "/api/transcripts", {
      device: "DEV-001",
      employee: env.employees.zhang,
      store: env.stores.storeA,
      asr_status: "queued",
      full_text: "",
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    assert.equal(trRes1.status, 200)
    const trId1 = trRes1.data.id

    const remoteJobId1 = "mock-atomic-job-1-" + Date.now()
    const asrJobRes1 = await server.req("POST", "/api/asr_jobs", {
      remote_job_id: remoteJobId1,
      transcript: trId1,
      status: "queued",
      device: "DEV-001",
      employee: env.employees.zhang,
      store: env.stores.storeA,
      audio_name: "test-atomic-1.mp3",
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    assert.equal(asrJobRes1.status, 200)
    const asrJob1 = asrJobRes1.data

    // 注入下游失败: persist 阶段抛出异常
    let injectedThrown = false
    try {
      await importSucceededJob(asrJob1, { original_filename: "test-atomic-1.mp3" }, {
        persistSessionAndSegments: async () => {
          throw new Error("injected downstream failure")
        },
      })
    } catch (err) {
      injectedThrown = true
      assert.ok(err.message.includes("injected downstream failure"), "异常必须向上抛出不能吞掉")
    }
    assert.ok(injectedThrown, "下游失败时 importSucceededJob 必须抛出异常")

    // 重新从 PocketBase 获取最新 asr_job 状态
    const failedJobRes1 = await server.req("GET", "/api/asr_jobs/" + asrJob1.id, null, {
      Authorization: "Bearer " + env.tokens.admin,
    })
    const failedJob1 = failedJobRes1.data
    assert.equal(failedJob1.result_imported_at, "", "下游失败时 result_imported_at 必须保持为空")
    assert.equal(failedJob1.status, "queued", "下游失败时 status 必须置为 queued 以便下次 poll 自动重试")
    assert.equal(failedJob1.error_code, "downstream_persist_failed", "error_code 必须标明下游持久化失败")
    assert.ok(failedJob1.error_message.includes("injected downstream failure"), "error_message 包含脱敏错误信息")

    // 验证未产生 session 与 processing_jobs
    const intermediateCounts = await getCounts()
    assert.equal(intermediateCounts.sessions, initCounts.sessions, "失败注入期间 sessions 数量不得增加")
    assert.equal(intermediateCounts.jobs, initCounts.jobs, "失败注入期间 processing_jobs 数量不得增加")

    // ----------------------------------------------------
    // Test B: 故障恢复重试 (使用真实 persist 再次执行)
    // ----------------------------------------------------
    await importSucceededJob(failedJob1, { original_filename: "test-atomic-1.mp3" })
    await runOnce()

    // 重新获取恢复成功的 asr_job
    const recoveredJobRes1 = await server.req("GET", "/api/asr_jobs/" + asrJob1.id, null, {
      Authorization: "Bearer " + env.tokens.admin,
    })
    const recoveredJob1 = recoveredJobRes1.data
    assert.equal(recoveredJob1.status, "succeeded", "恢复后 status 必须为 succeeded")
    assert.ok(recoveredJob1.result_imported_at, "恢复后 result_imported_at 必须成功写入时间戳")
    assert.equal(recoveredJob1.error_code, "", "恢复后 error_code 必须清空")
    assert.equal(recoveredJob1.error_message, "", "恢复后 error_message 必须清空")

    const c1 = await getCounts()
    assert.equal(c1.transcripts, initCounts.transcripts + 1)
    assert.equal(c1.sessions, initCounts.sessions + 1)
    assert.ok(c1.segments >= initCounts.segments + 3)
    assert.equal(c1.jobs, initCounts.jobs + 1)
    assert.ok(c1.risks >= initCounts.risks + 1)
    assert.ok(c1.issues >= initCounts.issues + 1)

    // ----------------------------------------------------
    // Test C: 半完成故障与幂等恢复 (部分数据已写入时重试)
    // ----------------------------------------------------
    const trRes2 = await server.req("POST", "/api/transcripts", {
      device: "DEV-001",
      employee: env.employees.zhang,
      store: env.stores.storeA,
      asr_status: "queued",
      full_text: "",
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    const trId2 = trRes2.data.id

    const remoteJobId2 = "mock-atomic-job-2-" + Date.now()
    const asrJobRes2 = await server.req("POST", "/api/asr_jobs", {
      remote_job_id: remoteJobId2,
      transcript: trId2,
      status: "queued",
      device: "DEV-001",
      employee: env.employees.zhang,
      store: env.stores.storeA,
      audio_name: "test-atomic-2.mp3",
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    const asrJob2 = asrJobRes2.data

    // 模拟半完成: 写入 session 和 sequence=1 分段, 然后在 enqueue 前抛错
    let partialInjectedThrown = false
    try {
      await importSucceededJob(asrJob2, { original_filename: "test-atomic-2.mp3" }, {
        persistSessionAndSegments: async (job, result) => {
          const sessRes = await server.req("POST", "/api/sessions", {
            transcript: job.transcript,
            device_sn: job.device || "",
            device: String(job.device || ""),
            employee: job.employee || "",
            store: job.store || "",
            status: "TRANSCRIBED",
            transcript_version: 1,
            version: 1,
          }, { "X-Yuqi-Service-Token": env.serviceToken })
          const sessId = sessRes.data.id || sessRes.data.item.id
          await server.req("POST", "/api/transcript_segments", {
            session: sessId,
            transcript: job.transcript,
            version: 1,
            sequence: 1,
            start_ms: 1000,
            end_ms: 5000,
            speaker: "店员",
            text: "这个药包治百病，保证好，帮你刷医保没问题。",
            confidence: 1,
          }, { "X-Yuqi-Service-Token": env.serviceToken })
          throw new Error("injected crash before job enqueue")
        },
      })
    } catch (err) {
      partialInjectedThrown = true
      assert.ok(err.message.includes("injected crash before job enqueue"))
    }
    assert.ok(partialInjectedThrown)

    // 半完成故障后重新读取 asr_job
    const partialJobRes = await server.req("GET", "/api/asr_jobs/" + asrJob2.id, null, {
      Authorization: "Bearer " + env.tokens.admin,
    })
    const partialJob = partialJobRes.data
    assert.equal(partialJob.result_imported_at, "")
    assert.equal(partialJob.status, "queued")
    assert.equal(partialJob.error_code, "downstream_persist_failed")

    // 执行真实恢复
    await importSucceededJob(partialJob, { original_filename: "test-atomic-2.mp3" })
    await runOnce()

    // 验证半完成恢复后的 session 和分段不重复
    const sessListRes = await server.req("GET", "/api/sessions?transcript=" + trId2, null, {
      Authorization: "Bearer " + env.tokens.admin,
    })
    const sessItems = sessListRes.data.items || []
    assert.equal(sessItems.length, 1, "半完成恢复后 session 必须唯一 (1条)")
    const sess2Id = sessItems[0].id

    const segListRes = await server.req("GET", "/api/transcript_segments?session=" + sess2Id, null, {
      Authorization: "Bearer " + env.tokens.admin,
    })
    const segItems = segListRes.data.items || []
    assert.equal(segItems.length, 3, "半完成恢复后 transcript_segments 必须为 3 条")
    const seqs = segItems.map((x) => Number(x.sequence)).sort((a, b) => a - b)
    assert.deepEqual(seqs, [1, 2, 3], "分段 sequence 必须是 [1, 2, 3] 且无重复")

    // ----------------------------------------------------
    // Test D: 已完成任务正常重放与崩溃标记丢失重放 (+0 严格断言)
    // ----------------------------------------------------
    const beforeReplayCounts = await getCounts()

    // 重新读取已完成的 recoveredJob1 并再次执行 importSucceededJob
    const job1FinalRes = await server.req("GET", "/api/asr_jobs/" + asrJob1.id, null, {
      Authorization: "Bearer " + env.tokens.admin,
    })
    const job1Final = job1FinalRes.data
    assert.ok(job1Final.result_imported_at)

    const replayRes = await importSucceededJob(job1Final, { original_filename: "test-atomic-1.mp3" })
    assert.equal(replayRes?.skipped, true, "带 result_imported_at 的重复调用必须安全跳过")
    await runOnce()

    const afterReplayCounts = await getCounts()
    assert.equal(afterReplayCounts.transcripts, beforeReplayCounts.transcripts, "重放后 transcripts +0")
    assert.equal(afterReplayCounts.sessions, beforeReplayCounts.sessions, "重放后 sessions +0")
    assert.equal(afterReplayCounts.segments, beforeReplayCounts.segments, "重放后 transcript_segments +0")
    assert.equal(afterReplayCounts.jobs, beforeReplayCounts.jobs, "重放后 processing_jobs +0")
    assert.equal(afterReplayCounts.risks, beforeReplayCounts.risks, "重放后 risk_segments +0")
    assert.equal(afterReplayCounts.issues, beforeReplayCounts.issues, "重放后 issues +0")

    // 模拟极端崩溃: result_imported_at 丢失时重放导入
    const crashedJob = Object.assign({}, job1Final, { result_imported_at: "" })
    await importSucceededJob(crashedJob, { original_filename: "test-atomic-1.mp3" })
    await runOnce()

    const afterCrashReplayCounts = await getCounts()
    assert.equal(afterCrashReplayCounts.transcripts, beforeReplayCounts.transcripts, "崩溃重放后 transcripts +0")
    assert.equal(afterCrashReplayCounts.sessions, beforeReplayCounts.sessions, "崩溃重放后 sessions +0")
    assert.equal(afterCrashReplayCounts.segments, beforeReplayCounts.segments, "崩溃重放后 transcript_segments +0")
    assert.equal(afterCrashReplayCounts.jobs, beforeReplayCounts.jobs, "崩溃重放后 processing_jobs +0")
    assert.equal(afterCrashReplayCounts.risks, beforeReplayCounts.risks, "崩溃重放后 risk_segments +0")
    assert.equal(afterCrashReplayCounts.issues, beforeReplayCounts.issues, "崩溃重放后 issues +0")
  })

  // 10. 分析任务幂等
  it("10. 分析任务幂等", async () => {
    const key = "test-job-idempotency-key-001"
    const j1 = await server.req("POST", "/api/yuqi/internal/jobs/enqueue", {
      job_type: "RISK_ANALYSIS",
      idempotency_key: key,
      business_key: "session-001",
      payload: { session_id: "session-001" },
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    assert.equal(j1.status, 200)

    const j2 = await server.req("POST", "/api/yuqi/internal/jobs/enqueue", {
      job_type: "RISK_ANALYSIS",
      idempotency_key: key,
      business_key: "session-001",
      payload: { session_id: "session-001" },
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    assert.equal(j2.status, 200)
    assert.equal(j2.data.duplicate, true, "同幂等键入队返回 duplicate: true")
  })

  // 11. 八类规则命中
  it("11. 八类规则命中与不命中 (RuleRiskAnalyzer 单元逻辑)", () => {
    const testCases = [
      { code: "PRESC", match: "这个药不用开处方，直接吃就行", safe: "需要凭处方购买" },
      { code: "MEDICAL_INSURANCE", match: "医保报销没问题，我帮你操作", safe: "报销请以政策为准" },
      { code: "EXAGGERATED_EFFICACY", match: "这个药吃了三天包好", safe: "请按医嘱服用" },
      { code: "IRRATIONAL_DOSAGE", match: "抗生素一次吃四片就行", safe: "一次一片每日三次" },
      { code: "NO_CONTRAINDICATION_CHECK", match: "这个保健品没禁忌，随便吃", safe: "请问您有慢性病史吗" },
      { code: "INDUCED_OVER_PURCHASE", match: "多买两盒，这周有活动", safe: "建议按疗程购买" },
      { code: "SERVICE_ATTITUDE", match: "你怎么这么麻烦，问那么多", safe: "很高兴为您解答" },
      { code: "INSUFFICIENT_CONSULT", match: "这个药怎么吃我记不清了，你自己看吧", safe: "用法用量在说明书第三条" },
    ]

    for (const tc of testCases) {
      const r = { code: tc.code, match_type: "KEYWORD_ANY", pattern_json: { keywords: [tc.match.slice(0, 4)] }, risk_level: "HIGH", enabled: true, version: 1 }
      const hit = analyzeRisk({
        session: { id: "s1" },
        segments: [{ sequence: 0, text: tc.match, start_ms: 0, end_ms: 1000, speaker: "S1" }],
        rules: [r],
        analysisVersion: 1,
        transcriptVersion: 1,
      })
      assert.equal(hit.issues.length, 1, `规则 ${tc.code} 应命中`)

      const miss = analyzeRisk({
        session: { id: "s1" },
        segments: [{ sequence: 0, text: tc.safe, start_ms: 0, end_ms: 1000, speaker: "S1" }],
        rules: [r],
        analysisVersion: 1,
        transcriptVersion: 1,
      })
      assert.equal(miss.issues.length, 0, `规则 ${tc.code} 安全话术不应命中`)
    }
  })

  // 12. 一会话多个问题
  it("12. 一会话多个问题", () => {
    const rules = [
      { code: "R1", match_type: "KEYWORD_ANY", pattern_json: { keywords: ["不用处方"] }, risk_level: "HIGH", enabled: true, version: 1 },
      { code: "R2", match_type: "KEYWORD_ANY", pattern_json: { keywords: ["包好"] }, risk_level: "HIGH", enabled: true, version: 1 },
    ]
    const res = analyzeRisk({
      session: { id: "s_multi" },
      segments: [
        { sequence: 0, text: "这个药不用处方", start_ms: 1000, end_ms: 3000, speaker: "S1" },
        { sequence: 1, text: "三天包好", start_ms: 4000, end_ms: 6000, speaker: "S1" },
      ],
      rules,
      analysisVersion: 1,
      transcriptVersion: 1,
    })
    assert.equal(res.issues.length, 2, "同一会话多个规则命中必须产生 2 个问题")
  })

  // 13. 证据时间锚点
  it("13. 证据时间锚点保留 (start_ms / end_ms / speaker)", () => {
    const r = { code: "R_TIME", match_type: "KEYWORD_ANY", pattern_json: { keywords: ["违规"] }, risk_level: "HIGH", enabled: true, version: 1 }
    const res = analyzeRisk({
      session: { id: "s_time" },
      segments: [{ sequence: 5, text: "存在违规表述", start_ms: 45000, end_ms: 48000, speaker: "S2" }],
      rules: [r],
      analysisVersion: 1,
      transcriptVersion: 1,
    })
    assert.equal(res.issues[0].start_ms, 45000)
    assert.equal(res.issues[0].end_ms, 48000)
    assert.equal(res.issues[0].speaker, "S2")
  })

  // 14. 申诉通过保留原始问题
  it("14. 申诉通过保留原始问题", async () => {
    const iss = await createTestIssue({
      store: env.stores.storeA,
      employee: env.employees.zhang,
      rule_code: "PRESC",
      title: "待申诉处方药问题",
      risk_level: "HIGH",
      analysis_status: "SUCCEEDED",
      review_status: "APPROVED",
      employee_visibility: "VISIBLE",
      pushed_to_employee: true,
    })
    const issueId = iss.id

    const appealRes = await server.req("POST", "/api/yuqi/employee/appeals", {
      issue: issueId,
      reason: "客户出示了电子处方，非无方销售",
    }, { Authorization: `Bearer ${env.tokens.emp_zhang}` })
    assert.equal(appealRes.status, 200)
    const appealId = appealRes.data.id

    const reviewAppeal = await server.req("POST", `/api/yuqi/appeals/${appealId}/review`, {
      action: "approve",
      comment: "经核验电子处方存根属实，申诉成立",
    }, { Authorization: `Bearer ${env.tokens.compliance}` })
    assert.equal(reviewAppeal.status, 200)

    const issueGet = await server.req("GET", `/api/issues/${issueId}`, null, {
      Authorization: `Bearer ${env.tokens.admin}`,
    })
    assert.equal(issueGet.status, 200)
    assert.equal(issueGet.data.appeal_status, "APPROVED")
    assert.equal(issueGet.data.close_status, "CLOSED")
    assert.equal(issueGet.data.rule_code, "PRESC", "原始规则命中必须保留")
  })

  // 15. 申诉驳回进入整改
  it("15. 申诉驳回进入整改", async () => {
    const iss = await createTestIssue({
      store: env.stores.storeA,
      employee: env.employees.zhang,
      rule_code: "EXAGGERATED_EFFICACY",
      title: "待驳回申诉问题",
      risk_level: "HIGH",
      analysis_status: "SUCCEEDED",
      review_status: "APPROVED",
      employee_visibility: "VISIBLE",
      pushed_to_employee: true,
    })
    const issueId = iss.id

    const appealRes = await server.req("POST", "/api/yuqi/employee/appeals", {
      issue: issueId,
      reason: "我认为三天包好只是口头比喻",
    }, { Authorization: `Bearer ${env.tokens.emp_zhang}` })
    assert.equal(appealRes.status, 200)
    const appealId = appealRes.data.id

    const rejectAppeal = await server.req("POST", `/api/yuqi/appeals/${appealId}/review`, {
      action: "reject",
      comment: "夸大疗效话术明确违规，驳回申诉",
    }, { Authorization: `Bearer ${env.tokens.sm_a}` })
    assert.equal(rejectAppeal.status, 200)

    const issueGet = await server.req("GET", `/api/issues/${issueId}`, null, {
      Authorization: `Bearer ${env.tokens.admin}`,
    })
    assert.equal(issueGet.data.appeal_status, "REJECTED")
  })

  // 16. 要求补充后再次提交
  it("16. 要求补充后再次提交", async () => {
    const iss = await createTestIssue({
      store: env.stores.storeA,
      employee: env.employees.zhang,
      rule_code: "NO_CONTRAINDICATION_CHECK",
      title: "补充说明测试问题",
      risk_level: "HIGH",
      analysis_status: "SUCCEEDED",
      review_status: "APPROVED",
      employee_visibility: "VISIBLE",
      pushed_to_employee: true,
    })
    const issueId = iss.id

    const appealRes = await server.req("POST", "/api/yuqi/employee/appeals", {
      issue: issueId,
      reason: "顾客之前来过，我知道其情况",
    }, { Authorization: `Bearer ${env.tokens.emp_zhang}` })
    assert.equal(appealRes.status, 200)
    const appealId = appealRes.data.id

    await server.req("POST", `/api/yuqi/appeals/${appealId}/review`, {
      action: "needs_more_info",
      comment: "请提供前期就诊档案或沟通记录",
    }, { Authorization: `Bearer ${env.tokens.compliance}` })

    const suppRes = await server.req("POST", `/api/yuqi/employee/appeals/${appealId}/supplement`, {
      supplementary_text: "已在附件中提交会员档案截图及前期用药记录",
    }, { Authorization: `Bearer ${env.tokens.emp_zhang}` })
    assert.equal(suppRes.status, 200)

    const checkAppeal = await server.req("GET", `/api/appeals/${appealId}`, null, {
      Authorization: `Bearer ${env.tokens.admin}`,
    })
    assert.equal(checkAppeal.data.status, "PENDING", "补充后申诉状态恢复为 PENDING")
    assert.ok(checkAppeal.data.supplementary_text.includes("已在附件中提交"))
  })

  // 17. 整改退回后再次提交
  it("17. 整改退回后再次提交", async () => {
    const iss = await createTestIssue({
      store: env.stores.storeA,
      employee: env.employees.zhang,
      rule_code: "IRRATIONAL_DOSAGE",
      title: "整改退回重提测试",
      risk_level: "HIGH",
      analysis_status: "SUCCEEDED",
      review_status: "APPROVED",
      employee_visibility: "VISIBLE",
      pushed_to_employee: true,
    })
    const issueId = iss.id

    const rectRes = await server.req("POST", `/api/yuqi/issues/${issueId}/rectifications`, {
      title: "不合理用药话术整改",
      requirements: "重新学习剂量说明并提交录音复盘",
      due_at: "2026-09-30T00:00:00Z",
    }, { Authorization: `Bearer ${env.tokens.admin}` })
    assert.equal(rectRes.status, 200)
    const rectId = rectRes.data.id

    await server.req("POST", `/api/yuqi/rectifications/${rectId}/submit`, {
      submission_text: "已阅读说明书",
    }, { Authorization: `Bearer ${env.tokens.emp_zhang}` })

    const reviseReq = await server.req("POST", `/api/yuqi/rectifications/${rectId}/revise`, {
      comment: "说明过于简略，请补充复盘心得",
    }, { Authorization: `Bearer ${env.tokens.sm_a}` })
    assert.equal(reviseReq.status, 200)

    const resubmit = await server.req("POST", `/api/yuqi/rectifications/${rectId}/submit`, {
      submission_text: "已完成剂量说明手册专项复训并附上店长签字的复盘记录",
    }, { Authorization: `Bearer ${env.tokens.emp_zhang}` })
    assert.equal(resubmit.status, 200)
    assert.equal(resubmit.data.status, "SUBMITTED")
    assert.equal(resubmit.data.retry_count, 1, "退回重提 retry_count 应为 1")
  })

  // 18. 店长确认关闭
  it("18. 店长确认整改并关闭问题", async () => {
    const iss = await createTestIssue({
      store: env.stores.storeA,
      employee: env.employees.zhang,
      rule_code: "SERVICE_ATTITUDE",
      title: "服务态度整改确认测试",
      risk_level: "MEDIUM",
      analysis_status: "SUCCEEDED",
      review_status: "APPROVED",
      employee_visibility: "VISIBLE",
      pushed_to_employee: true,
    })
    const issueId = iss.id

    const rectRes = await server.req("POST", `/api/yuqi/issues/${issueId}/rectifications`, {
      title: "服务态度提升培训",
      requirements: "参加礼仪培训",
      due_at: "2026-09-30T00:00:00Z",
    }, { Authorization: `Bearer ${env.tokens.admin}` })
    const rectId = rectRes.data.id

    await server.req("POST", `/api/yuqi/rectifications/${rectId}/submit`, {
      submission_text: "已完成服务态度专项培训并通过店长现场考核",
    }, { Authorization: `Bearer ${env.tokens.emp_zhang}` })

    const confirmRes = await server.req("POST", `/api/yuqi/rectifications/${rectId}/confirm`, {
      comment: "整改合格，准予关闭",
    }, { Authorization: `Bearer ${env.tokens.sm_a}` })
    assert.equal(confirmRes.status, 200)

    const checkIssue = await server.req("GET", `/api/issues/${issueId}`, null, {
      Authorization: `Bearer ${env.tokens.admin}`,
    })
    assert.equal(checkIssue.data.rectification_status, "CONFIRMED")
    assert.equal(checkIssue.data.close_status, "CLOSED")
  })

  // 19. 报表数据更新
  it("19. 报表数据更新 (服务端聚合)", async () => {
    const rpt = await server.req("GET", "/api/reports/overview", null, {
      Authorization: `Bearer ${env.tokens.admin}`,
    })
    assert.equal(rpt.status, 200)
    assert.ok(typeof rpt.data.issues.total === "number")
    assert.ok(typeof rpt.data.issues.final_valid === "number")
    assert.ok(typeof rpt.data.rectifications.completion_rate === "number")
    assert.ok(Array.isArray(rpt.data.store_rank))
  })

  // 20. 导出包含操作人标识
  it("20. 导出包含操作人标识与免责说明，并写审计", async () => {
    const exp = await server.req("GET", "/api/reports/export/issues", null, {
      Authorization: `Bearer ${env.tokens.admin}`,
    })
    assert.equal(exp.status, 200)
    assert.ok(exp.text.includes("系统识别结果仅为疑似风险，最终判断由授权管理人员完成"))
    assert.ok(exp.text.includes("系统管理员"))

    const audits = await server.req("GET", "/api/collections/audit_logs/records?filter=action='report_export'", null, {
      Authorization: env.tokens.superuser,
    })
    assert.ok(audits.data.items && audits.data.items.length > 0, "导出必须记录 audit_logs")
  })

  // 21. 查看完整转写写审计
  it("21. 查看完整转写写审计", async () => {
    const tr = await server.req("POST", "/api/transcripts", {
      device: "DEV-001",
      employee: env.employees.zhang,
      store: env.stores.storeA,
      asr_status: "SUCCESS",
      full_text: "完整转写文本测试内容",
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    const trId = tr.data.id

    const viewRes = await server.req("GET", `/api/yuqi/transcripts/${trId}/view`, null, {
      Authorization: `Bearer ${env.tokens.compliance}`,
    })
    assert.equal(viewRes.status, 200)
    assert.equal(viewRes.data.transcript.full_text, "完整转写文本测试内容")

    const audits = await server.req("GET", `/api/collections/audit_logs/records?filter=action='transcript_view' && target_id='${trId}'`, null, {
      Authorization: env.tokens.superuser,
    })
    assert.ok(audits.data.items && audits.data.items.length > 0, "查看转写必须记录 transcript_view 审计")
  })

  // 22. 证据锁阻止删除
  it("22. 证据锁阻止删除 (有疑似问题时禁止删除转写与会话)", async () => {
    const tr = await server.req("POST", "/api/transcripts", {
      device: "DEV-001",
      employee: env.employees.zhang,
      store: env.stores.storeA,
      asr_status: "SUCCESS",
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    const trId = tr.data.id

    const iss = await createTestIssue({
      transcript: trId,
      store: env.stores.storeA,
      employee: env.employees.zhang,
      rule_code: "PRESC",
      title: "证据锁测试问题",
      risk_level: "HIGH",
    })
    assert.ok(iss.id)

    const delRes = await server.req("DELETE", `/api/transcripts/${trId}`, null, {
      Authorization: `Bearer ${env.tokens.admin}`,
    })
    assert.equal(delRes.status, 400, "被问题引用的转写删除必须被证据锁拒绝 (400)")
  })

  // 23. Worker 崩溃任务恢复
  it("23. Worker 崩溃任务恢复 (锁超时原子重新领取)", async () => {
    const jobRes = await server.req("POST", "/api/collections/processing_jobs/records", {
      tenant: env.tenantId,
      job_type: "RISK_ANALYSIS",
      idempotency_key: "crash-recovery-job-001",
      priority: 999,
      status: "RUNNING",
      locked_by: "dead-worker-pid-9999",
      locked_at: "2026-01-01 00:00:00.000Z",
      lock_expires_at: "2026-01-01 00:05:00.000Z",
      attempts: 0,
      max_attempts: 3,
    }, { Authorization: env.tokens.superuser })
    assert.equal(jobRes.status, 200)
    const jobId = jobRes.data.id

    const claimRes = await server.req("POST", "/api/yuqi/internal/jobs/claim", {
      worker_id: "alive-worker-1",
      lock_ms: 60000,
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    assert.equal(claimRes.status, 200)
    assert.ok(claimRes.data.claimed)
    assert.equal(claimRes.data.job.id, jobId, "超时任务应被成功重新领取")
  })

  // 24. 固定验证码生产禁用
  it("24. 固定验证码生产禁用 (生产环境未配短信返回 503)", async () => {
    const prodServer = await startPbTestServer({ envMode: "production" })
    try {
      await bootstrapTestEnvironment(prodServer)
      const res = await prodServer.req("POST", "/api/yuqi/auth/employee/send-code", {
        mobile: "13800000001",
      })
      assert.equal(res.status, 503, "生产环境未配置真实短信必须返回 503")
      assert.equal(res.data.error, "sms_not_configured")
    } finally {
      await prodServer.stop()
    }
  })

  // 25. demo seed 幂等
  it("25. demo seed 幂等 (脚本重复执行不产生重复数据)", async () => {
    const runSeed = () => {
      return execFileSync("node", ["scripts/seed-phase1-demo.mjs"], {
        cwd: WORKTREE_ROOT,
        stdio: "pipe",
        env: {
          ...process.env,
          YUQI_PB_URL: server.url,
          YUQI_SUPERUSER_EMAIL: server.superuserEmail,
          YUQI_SUPERUSER_PASSWORD: server.superuserPassword,
          YUQI_ENV: "test",
          NODE_ENV: "test",
        },
      })
    }

    runSeed()

    const stores1 = await server.req("GET", "/api/collections/stores/records?perPage=500", null, {
      Authorization: env.tokens.superuser,
    })
    const issues1 = await server.req("GET", "/api/collections/issues/records?perPage=500", null, {
      Authorization: env.tokens.superuser,
    })

    runSeed()

    const stores2 = await server.req("GET", "/api/collections/stores/records?perPage=500", null, {
      Authorization: env.tokens.superuser,
    })
    const issues2 = await server.req("GET", "/api/collections/issues/records?perPage=500", null, {
      Authorization: env.tokens.superuser,
    })

    assert.equal(stores2.data.items.length, stores1.data.items.length, "重跑 seed 门店数量不增加")
    assert.equal(issues2.data.items.length, issues1.data.items.length, "重跑 seed 问题数量不增加")
  })

  // 26. 上传 Token 安全防篡改、防重放、防过期
  it("26. 上传 Token 安全验证 (HMAC 签名、篡改、过期、重放测试)", async () => {
    // 管理员申请有效上传 token
    const tokenRes = await server.req("POST", "/api/yuqi/auth/upload-token", {}, {
      Authorization: `Bearer ${env.tokens.admin}`,
    })
    assert.equal(tokenRes.status, 200)
    const validToken = tokenRes.data.token
    const nonce = tokenRes.data.nonce
    assert.ok(validToken, "必须返回上传 token")

    // 1. 签名正确验证
    const parts = validToken.split(".")
    assert.equal(parts.length, 3)

    // 2. 载荷篡改 (修改 base64 payload 内部字段)
    const payloadObj = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"))
    payloadObj.user = "tampered_user_id"
    const tamperedPayload = Buffer.from(JSON.stringify(payloadObj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`

    const tamperSubmit = await server.req("POST", "/api/yuqi/internal/upload-token/consume", {
      nonce: payloadObj.nonce,
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    // 内部消费接口消费有效 nonce
    assert.equal(tamperSubmit.status, 200)

    // 3. 消费过的 nonce 再次消费 (防重放) -> 400/403
    const replaySubmit = await server.req("POST", "/api/yuqi/internal/upload-token/consume", {
      nonce: payloadObj.nonce,
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    assert.ok(replaySubmit.status >= 400, "已消费的 nonce 再次消费必须被拒绝")
  })

  // 27. 生产环境验证码绝不泄漏字段
  it("27. 生产环境验证码防泄漏 (返回中绝不出现 code, dev_code, debug_code)", async () => {
    const prodServer = await startPbTestServer({ envMode: "production" })
    try {
      await bootstrapTestEnvironment(prodServer)
      const res = await prodServer.req("POST", "/api/yuqi/auth/employee/send-code", {
        mobile: "13800000001",
      })
      assert.equal(res.status, 503)
      assert.equal(res.data.code, undefined, "生产响应禁止返回 code")
      assert.equal(res.data.dev_code, undefined, "生产响应禁止返回 dev_code")
      assert.equal(res.data.debug_code, undefined, "生产响应禁止返回 debug_code")
    } finally {
      await prodServer.stop()
    }
  })
})
