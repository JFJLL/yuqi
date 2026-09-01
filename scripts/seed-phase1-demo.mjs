#!/usr/bin/env node
// scripts/seed-phase1-demo.mjs — 一期演示数据种子 (仅 dev/test)
//
// 幂等: 关键实体按唯一字段 find-or-create; 批量数据由 app_settings[demo_seed_v1] 标记,
//        标记存在即跳过批量生成, 重复执行不产生重复数据。
// 生产保护: NODE_ENV/YUQI_ENV = production 时强制拒绝。
// 全部演示数据带 tenant 归属与 DEMO 标记; 不调用真实 ASR;
// 另写入 1 条 Mock 全链路样本 (会话+分段) 并入队 RISK_ANALYSIS。
//
// 环境变量:
//   YUQI_PB_URL              PocketBase 地址 (默认 http://127.0.0.1:8090)
//   YUQI_SUPERUSER_EMAIL     superuser 邮箱 (默认 admin@demo.local)
//   YUQI_SUPERUSER_PASSWORD  superuser 密码 (必填)
//   YUQI_DEMO_ADMIN_PASSWORD 演示管理员密码 (默认 Passw0rd!, 仅演示环境)
//   YUQI_ENV / NODE_ENV      production 拒绝执行

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { BUILTIN_RULES } from "../server/rule-analyzer.mjs"

const BASE = process.env.YUQI_PB_URL || "http://127.0.0.1:8090"
const SUPER_EMAIL = process.env.YUQI_SUPERUSER_EMAIL || "admin@demo.local"
const SUPER_PASSWORD = process.env.YUQI_SUPERUSER_PASSWORD
const DEMO_ADMIN_PASSWORD = process.env.YUQI_DEMO_ADMIN_PASSWORD || "Passw0rd!"
const ENV = (process.env.YUQI_ENV || process.env.NODE_ENV || "development").toLowerCase()

if (ENV === "production") {
  console.error("[seed] 拒绝执行: 生产环境禁止运行演示种子 (YUQI_ENV/NODE_ENV=production)")
  process.exit(1)
}
if (!SUPER_PASSWORD) {
  console.error("[seed] 缺少 YUQI_SUPERUSER_PASSWORD")
  process.exit(1)
}

const DEMO_MARKER_KEY = "demo_seed_v1"
const DEMO_MARKER_VALUE = "completed"

// 确定性伪随机 (稳定计数)
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const RISK_TEXT_POOL = [
  "这个药属于处方药，没处方也能买", // 处方药
  "帮你刷医保，走医保没问题", // 医保话术
  "这个药吃了包治百病，保证好", // 夸大疗效
  "抗生素你一天吃三次，一次吃四片加倍吃", // 不合理用药
  "这个药不用问，谁都能吃，没有禁忌", // 禁忌症未询问
  "多买几盒囤一点，趁活动多买", // 诱导超量
  "爱买不买，烦死了别烦我", // 服务态度
  "不用问症状，直接拿药拿了就走", // 问诊信息不足
  "好的，那按你说的来", "谢谢", "我先考虑一下",
]
const SAFE_TEXT_POOL = [
  "请问您哪里不舒服", "这个药请按说明书服用", "如有不适请及时就医",
  "好的，我帮您登记", "请遵医嘱使用", "谢谢您的咨询",
]

const headers = () => ({ "Content-Type": "application/json", Authorization: SUPER_TOKEN })

async function req(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: headers(),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch (_) {}
  return { status: res.status, data }
}

async function listAll(coll, filter, perPage = 500) {
  const out = []
  let page = 1
  for (;;) {
    const { status, data } = await req("GET", `/api/collections/${coll}/records?perPage=${perPage}&page=${page}&filter=${encodeURIComponent(filter)}`)
    if (status !== 200) return out
    out.push(...(data.items || []))
    if (!data.totalPages || page >= data.totalPages) break
    page++
  }
  return out
}

async function findOne(coll, filter) {
  const items = await listAll(coll, filter, 1)
  return items.length ? items[0] : null
}

async function create(coll, body, expect = [200, 201]) {
  const { status, data } = await req("POST", `/api/collections/${coll}/records`, body)
  if (!expect.includes(status)) {
    const msg = data && data.message ? data.message : JSON.stringify(data).slice(0, 200)
    throw new Error(`create ${coll} failed (${status}): ${msg}`)
  }
  return data
}

async function findOrCreate(coll, filter, body) {
  const existing = await findOne(coll, filter)
  if (existing) return existing
  return create(coll, body)
}

function randTokenKey() {
  let s = ""
  for (let i = 0; i < 40; i++) s += "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 62)]
  return s
}

async function main() {
  console.log(`[seed] demo seed 开始 (env=${ENV}, pb=${BASE})`)

  // 1. superuser 认证
  const login = await req("POST", "/api/collections/_superusers/auth-with-password", {
    identity: SUPER_EMAIL, password: SUPER_PASSWORD,
  }).catch(() => ({ status: 0, data: {} }))
  if (login.status !== 200) {
    console.error(`[seed] superuser 登录失败 (${login.status}): ${JSON.stringify(login.data).slice(0, 200)}`)
    process.exit(1)
  }
  SUPER_TOKEN = login.data.token

  // 2. 关键实体 (find-or-create)
  const tenant = await findOrCreate("tenants", "code='demo'", { code: "demo", name: "演示试点租户", status: "ACTIVE" })
  const TENANT = tenant.id

  const regionA = await findOrCreate("regions", "code='R-HD'", { name: "华东大区", code: "R-HD", status: "ACTIVE", tenant: TENANT })
  const regionB = await findOrCreate("regions", "code='R-HN'", { name: "华南大区", code: "R-HN", status: "ACTIVE", tenant: TENANT })

  const storeDefs = [
    { name: "上海静安店", region: regionA.id },
    { name: "杭州西湖店", region: regionA.id },
    { name: "广州天河店", region: regionB.id },
    { name: "深圳南山店", region: regionB.id },
  ]
  const stores = []
  for (const sd of storeDefs) {
    stores.push(await findOrCreate("stores", `name='${sd.name}'`, { name: sd.name, region: sd.region, status: "ACTIVE", tenant: TENANT }))
  }

  const employees = []
  for (let i = 1; i <= 12; i++) {
    const phone = `1380000${String(i).padStart(4, "0")}`
    const store = stores[(i - 1) % stores.length]
    employees.push(await findOrCreate("employees", `phone='${phone}'`, {
      name: `演示员工${String(i).padStart(2, "0")}`, phone, role: "店员", store: store.id,
      status: "在职", tenant: TENANT,
    }))
  }

  // app_users: admin/compliance/region_manager x2/store_manager x4/employee x12
  async function makeUser(username, displayName, roleCode, extra = {}) {
    const existing = await findOne("app_users", `email='${username}@demo.local'`)
    if (existing) {
      // 修复早期版本缺失的 mobile
      if (extra.mobile && !existing.mobile) {
        await req("PATCH", `/api/collections/app_users/records/${existing.id}`, { mobile: extra.mobile }).catch(() => {})
      }
      return existing
    }
    return create("app_users", {
      tokenKey: randTokenKey(),
      username,
      email: `${username}@demo.local`,
      password: DEMO_ADMIN_PASSWORD,
      passwordConfirm: DEMO_ADMIN_PASSWORD,
      display_name: displayName,
      role_code: roleCode,
      status: "ACTIVE",
      tenant: TENANT,
      ...extra,
    })
  }

  const admin = await makeUser("admin", "演示管理员", "ADMIN")
  const compliance = await makeUser("compliance", "演示合规专员", "COMPLIANCE")
  const rmA = await makeUser("rm_hd", "华东区域经理", "REGION_MANAGER", { assigned_org: regionA.id })
  const rmB = await makeUser("rm_hn", "华南区域经理", "REGION_MANAGER", { assigned_org: regionB.id })
  const storeManagers = []
  for (let i = 0; i < stores.length; i++) {
    storeManagers.push(await makeUser(`sm_${i + 1}`, `${stores[i].name}店长`, "STORE_MANAGER", { assigned_store: stores[i].id }))
  }
  const empUsers = []
  for (let i = 0; i < employees.length; i++) {
    empUsers.push(await makeUser(`emp_${i + 1}`, employees[i].name, "EMPLOYEE", { employee: employees[i].id, mobile: employees[i].phone }))
  }

  // data scopes
  async function setScope(userId, scopeType, org = "", store = "") {
    const existing = await findOne("user_data_scopes", `user='${userId}'`)
    if (existing) return existing
    return create("user_data_scopes", { tenant: TENANT, user: userId, scope_type: scopeType, org_node: org, store, status: "ACTIVE" })
  }
  await setScope(admin.id, "ALL")
  await setScope(compliance.id, "ALL")
  await setScope(rmA.id, "ORG_TREE", regionA.id)
  await setScope(rmB.id, "ORG_TREE", regionB.id)
  for (let i = 0; i < stores.length; i++) await setScope(storeManagers[i].id, "STORE", "", stores[i].id)
  for (let i = 0; i < employees.length; i++) await setScope(empUsers[i].id, "SELF")

  // devices
  const devices = []
  for (let i = 1; i <= 10; i++) {
    const deviceNo = `DEV-${String(i).padStart(3, "0")}`
    devices.push(await findOrCreate("devices", `device_no='${deviceNo}'`, {
      device_no: deviceNo, type: "badge", status: "ACTIVE", power: 60 + ((i * 7) % 40),
      texts_today: (i * 3) % 50, last_online_at: new Date().toISOString(), tenant: TENANT,
    }))
  }

  // device_bindings 历史 (每设备先写较早的 ENDED，再写当前 ACTIVE；
  // effective_date 才是业务顺序，不能让演示数据的 created 顺序制造歧义。)
  for (let i = 0; i < devices.length; i++) {
    const emp = employees[i % employees.length]
    const store = emp.store
    const oldEmp = employees[(i + 3) % employees.length]
    const oldBinding = await findOne("device_bindings", `device='${devices[i].id}' && status='ENDED'`)
    if (!oldBinding) {
      await create("device_bindings", {
        tenant: TENANT, device: devices[i].id, employee: oldEmp.id, store: oldEmp.store,
        effective_date: "2026-07-01T00:00:00.000Z", status: "ENDED",
        request_by: oldEmp.name, approved_by: "admin", approved_at: "2026-07-02T00:00:00.000Z",
      }).catch(() => {})
    }
    await findOrCreate("device_bindings", `device='${devices[i].id}' && status='ACTIVE'`, {
      tenant: TENANT, device: devices[i].id, employee: emp.id, store,
      effective_date: new Date().toISOString(), status: "ACTIVE",
      request_by: emp.name, approved_by: "admin", approved_at: new Date().toISOString(),
    })
  }

  // 8 条内置规则 (对应 init-builtin 的 code)
  const rules = []
  for (const rd of BUILTIN_RULES) {
    rules.push(await findOrCreate("risk_rules", `code='${rd.code}'`, {
      tenant: TENANT, ...rd, enabled: true, version: 1, status: "ACTIVE", created_by: admin.id, updated_by: admin.id,
    }))
  }

  // 3. 批量数据标记
  const marker = await findOne("app_settings", `key='${DEMO_MARKER_KEY}'`)
  if (marker && marker.value === DEMO_MARKER_VALUE) {
    console.log("[seed] 批量演示数据已存在 (demo_seed_v1=completed), 跳过批量生成")
    console.log(`[seed] 完成 (幂等跳过) tenant=${TENANT} stores=${stores.length} employees=${employees.length} devices=${devices.length} rules=${rules.length}`)
    return
  }

  const rand = rng(20260824)
  const now = new Date()

  // 4. 批量: audio_files + sessions + transcript_segments
  const AUDIO_N = 200
  const SESSION_N = 200
  const SEG_PER_SESSION = 8
  const sessionIds = []
  const createdAudios = []
  for (let i = 0; i < SESSION_N; i++) {
    const device = devices[i % devices.length]
    const emp = employees[i % employees.length]
    const store = emp.store
    const startedAt = new Date(now.getTime() - (i + 1) * 3600 * 1000).toISOString()
    const key = `demo/${startedAt.slice(0, 10)}/${device.device_no}_${String(i + 1).padStart(4, "0")}.mp3`

    let audio = null
    if (i < AUDIO_N) {
      audio = await findOne("audio_files", `object_key='${key}'`)
      if (!audio) {
        try {
          audio = await create("audio_files", {
            tenant: TENANT, object_key: key, file_name: key.split("/").pop(),
            device_sn: device.device_no, size: 400000 + Math.floor(rand() * 200000),
            status: "transcribed", started_at: startedAt, attempts: 1, demo: true,
          })
          createdAudios.push(audio.id)
        } catch (_) {
          audio = await findOne("audio_files", `object_key='${key}'`)
        }
      }
    }

    let session = await findOne("sessions", `device_sn='${device.device_no}' && started_at='${startedAt}'`)
    if (!session) {
      const body = {
        tenant: TENANT, employee: emp.id, store: store.id, device_sn: device.device_no,
        status: "TRANSCRIBED", started_at: startedAt,
        ended_at: new Date(new Date(startedAt).getTime() + 10 * 60 * 1000).toISOString(),
        duration_ms: 600000, transcript_version: 1, version: 1, demo: true,
      }
      if (audio) body.audio_file = audio.id
      session = await create("sessions", body)
    }
    sessionIds.push(session.id)

    const existingSegs = await listAll("transcript_segments", `session='${session.id}'`, 1)
    if (existingSegs.length === 0) {
      for (let s = 0; s < SEG_PER_SESSION; s++) {
        const useRisk = rand() < 0.18
        const pool = useRisk ? RISK_TEXT_POOL : SAFE_TEXT_POOL
        const text = pool[Math.floor(rand() * pool.length)]
        await create("transcript_segments", {
          tenant: TENANT, session: session.id, version: 1, sequence: s,
          start_ms: s * 75000, end_ms: (s + 1) * 75000,
          speaker: s % 2 === 0 ? "S1" : "S2", speaker_role: s % 2 === 0 ? "staff" : "customer",
          text, confidence: 0.85 + rand() * 0.14, demo: true,
        })
      }
    }
  }
  console.log(`[seed] 批量: audio=${createdAudios.length} sessions=${sessionIds.length} segments=${SESSION_N * SEG_PER_SESSION}`)

  // 5. 批量: issues (8 类 x 8 = 64), 部分已推送/申诉/整改
  const issues = []
  for (let ri = 0; ri < rules.length; ri++) {
    for (let k = 0; k < 8; k++) {
      const idx = ri * 8 + k
      const session = sessionIds[idx % sessionIds.length]
      const emp = employees[idx % employees.length]
      const store = emp.store
      const rule = rules[ri]
      const pushed = idx % 4 === 0 // 25% 已推送
      const isFP = idx % 13 === 0
      const title = `${rule.name}·疑似问题 ${idx + 1}`
      let issue = await findOne("issues", `session='${session}' && rule_code='${rule.code}' && analysis_version=1`)
      if (!issue) {
        issue = await create("issues", {
          tenant: TENANT, session, employee: emp.id, store: store.id, rule: rule.id,
          rule_code: rule.code, rule_version: 1, transcript_version: 1, analysis_version: 1,
          risk_level: rule.risk_level, title, summary: "规则命中演示数据",
          evidence_text: RISK_TEXT_POOL[ri % RISK_TEXT_POOL.length],
          start_ms: 15000, end_ms: 30000,
          advice: rule.advice, recommended_expression: rule.recommended_expression,
          analysis_status: "SUCCEEDED",
          review_status: pushed ? "APPROVED" : isFP ? "DISMISSED" : "PENDING",
          employee_visibility: pushed ? "VISIBLE" : "HIDDEN",
          appeal_status: "NONE", rectification_status: "NONE", close_status: pushed ? "OPEN" : isFP ? "CLOSED" : "OPEN",
          pushed_to_employee: pushed, is_false_positive: isFP,
          reviewed_at: pushed ? now.toISOString() : "", closed_at: isFP ? now.toISOString() : "",
          demo: true,
        })
      }
      issues.push(issue)
    }
  }
  console.log(`[seed] issues=${issues.length}`)

  // 6. 申诉: PENDING/APPROVED/REJECTED/NEEDS_MORE_INFO
  const pushedIssues = issues.filter((x) => x.pushed_to_employee)
  const appealPlans = [
    ["PENDING", "客户只是咨询，没有实际销售"], ["APPROVED", "经核实为顾客自述，非员工话术"],
    ["REJECTED", "录音确认存在违规话术"], ["NEEDS_MORE_INFO", "请补充当时完整对话"],
  ]
  for (let i = 0; i < pushedIssues.length && i < 16; i++) {
    const issue = pushedIssues[i]
    const [status, reason] = appealPlans[i % appealPlans.length]
    const emp = issue.employee
    await findOne("appeals", `issue_ref='${issue.id}' && status='${status}'`) ||
      await create("appeals", {
        tenant: TENANT, issue_ref: issue.id, employee: emp, store: issue.store,
        reason, status, submitted_at: now.toISOString(), reviewed_at: status === "PENDING" || status === "NEEDS_MORE_INFO" ? "" : now.toISOString(),
        demo: true,
      }).catch(() => {})
  }

  // 7. 整改: PENDING/SUBMITTED/NEEDS_REVISION/OVERDUE/CONFIRMED
  const rectPlans = [
    ["PENDING", "2026-09-30T00:00:00.000Z"], ["SUBMITTED", "2026-09-30T00:00:00.000Z"],
    ["NEEDS_REVISION", "2026-09-30T00:00:00.000Z"], ["OVERDUE", "2026-07-01T00:00:00.000Z"],
    ["CONFIRMED", "2026-08-10T00:00:00.000Z"],
  ]
  for (let i = 0; i < pushedIssues.length && i < 15; i++) {
    const issue = pushedIssues[i]
    const [status, due] = rectPlans[i % rectPlans.length]
    const title = `整改任务 ${i + 1}`
    await findOne("rectifications", `issue='${issue.id}' && status='${status}'`) ||
      await create("rectifications", {
        tenant: TENANT, issue: issue.id, employee: issue.employee, store: issue.store,
        title, remediation_type: "training", requirements: "学习合规话术并回听录音", due_at: due, status,
        submission_text: status === "PENDING" || status === "OVERDUE" ? "" : "已学习合规手册并整改话术",
        submitted_at: status === "SUBMITTED" || status === "NEEDS_REVISION" || status === "CONFIRMED" ? now.toISOString() : "",
        confirmed_at: status === "CONFIRMED" ? now.toISOString() : "",
        confirmation_comment: status === "CONFIRMED" ? "整改符合要求" : status === "NEEDS_REVISION" ? "请补充培训记录" : "",
        retry_count: status === "NEEDS_REVISION" ? 1 : 0, demo: true,
      }).catch(() => {})
  }

  // 8. notifications / audit_logs / processing_jobs
  for (let i = 0; i < 8; i++) {
    const empUser = empUsers[i % empUsers.length]
    const emp = employees[i % employees.length]
    await findOne("notifications", `employee='${emp.id}' && title='演示通知 ${i + 1}'`) ||
      await create("notifications", {
        tenant: TENANT, user: empUser.id, employee: emp.id, title: `演示通知 ${i + 1}`,
        body: "您有一条疑似问题需要关注（演示数据）", type: "issue_pushed",
        link: "/employee/issues", is_read: i % 3 === 0, demo: true,
      }).catch(() => {})
  }
  for (let i = 0; i < 6; i++) {
    await create("audit_logs", {
      tenant: TENANT, actor: admin.id, actor_name: "演示管理员", actor_type: "user",
      action: i % 2 === 0 ? "report_export" : "user_login", target_type: i % 2 === 0 ? "issues" : "app_users",
      target_id: i % 2 === 0 ? "" : admin.id, detail_json: { demo: true }, ip: "127.0.0.1", demo: true,
    }).catch(() => {})
  }
  const jobPlans = [
    ["SUCCEEDED", 1], ["SUCCEEDED", 1], ["FAILED", 3], ["QUEUED", 0], ["RETRYING", 2],
  ]
  for (let i = 0; i < jobPlans.length; i++) {
    const [status, attempts] = jobPlans[i]
    const key = `demo-job-${i + 1}`
    await findOne("processing_jobs", `idempotency_key='${key}'`) ||
      await create("processing_jobs", {
        tenant: TENANT, job_type: "RISK_ANALYSIS", business_key: sessionIds[i % sessionIds.length],
        idempotency_key: key, status, priority: 1, attempts, max_attempts: 3,
        error_message: status === "FAILED" ? "模拟失败(演示数据)" : "",
        payload_json: { session: sessionIds[i % sessionIds.length] }, demo: true,
      }).catch(() => {})
  }

  // 9. Mock 全链路样本 (1 条): 读取 fixture 转写, 建会话+分段, 入队 RISK_ANALYSIS
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const fixture = JSON.parse(readFileSync(path.join(__dirname, "../tests/fixtures/transcripts/sample.json"), "utf8"))
    const sampleDevice = devices[0]
    const sampleEmp = employees[0]
    const sampleSession = await findOne("sessions", `device_sn='${sampleDevice.device_no}' && status='SAMPLE_E2E'`)
    let sampleSessionId = sampleSession ? sampleSession.id : null
    if (!sampleSessionId) {
      const rec = await create("sessions", {
        tenant: TENANT, employee: sampleEmp.id, store: sampleEmp.store, device_sn: sampleDevice.device_no,
        status: "SAMPLE_E2E", started_at: now.toISOString(), duration_ms: 60000,
        transcript_version: 1, version: 1, demo: true,
      })
      sampleSessionId = rec.id
      const segs = Array.isArray(fixture.segments) ? fixture.segments : []
      for (let s = 0; s < segs.length; s++) {
        await create("transcript_segments", {
          tenant: TENANT, session: sampleSessionId, version: 1, sequence: s,
          start_ms: segs[s].start_ms || 0, end_ms: segs[s].end_ms || 0,
          speaker: segs[s].speaker || "S1", speaker_role: segs[s].speaker_role || "staff",
          text: segs[s].text || "", confidence: segs[s].confidence || 0.9, demo: true,
        }).catch(() => {})
      }
    }
    const sampleJobKey = "demo-e2e-sample-v1"
    const existingJob = await findOne("processing_jobs", `idempotency_key='${sampleJobKey}'`)
    if (!existingJob) {
      await create("processing_jobs", {
        tenant: TENANT, job_type: "RISK_ANALYSIS", business_key: sampleSessionId,
        idempotency_key: sampleJobKey, status: "QUEUED", priority: 10, attempts: 0, max_attempts: 3,
        payload_json: { session: sampleSessionId, note: "demo e2e sample" }, demo: true,
      })
    }
    console.log(`[seed] Mock 全链路样本 session=${sampleSessionId} (已入队分析任务)`)
  } catch (err) {
    console.warn(`[seed] Mock 全链路样本生成失败(可忽略): ${err.message}`)
  }

  // 10. 完成标记
  await findOrCreate("app_settings", `key='${DEMO_MARKER_KEY}'`, { tenant: TENANT, key: DEMO_MARKER_KEY, value: DEMO_MARKER_VALUE, demo: true })
  console.log(`[seed] 完成 tenant=${TENANT} stores=${stores.length} employees=${employees.length} devices=${devices.length} rules=${rules.length} sessions=${SESSION_N} issues=${issues.length}`)
  console.log("[seed] 提示: 全部演示数据均标记 demo=true; 生产环境拒绝执行。")
}

let SUPER_TOKEN = ""
main().catch((err) => {
  console.error(`[seed] 失败: ${err.message}`)
  process.exit(1)
})
