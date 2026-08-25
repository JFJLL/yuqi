import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto"
import http from "node:http"
import https from "node:https"
import { Transform } from "node:stream"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const HOST = process.env.YUQI_ASR_GATEWAY_HOST || "127.0.0.1"
const PORT = numberEnv("YUQI_ASR_GATEWAY_PORT", 18084)
const POCKETBASE_URL = trimTrailingSlash(process.env.POCKETBASE_URL || "http://127.0.0.1:7040")
const ASR_BASE_URL = trimTrailingSlash(process.env.ASR_BASE_URL || "")
const ASR_SERVICE_TOKEN = process.env.ASR_SERVICE_TOKEN || ""
// 内部服务身份: 所有写 PocketBase 的请求必须携带 (与 PB 侧 YUQI_SERVICE_TOKEN 一致, 不提交 Git)
const YUQI_SERVICE_TOKEN = process.env.YUQI_SERVICE_TOKEN || ""
// 上传令牌密钥 (与 PB 侧 YUQI_UPLOAD_TOKEN_SECRET 一致) + Mock 模式开关
function getUploadTokenSecret() {
  return process.env.YUQI_UPLOAD_TOKEN_SECRET || ""
}
const ASR_MOCK = String(process.env.YUQI_ASR_MOCK || "") === "1"
const ASR_INSECURE_UPLOAD = String(process.env.YUQI_ASR_INSECURE_UPLOAD || "") === "1"
const MAX_UPLOAD_BYTES = numberEnv("YUQI_ASR_MAX_UPLOAD_MB", 200) * 1024 * 1024
const POLL_INTERVAL_MS = numberEnv("YUQI_ASR_POLL_INTERVAL_MS", 5000)
const MAX_POLL_JOBS = numberEnv("YUQI_ASR_MAX_POLL_JOBS", 100)
const REQUEST_TIMEOUT_MS = numberEnv("YUQI_ASR_REQUEST_TIMEOUT_MS", 60_000)
const ALLOWED_EXTENSIONS = new Set([".wav", ".mp3", ".m4a", ".flac", ".ogg", ".aac", ".webm"])

let pollInFlight = false
let gatewayStarted = false

function numberEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "")
}

function pbDate(now = new Date()) {
  return now.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "Z")
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })
  res.end(JSON.stringify(body))
}

function safeMessage(error, fallback = "请求失败") {
  const text = String(error?.message || error || fallback)
  return text.replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]").slice(0, 500)
}

function asrConfigured() {
  return Boolean(ASR_BASE_URL && ASR_SERVICE_TOKEN)
}

function assertAsrConfigured(res) {
  if (asrConfigured()) return true
  json(res, 503, {
    error: "asr_not_configured",
    message: "ASR 网关尚未配置 ASR_BASE_URL 和 ASR_SERVICE_TOKEN",
  })
  return false
}

function extensionOf(filename) {
  const clean = String(filename || "").trim().replace(/[\\/]/g, "_")
  const dot = clean.lastIndexOf(".")
  return dot >= 0 ? clean.slice(dot).toLowerCase() : ""
}

function safeFilename(filename) {
  const clean = String(filename || "audio").trim().replace(/[\\/\x00-\x1f\x7f]/g, "_")
  return clean.slice(0, 180) || "audio"
}

function readJsonHeader(req, headerName) {
  const raw = req.headers[headerName]
  if (!raw) return {}
  if (Array.isArray(raw) || raw.length > 10_000) throw new Error(`${headerName} 无效`)
  let decoded = raw
  try { decoded = decodeURIComponent(raw) } catch (_) { throw new Error(`${headerName} 编码无效`) }
  const parsed = JSON.parse(decoded)
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error(`${headerName} 必须是 JSON 对象`)
  return parsed
}

function transportFor(url) {
  return url.protocol === "https:" ? https : http
}

function requestBuffer(urlString, { method = "GET", headers = {}, body } = {}) {
  const url = new URL(urlString)
  return new Promise((resolve, reject) => {
    const request = transportFor(url).request(
      url,
      { method, headers, timeout: REQUEST_TIMEOUT_MS },
      (response) => {
        const chunks = []
        response.on("data", (chunk) => chunks.push(chunk))
        response.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8")
          let data = null
          try {
            data = raw ? JSON.parse(raw) : null
          } catch {
            data = { raw: raw.slice(0, 1000) }
          }
          resolve({ status: response.statusCode || 500, data })
        })
      },
    )
    request.on("timeout", () => request.destroy(new Error("请求超时")))
    request.on("error", reject)
    if (body) request.write(body)
    request.end()
  })
}

async function pbRequest(path, { method = "GET", body } = {}) {
  const response = await requestBuffer(`${POCKETBASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      "X-Yuqi-Service-Token": YUQI_SERVICE_TOKEN,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (response.status < 200 || response.status >= 300) {
    const detail = response.data?.message || response.data?.error || `HTTP ${response.status}`
    throw new Error(`PocketBase ${method} ${path}: ${detail}`)
  }
  return response.data
}

// ---- 上传令牌 (短期、一次性) ----
// 浏览器先登录向 PB 申请短期上传 Token, 网关验证签名/用途/有效期, 并由 PB 消费 nonce 防重放。
function safeSignatureEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false
  const bufA = Buffer.from(a, "utf8")
  const bufB = Buffer.from(b, "utf8")
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

function verifyUploadToken(token) {
  const secret = getUploadTokenSecret()
  if (!secret) return { ok: false, reason: "上传令牌密钥未配置" }
  const parts = String(token || "").split(".")
  if (parts.length !== 3) return { ok: false, reason: "令牌格式无效" }
  try {
    const dec = (p) => Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    const payload = JSON.parse(dec(parts[1]))
    const sig = createHmac("sha256", secret)
      .update(`${parts[0]}.${parts[1]}`)
      .digest("base64")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    if (!safeSignatureEqual(sig, parts[2])) return { ok: false, reason: "令牌签名无效" }
    if (payload.action !== "asr_upload") return { ok: false, reason: "令牌用途不符" }
    if (!payload.exp || Number(payload.exp) * 1000 < Date.now()) return { ok: false, reason: "令牌已过期" }
    return { ok: true, user: String(payload.user || ""), tenant: String(payload.tenant || ""), nonce: String(payload.nonce || "") }
  } catch (_) {
    return { ok: false, reason: "令牌解析失败" }
  }
}

async function consumeUploadToken(nonce) {
  const data = await pbRequest("/api/yuqi/internal/upload-token/consume", { method: "POST", body: { nonce } })
  return data
}

// ---- Mock 转写 (仅测试环境) ----
function mockTranscript() {
  const segments = [
    { text: "这个药包治百病，保证好，帮你刷医保没问题。", start_ms: 1000, end_ms: 5000, speaker: "店员" },
    { text: "那给我多买几盒囤一点。", start_ms: 6000, end_ms: 8000, speaker: "顾客" },
    { text: "好的，您稍等，我帮您拿。", start_ms: 9000, end_ms: 12000, speaker: "店员" },
  ]
  return {
    fullText: segments.map((s) => s.text).join("\n"),
    segments,
    model: "mock-asr",
  }
}

function loadMockResult() {
  try {
    const file = path.join(process.cwd(), "tests", "fixtures", "transcripts", "sample.json")
    if (existsSync(file)) {
      const data = JSON.parse(readFileSync(file, "utf8"))
      if (data && Array.isArray(data.segments) && data.segments.length > 0) {
        return { fullText: String(data.full_text || data.fullText || ""), segments: data.segments, model: "fixture-asr" }
      }
    }
  } catch (_) {}
  return mockTranscript()
}

// ---- 会话/片段/分析任务 (转写成功后) ----
async function persistSessionAndSegments(job, result) {
  const transcriptId = String(job.transcript || "")
  // 1. 会话: 一期 audio_files 与 session 1:1 (按 transcript 幂等查找)
  let session = null
  try {
    const existing = await pbRequest(`/api/sessions?transcript=${encodeURIComponent(transcriptId)}&perPage=5`)
    session = existing?.items?.length > 0 ? existing.items[0] : null
  } catch (_) {
    session = null
  }
  const sessionBody = {
    transcript: transcriptId,
    device_sn: job.device || "",
    device: String(job.device || ""),
    employee: job.employee || "",
    store: job.store || "",
    status: "TRANSCRIBED",
    transcript_version: 1,
    version: 1,
  }
  if (!session) {
    session = await pbRequest("/api/sessions", { method: "POST", body: sessionBody })
  } else {
    session = await pbRequest(`/api/sessions/${encodeURIComponent(session.id)}`, { method: "PATCH", body: { status: "TRANSCRIBED" } })
  }
  const sessionId = String(session.id || "")

  // 2. transcript_segments (幂等: 跳过已存在的 sequence)
  let existing = { items: [] }
  try {
    existing = await pbRequest(`/api/transcript_segments?session=${encodeURIComponent(sessionId)}&version=1&perPage=500`)
  } catch (_) {}
  const seenSeq = new Set((existing.items || []).map((s) => Number(s.sequence)))
  const segments = Array.isArray(result.segments) ? result.segments : []
  let written = 0
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i] || {}
    if (seenSeq.has(i + 1)) continue
    await pbRequest("/api/transcript_segments", {
      method: "POST",
      body: {
        session: sessionId,
        transcript: transcriptId,
        version: 1,
        sequence: i + 1,
        start_ms: Number(seg.start_ms) || 0,
        end_ms: Number(seg.end_ms) || 0,
        speaker: String(seg.speaker || "unknown").slice(0, 60),
        text: String(seg.text || "").slice(0, 5000),
        confidence: Number(seg.confidence) || 1,
      },
    })
    written++
  }

  // 3. 自动创建 RISK_ANALYSIS 任务 (幂等键: ra-<session>-<version>)
  await pbRequest("/api/yuqi/internal/jobs/enqueue", {
    method: "POST",
    body: {
      job_type: "RISK_ANALYSIS",
      business_key: sessionId,
      idempotency_key: `ra-${sessionId}-1`,
      payload_json: { session_id: sessionId, transcript_version: 1, analysis_version: 1 },
    },
  })
  return { sessionId, segments_written: written }
}

async function writeSyncLog(type, object, store, status, result) {
  try {
    await pbRequest("/api/sync_logs", {
      method: "POST",
      body: { type, object, store: store || "", status, result: String(result || "").slice(0, 300), occurred_at: pbDate() },
    })
  } catch (error) {
    console.error(`[asr-gateway] sync log write failed: ${safeMessage(error)}`)
  }
}

function asrHeaders(extra = {}) {
  return { Authorization: `Bearer ${ASR_SERVICE_TOKEN}`, ...extra }
}

async function asrJson(path, options = {}) {
  const response = await requestBuffer(`${ASR_BASE_URL}${path}`, {
    ...options,
    headers: asrHeaders(options.headers || {}),
  })
  if (response.status < 200 || response.status >= 300) {
    const detail = response.data?.detail || response.data?.message || response.data?.error || `HTTP ${response.status}`
    const error = new Error(`ASR ${options.method || "GET"} ${path}: ${detail}`)
    error.status = response.status
    error.payload = response.data
    throw error
  }
  return response.data
}

function forwardAudioToAsr(req, filename, metadata) {
  const remoteUrl = new URL(`${ASR_BASE_URL}/v1/jobs`)
  const boundary = `----yuqi-asr-${randomUUID()}`
  const safeName = safeFilename(filename)
  const contentType = String(req.headers["content-type"] || "application/octet-stream").split(";")[0]
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="metadata"\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${safeName.replace(/"/g, "_")}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
    "utf8",
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8")

  return new Promise((resolve, reject) => {
    const remote = transportFor(remoteUrl).request(
      remoteUrl,
      {
        method: "POST",
        headers: asrHeaders({
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Transfer-Encoding": "chunked",
        }),
        timeout: REQUEST_TIMEOUT_MS,
      },
      (response) => {
        const chunks = []
        response.on("data", (chunk) => chunks.push(chunk))
        response.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8")
          let data = null
          try {
            data = raw ? JSON.parse(raw) : null
          } catch {
            data = { raw: raw.slice(0, 1000) }
          }
          if ((response.statusCode || 500) >= 200 && (response.statusCode || 500) < 300) {
            resolve(data)
          } else {
            reject(new Error(`ASR POST /v1/jobs: ${data?.detail || data?.message || data?.error || `HTTP ${response.statusCode}`}`))
          }
        })
      },
    )
    let total = 0
    const hasher = createHash("sha256")
    const limiter = new Transform({
      transform(chunk, _encoding, callback) {
        total += chunk.length
        if (total > MAX_UPLOAD_BYTES) {
          callback(new Error(`音频文件超过 ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB 限制`))
          return
        }
        hasher.update(chunk)
        callback(null, chunk)
      },
    })
    const fail = (error) => {
      remote.destroy(error)
      reject(error)
    }
    remote.on("timeout", () => fail(new Error("提交 ASR 任务超时")))
    remote.on("error", fail)
    req.on("error", fail)
    limiter.on("error", fail)
    limiter.on("end", () => remote.end(tail))
    remote.write(head)
    req.pipe(limiter).pipe(remote, { end: false })
    remote.once("close", () => {
      // 请求正常完成由 response/end 处理；异常 close 已由 error 处理。
    })
    remote.once("finish", () => {
      // 这里不 resolve，必须等待 ASR 的 HTTP 响应。
    })
    remote._yuqiUploadInfo = () => ({ size: total, sha256: hasher.digest("hex") })
    limiter.on("end", () => {
      remote._yuqiUploadInfo = () => ({ size: total, sha256: hasher.digest("hex") })
    })
  })
}

function normalizeResult(payload) {
  const records = Array.isArray(payload?.result) ? payload.result : []
  const segments = []
  const textParts = []
  for (const record of records) {
    if (!record || typeof record !== "object") continue
    const recordText = String(record.text || record.preds || "").trim()
    if (recordText) textParts.push(recordText)
    const sentenceInfo = Array.isArray(record.sentence_info) ? record.sentence_info : []
    for (const sentence of sentenceInfo) {
      if (!sentence || typeof sentence !== "object") continue
      const text = String(sentence.text || "").trim()
      if (!text) continue
      const start = sentence.start ?? sentence.begin ?? null
      const end = sentence.end ?? null
      segments.push({
        text,
        start_ms: Number.isFinite(Number(start)) ? Number(start) : null,
        end_ms: Number.isFinite(Number(end)) ? Number(end) : null,
        speaker: String(sentence.spk ?? sentence.speaker ?? "unknown"),
      })
    }
  }
  const fullText = textParts.join("\n").trim() || segments.map((segment) => segment.text).join("\n").trim()
  return { fullText, segments, model: String(payload?.model || "") }
}

async function importSucceededJob(job, remoteState) {
  if (job.result_imported_at) return
  let result = null
  if (ASR_MOCK) {
    result = loadMockResult()
  } else {
    const payload = await asrJson(`/v1/jobs/${encodeURIComponent(job.remote_job_id)}/result`)
    result = normalizeResult(payload)
  }
  const transcriptId = String(job.transcript || "")
  if (!transcriptId) throw new Error("ASR 任务缺少 transcript 关联")
  await pbRequest(`/api/transcripts/${encodeURIComponent(transcriptId)}`, {
    method: "PATCH",
    body: {
      full_text: result.fullText,
      summary: result.fullText.slice(0, 500),
      segments_json: result.segments,
      asr_status: "succeeded",
      model: result.model,
      audio_name: job.audio_name || remoteState.original_filename || "",
    },
  })
  await pbRequest(`/api/asr_jobs/${encodeURIComponent(job.id)}`, {
    method: "PATCH",
    body: {
      status: "succeeded",
      started_at: remoteState.started_at || job.started_at || "",
      finished_at: remoteState.completed_at || pbDate(),
      attempts: Number(remoteState.attempts || job.attempts || 0),
      result_imported_at: pbDate(),
      error_code: "",
      error_message: "",
    },
  })
  // 新链路: 会话 + 转写分段 + 自动风险分析任务
  try {
    const info = await persistSessionAndSegments(job, result)
    console.log(`[asr-gateway] session ${info.sessionId} ready, segments written=${info.segments_written}, analysis enqueued`)
  } catch (error) {
    console.error(`[asr-gateway] session/segments/enqueue failed: ${safeMessage(error)}`)
  }
  await writeSyncLog("ASR结果", job.id, job.store, "成功", `转写完成：${result.segments.length} 个分段`)
}

async function syncOneJob(job) {
  if (!job?.remote_job_id || !job?.id) return
  const remote = await asrJson(`/v1/jobs/${encodeURIComponent(job.remote_job_id)}`)
  const status = String(remote.status || "").toLowerCase()
  if (!["queued", "running", "succeeded", "failed"].includes(status)) throw new Error(`ASR 返回未知状态：${status || "empty"}`)
  const patch = {
    status,
    last_polled_at: pbDate(),
    started_at: remote.started_at || job.started_at || "",
    finished_at: remote.completed_at || (status === "failed" ? pbDate() : job.finished_at || ""),
    attempts: Number(remote.attempts || job.attempts || 0),
    error_code: status === "failed" ? "asr_failed" : "",
    error_message: status === "failed" ? String(remote.error || "ASR 转写失败").slice(0, 1000) : "",
  }
  if (status === "succeeded") {
    await importSucceededJob(job, remote)
    return
  }
  await pbRequest(`/api/asr_jobs/${encodeURIComponent(job.id)}`, { method: "PATCH", body: patch })
  if (status === "failed" && job.status !== "failed") {
    await pbRequest(`/api/transcripts/${encodeURIComponent(job.transcript)}`, {
      method: "PATCH",
      body: { asr_status: "failed" },
    })
    await writeSyncLog("ASR结果", job.id, job.store, "失败", patch.error_message)
  }
}

async function pollJobs() {
  if (pollInFlight || !asrConfigured()) return
  pollInFlight = true
  try {
    const data = await pbRequest(`/api/asr_jobs?active=1&perPage=${MAX_POLL_JOBS}`)
    const jobs = Array.isArray(data?.items) ? data.items : []
    for (const job of jobs) {
      try {
        await syncOneJob(job)
      } catch (error) {
        console.error(`[asr-gateway] job ${job?.id || "unknown"} poll failed: ${safeMessage(error)}`)
      }
    }
  } catch (error) {
    console.error(`[asr-gateway] poll failed: ${safeMessage(error)}`)
  } finally {
    pollInFlight = false
  }
}

async function handleSubmit(req, res) {
  // 上传令牌校验: 浏览器先向 PB 申请短期一次性上传令牌 (仅 YUQI_ASR_INSECURE_UPLOAD=1 可旁路, 仅限本地测试)
  if (!ASR_INSECURE_UPLOAD) {
    const uploadToken = String(req.headers["x-yuqi-upload-token"] || "")
    const check = verifyUploadToken(uploadToken)
    if (!check.ok) {
      json(res, 403, { error: "upload_token_invalid", message: check.reason })
      return
    }
    try {
      await consumeUploadToken(check.nonce)
    } catch (error) {
      json(res, 403, { error: "upload_token_used", message: "令牌已使用或无效" })
      return
    }
  }
  if (!ASR_MOCK && !assertAsrConfigured(res)) return
  let requestedFilename = String(req.headers["x-yuqi-audio-name"] || "audio")
  try { requestedFilename = decodeURIComponent(requestedFilename) } catch (_) {
    json(res, 400, { error: "invalid_filename", message: "音频文件名编码无效" })
    return
  }
  const filename = safeFilename(requestedFilename)
  const extension = extensionOf(filename)
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    json(res, 400, { error: "unsupported_audio", message: `仅支持 ${[...ALLOWED_EXTENSIONS].join("、")} 音频格式` })
    return
  }
  const declaredLength = Number(req.headers["content-length"] || 0)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES) {
    json(res, 413, { error: "upload_too_large", message: `音频文件不能超过 ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB` })
    return
  }
  let metadata
  try {
    metadata = readJsonHeader(req, "x-yuqi-asr-metadata")
  } catch (error) {
    json(res, 400, { error: "invalid_metadata", message: safeMessage(error) })
    return
  }
  const device = String(metadata.device || "").slice(0, 60)
  const employee = String(metadata.employee || "")
  const store = String(metadata.store || "")
  const occurredAt = String(metadata.occurred_at || pbDate())
  const asrMetadata = {
    device,
    employee,
    store,
    language: String(metadata.language || "zh-CN"),
    hotwords: metadata.hotwords,
  }
  try {
    if (ASR_MOCK) {
      // Mock 模式: 不调用真实 ASR, 直接生成固定转写并走同一套落库链路
      const transcript = await pbRequest("/api/transcripts", {
        method: "POST",
        body: {
          device,
          employee,
          store,
          summary: "音频已提交（Mock 转写）",
          full_text: "",
          qc_result: "",
          occurred_at: occurredAt,
          asr_status: "queued",
          audio_name: filename,
          source: "manual",
        },
      })
      const job = await pbRequest("/api/asr_jobs", {
        method: "POST",
        body: {
          remote_job_id: `mock-${randomUUID().replace(/-/g, "").slice(0, 32)}`,
          transcript: transcript.id,
          status: "succeeded",
          device,
          employee,
          store,
          audio_name: filename,
          audio_size: declaredLength || 0,
          metadata_json: asrMetadata,
          submitted_at: pbDate(),
          occurred_at: occurredAt,
        },
      })
      await pbRequest(`/api/transcripts/${encodeURIComponent(transcript.id)}`, {
        method: "PATCH",
        body: { asr_job: job.id },
      })
      await importSucceededJob(job, {})
      await writeSyncLog("ASR提交(Mock)", job.id, store, "成功", `已提交 ${filename} (Mock 转写)`)
      json(res, 202, { job, transcript, mock: true })
      return
    }
    const remote = await forwardAudioToAsr(req, filename, asrMetadata)
    const remoteJobId = String(remote?.job_id || "")
    if (!/^[0-9a-f]{32}$/i.test(remoteJobId)) throw new Error("ASR 返回的 job_id 无效")
    const transcript = await pbRequest("/api/transcripts", {
      method: "POST",
      body: {
        device,
        employee,
        store,
        summary: "音频已提交，等待转写",
        full_text: "",
        qc_result: "",
        occurred_at: occurredAt,
        asr_status: "queued",
        audio_name: filename,
        source: "manual",
      },
    })
    const job = await pbRequest("/api/asr_jobs", {
      method: "POST",
      body: {
        remote_job_id: remoteJobId,
        transcript: transcript.id,
        status: String(remote.status || "queued").toLowerCase(),
        device,
        employee,
        store,
        audio_name: filename,
        audio_size: declaredLength || 0,
        metadata_json: asrMetadata,
        submitted_at: pbDate(),
        occurred_at: occurredAt,
      },
    })
    await pbRequest(`/api/transcripts/${encodeURIComponent(transcript.id)}`, {
      method: "PATCH",
      body: { asr_job: job.id },
    })
    await writeSyncLog("ASR提交", job.id, store, "成功", `已提交 ${filename}`)
    json(res, 202, { job, transcript })
    void pollJobs()
  } catch (error) {
    console.error(`[asr-gateway] submit failed: ${safeMessage(error)}`)
    json(res, 502, { error: "asr_submit_failed", message: safeMessage(error, "ASR 任务提交失败") })
  }
}

async function handleRetry(res, jobId) {
  if (!assertAsrConfigured(res)) return
  try {
    const job = await pbRequest(`/api/asr_jobs/${encodeURIComponent(jobId)}`)
    if (!job?.remote_job_id) throw new Error("任务不存在或缺少远端任务 ID")
    const remote = await asrJson(`/v1/jobs/${encodeURIComponent(job.remote_job_id)}/retry`, { method: "POST" })
    const updated = await pbRequest(`/api/asr_jobs/${encodeURIComponent(jobId)}`, {
      method: "PATCH",
      body: { status: String(remote.status || "queued").toLowerCase(), error_code: "", error_message: "", finished_at: "" },
    })
    if (job.transcript) {
      await pbRequest(`/api/transcripts/${encodeURIComponent(job.transcript)}`, { method: "PATCH", body: { asr_status: "queued" } })
    }
    await writeSyncLog("ASR重试", job.id, job.store, "成功", "已重新进入 ASR 队列")
    json(res, 202, { job: updated })
    void pollJobs()
  } catch (error) {
    json(res, 502, { error: "asr_retry_failed", message: safeMessage(error, "ASR 重试失败") })
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`)
  if (req.method === "GET" && url.pathname === "/health") {
    if (ASR_MOCK) {
      json(res, 200, { status: "ok", mode: "mock", asr_configured: false, poll_in_flight: pollInFlight })
      return
    }
    if (asrConfigured()) {
      json(res, 200, { status: "ok", mode: "private", asr_configured: true, poll_in_flight: pollInFlight })
      return
    }
    json(res, 200, { status: "degraded", mode: "unconfigured", asr_configured: false, poll_in_flight: pollInFlight })
    return
  }
  if (req.method === "POST" && url.pathname === "/api/asr/jobs") {
    void handleSubmit(req, res)
    return
  }
  const retryMatch = url.pathname.match(/^\/api\/asr\/jobs\/([a-zA-Z0-9_-]+)\/retry$/)
  if (req.method === "POST" && retryMatch) {
    void handleRetry(res, retryMatch[1])
    return
  }
  if (req.method === "POST" && url.pathname === "/api/asr/jobs/refresh") {
    if (!assertAsrConfigured(res)) return
    void pollJobs().then(() => json(res, 200, { ok: true }))
    return
  }
  json(res, 404, { error: "not_found" })
})

const isMain = Boolean(process.argv[1] && (process.argv[1].endsWith("asr-gateway.mjs") || process.argv[1].endsWith("asr-gateway.js")))
if (isMain && !process.env.VITEST) {
  server.listen(PORT, HOST, () => {
    gatewayStarted = true
    console.log(`[asr-gateway] listening on http://${HOST}:${PORT}; ASR configured=${asrConfigured()}`)
    void pollJobs()
  })
}

export { verifyUploadToken, safeSignatureEqual, asrConfigured, server }

server.on("error", (error) => {
  console.error(`[asr-gateway] server error: ${safeMessage(error)}`)
  if (!gatewayStarted) process.exitCode = 1
})

const interval = setInterval(() => void pollJobs(), POLL_INTERVAL_MS)
interval.unref()

function shutdown() {
  clearInterval(interval)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 10_000).unref()
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
