// server/business-worker.mjs — 一期业务 Worker (Node.js, 支持独立运行与内嵌至 ASR Gateway 运行)
//
// 任务来源: PocketBase processing_jobs 表 (数据库任务表, 不使用 Redis)
// 领取:     POST /api/yuqi/internal/jobs/claim  (原子领取 + 锁超时恢复)
// 回写:     success / retry(指数退避) / fail
//
// 支持任务类型:
//   RISK_ANALYSIS        规则风险分析 (加载会话/片段/规则 → analyzeRisk → analysis/apply)
//   SLA_SCAN             整改逾期扫描 (due_at 已过且未关闭 → OVERDUE)
//   NOTIFICATION_DISPATCH 通知派发占位 (一期直接 SUCCEEDED)
//   RETENTION_CHECK      保留策略检查占位
//   OSS_RECONCILIATION   OSS 对账占位 (oss-scanner 已覆盖每日对账)
//
// 环境变量:
//   YUQI_PB_URL            默认 http://127.0.0.1:7040
//   YUQI_SERVICE_TOKEN     必填 (与 PB 侧 YUQI_SERVICE_TOKEN 一致, 不提交 Git)
//   YUQI_WORKER_POLL_MS    轮询间隔, 默认 5000
//   YUQI_WORKER_LOCK_MS    任务锁超时, 默认 300000 (5 分钟)

import { analyzeRisk } from "./rule-analyzer.mjs"
import { fileURLToPath } from "node:url"
import path from "node:path"

let workerLoopRunning = false
let workerLoopStopRequested = false
let workerLoopPromise = null

function getPbUrl() {
  return String(
    process.env.YUQI_PB_URL ||
    process.env.POCKETBASE_URL ||
    "http://127.0.0.1:7040"
  ).replace(/\/+$/, "")
}

function getServiceToken() {
  return String(process.env.YUQI_SERVICE_TOKEN || "")
}

function isExecutedDirectly() {
  if (!process.argv[1]) return false
  try {
    return path.resolve(process.argv[1]).toLowerCase() === path.resolve(fileURLToPath(import.meta.url)).toLowerCase()
  } catch (_) {
    return false
  }
}

function isWorkerLoopRunning() {
  return workerLoopRunning
}

function stopWorkerLoop() {
  workerLoopStopRequested = true
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function redact(text) {
  return String(text || "").replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]").slice(0, 500)
}

async function api(method, path, body) {
  const pbUrl = getPbUrl()
  const serviceToken = getServiceToken()
  const workerId = String(process.env.YUQI_WORKER_ID || `worker-${process.pid}`)
  const res = await fetch(`${pbUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Yuqi-Service-Token": serviceToken,
      "X-Yuqi-Worker-Id": workerId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data = null
  try {
    data = JSON.parse(text)
  } catch (_) {
    data = { raw: text.slice(0, 200) }
  }
  if (!res.ok) {
    const err = new Error(`PB ${method} ${path} -> ${res.status}: ${redact(data && (data.message || data.error))}`)
    err.status = res.status
    throw err
  }
  return data
}

async function claim() {
  const workerId = String(process.env.YUQI_WORKER_ID || `worker-${process.pid}`)
  const lockMs = Number(process.env.YUQI_WORKER_LOCK_MS || 300000)
  const data = await api("POST", "/api/yuqi/internal/jobs/claim", { worker_id: workerId, lock_ms: lockMs })
  return data && data.claimed ? data.job : null
}

// ---- 任务执行 ----

async function handleRiskAnalysis(job) {
  const payload = job.payload_json || {}
  const sessionId = String(payload.session_id || "")
  if (!sessionId) throw new Error("缺少 session_id")

  const session = await api("GET", `/api/sessions/${sessionId}`)
  const transcriptVersion = Number(payload.transcript_version) || Number(session.transcript_version) || 0
  const analysisVersion = Number(payload.analysis_version) || Number(session.version) || 1

  const segList = await api("GET", `/api/transcript_segments?session=${encodeURIComponent(sessionId)}&perPage=500`)
  const segments = Array.isArray(segList.items) ? segList.items : []

  const ruleList = await api("GET", "/api/risk_rules?enabled=true&perPage=500")
  const rules = Array.isArray(ruleList.items) ? ruleList.items : []

  const result = analyzeRisk({
    session,
    segments,
    rules,
    analysisVersion,
    transcriptVersion,
  })

  if (result.issues.length === 0) {
    // 未命中不写"无问题": 仅记录分析完成, 不生成任何风险记录
    return { analyzed: true, issues: 0 }
  }

  const applied = await api("POST", "/api/yuqi/internal/analysis/apply", {
    session_id: sessionId,
    transcript_version: transcriptVersion,
    analysis_version: analysisVersion,
    results: result.issues,
  })
  return { analyzed: true, ...applied }
}

async function handleSlaScan(job) {
  const nowIso = new Date().toISOString()
  const open = await api("GET", "/api/rectifications?status=PENDING&perPage=500")
  const submitted = await api("GET", "/api/rectifications?status=SUBMITTED&perPage=500")
  const revising = await api("GET", "/api/rectifications?status=NEEDS_REVISION&perPage=500")
  const rows = []
    .concat(open.items || [], submitted.items || [], revising.items || [])
    .filter((r) => r.due_at && String(r.due_at).replace(" ", "T") < nowIso && r.status !== "OVERDUE")

  let marked = 0
  for (const r of rows) {
    try {
      await api("PATCH", `/api/rectifications/${r.id}`, { status: "OVERDUE" })
      marked++
    } catch (err) {
      console.warn(`[worker] SLA_SCAN patch ${r.id} failed: ${redact(err.message)}`)
    }
  }
  return { checked: rows.length, marked }
}

async function handleNoop(job) {
  // 一期占位: 记录并视为成功 (避免任务堆积)
  return { noop: true, job_type: job.job_type }
}

async function executeJob(job) {
  switch (job.job_type) {
    case "RISK_ANALYSIS":
      return handleRiskAnalysis(job)
    case "SLA_SCAN":
      return handleSlaScan(job)
    case "NOTIFICATION_DISPATCH":
    case "RETENTION_CHECK":
    case "OSS_RECONCILIATION":
      return handleNoop(job)
    default:
      throw new Error(`未知任务类型: ${job.job_type}`)
  }
}

// ---- 主循环 ----

async function runOnce() {
  let job = null
  try {
    job = await claim()
  } catch (err) {
    console.error(`[worker] claim 失败: ${redact(err.message)}`)
    return false
  }
  if (!job) return false

  try {
    const result = await executeJob(job)
    await api("POST", `/api/yuqi/internal/jobs/${job.id}/success`, { result_json: result })
    console.log(`[worker] ${job.job_type} ${job.id} SUCCEEDED`)
  } catch (err) {
    const message = redact(err.message)
    console.error(`[worker] ${job.job_type} ${job.id} ERROR: ${message}`)
    try {
      const attempts = Number(job.attempts || 1)
      const maxAttempts = Number(job.max_attempts || 3)
      if (attempts >= maxAttempts) {
        await api("POST", `/api/yuqi/internal/jobs/${job.id}/fail`, { error_code: "MAX_ATTEMPTS", error_message: message })
      } else {
        await api("POST", `/api/yuqi/internal/jobs/${job.id}/retry`, { error_code: "WORKER_ERROR", error_message: message })
      }
    } catch (err2) {
      console.error(`[worker] 回写任务状态失败: ${redact(err2.message)}`)
    }
  }
  return true
}

function startWorkerLoop(options = {}) {
  if (workerLoopRunning) {
    console.log("[worker] Worker loop 已在运行中，跳过重复启动")
    return workerLoopPromise
  }

  workerLoopRunning = true
  workerLoopStopRequested = false

  const pollMs = Number(options.pollMs || process.env.YUQI_WORKER_POLL_MS || 5000)
  const lockMs = Number(options.lockMs || process.env.YUQI_WORKER_LOCK_MS || 300000)
  const workerId = String(options.workerId || process.env.YUQI_WORKER_ID || `worker-${process.pid}`)
  const pbUrl = getPbUrl()

  console.log(`[worker] 启动 worker=${workerId} pb=${pbUrl} poll=${pollMs}ms lock=${lockMs}ms`)

  workerLoopPromise = (async () => {
    try {
      while (!workerLoopStopRequested) {
        let processed = false
        try {
          processed = await runOnce()
        } catch (err) {
          console.error(`[worker] runOnce 未捕获异常: ${redact(err && err.message || err)}`)
        }
        if (workerLoopStopRequested) break

        // 有任务处理时快速排空 (200ms), 无任务时按 pollMs (默认 5s) 休眠
        const delay = processed ? (options.drainDelayMs ?? 200) : pollMs
        await sleep(delay)
      }
    } finally {
      workerLoopRunning = false
      workerLoopPromise = null
      console.log("[worker] Worker loop 已安全退出")
    }
  })()

  return workerLoopPromise
}

if (isExecutedDirectly()) {
  const token = getServiceToken()
  if (!token) {
    console.error("[worker] 缺少 YUQI_SERVICE_TOKEN, 退出")
    process.exit(1)
  }
  startWorkerLoop().catch((err) => {
    console.error(`[worker] 致命错误: ${redact(err && err.stack || err)}`)
    process.exit(1)
  })
}

export {
  executeJob,
  handleRiskAnalysis,
  handleSlaScan,
  runOnce,
  claim,
  api,
  startWorkerLoop,
  stopWorkerLoop,
  isWorkerLoopRunning,
  getPbUrl,
  getServiceToken,
  isExecutedDirectly,
}
