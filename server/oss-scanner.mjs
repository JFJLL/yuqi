// yuqi-oss-scanner — 定时扫描阿里云 OSS 指定前缀下的胸牌录音，自动提交本机 ASR 服务。
//
// 数据流：
//   OSS(bucket/prefix) --ListObjects--> 发现新 .mp3
//     -> PocketBase audio_files 登记（object_key 唯一，幂等）
//     -> OSS 流式下载（不落盘）-> frp 回环 -> ASR POST /v1/jobs
//     -> 创建 transcripts(source=oss_auto) + asr_jobs
//   结果回写由既有 yuqi-asr-gateway 的轮询逻辑完成，本进程不重复实现。
//
// 失败处理：
//   提交失败（下载/OSS/ASR 提交）：自动重试 SCANNER_MAX_SUBMIT_RETRIES 次，间隔递增，超过后标记 dead。
//   ASR 转写失败：扫描 asr_jobs 中 source=oss_auto 的失败任务，在 SCANNER_MAX_ASR_ATTEMPTS 内自动调用重试。
//
// 所有配置经环境变量注入（见 deploy/asr-gateway.env.example），不得写入代码库。

import { createHmac } from "node:crypto"
import http from "node:http"
import https from "node:https"
import { Transform } from "node:stream"

const POCKETBASE_URL = trimTrailingSlash(process.env.POCKETBASE_URL || "http://127.0.0.1:7040")
const ASR_BASE_URL = trimTrailingSlash(process.env.ASR_BASE_URL || "")
const ASR_SERVICE_TOKEN = process.env.ASR_SERVICE_TOKEN || ""
// Endpoint 兼容带/不带 https:// 前缀的写法，统一剥掉协议头再拼 Bucket 虚拟主机。
const OSS_ENDPOINT = normalizeEndpoint(process.env.OSS_ENDPOINT || "")
const OSS_BUCKET = process.env.OSS_BUCKET || ""
const OSS_PREFIX = normalizePrefix(process.env.OSS_PREFIX || "")
const OSS_ACCESS_KEY_ID = process.env.OSS_ACCESS_KEY_ID || ""
const OSS_ACCESS_KEY_SECRET = process.env.OSS_ACCESS_KEY_SECRET || ""

const SCAN_INTERVAL_MS = numberEnv("SCAN_INTERVAL_MS", 300_000)
const OSS_MAX_LIST_KEYS = numberEnv("OSS_MAX_LIST_KEYS", 1000)
const MAX_DOWNLOAD_BYTES = numberEnv("YUQI_ASR_MAX_UPLOAD_MB", 200) * 1024 * 1024
const MAX_SUBMITS_PER_CYCLE = numberEnv("SCANNER_MAX_SUBMITS_PER_CYCLE", 20)
const MAX_SUBMIT_RETRIES = numberEnv("SCANNER_MAX_SUBMIT_RETRIES", 2)
const MAX_ASR_ATTEMPTS = numberEnv("SCANNER_MAX_ASR_ATTEMPTS", 3)
const RETRY_BACKOFF_BASE_MS = numberEnv("SCANNER_RETRY_BACKOFF_BASE_MS", 600_000)
const REQUEST_TIMEOUT_MS = numberEnv("SCANNER_REQUEST_TIMEOUT_MS", 120_000)
const STALE_SUBMITTING_MS = numberEnv("SCANNER_STALE_SUBMITTING_MS", 1_800_000)
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a"])

const BINDING_ACTIVE_STATUS = "已绑定"

let cycleInFlight = false

function numberEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "")
}

function normalizeEndpoint(value) {
  return trimTrailingSlash(String(value || "").trim().replace(/^https?:\/\//i, ""))
}

function normalizePrefix(value) {
  const clean = value.replace(/^\/+/, "")
  if (!clean) return ""
  return clean.endsWith("/") ? clean : `${clean}/`
}

function pbDate(now = new Date()) {
  return now.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "Z")
}

function safeMessage(error, fallback = "请求失败") {
  const text = String(error?.message || error || fallback)
  return text.replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]").slice(0, 500)
}

function log(message) {
  console.log(`[oss-scanner] ${new Date().toISOString()} ${message}`)
}

function logError(message, error) {
  console.error(`[oss-scanner] ${new Date().toISOString()} ${message}: ${safeMessage(error)}`)
}

function assertConfigured() {
  const missing = []
  if (!ASR_BASE_URL) missing.push("ASR_BASE_URL")
  if (!ASR_SERVICE_TOKEN) missing.push("ASR_SERVICE_TOKEN")
  if (!OSS_ENDPOINT) missing.push("OSS_ENDPOINT")
  if (!OSS_BUCKET) missing.push("OSS_BUCKET")
  if (!OSS_ACCESS_KEY_ID) missing.push("OSS_ACCESS_KEY_ID")
  if (!OSS_ACCESS_KEY_SECRET) missing.push("OSS_ACCESS_KEY_SECRET")
  if (missing.length > 0) {
    console.error(`[oss-scanner] 缺少必需环境变量：${missing.join(", ")}；进程退出。`)
    process.exit(1)
  }
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
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (response.status < 200 || response.status >= 300) {
    const detail = response.data?.message || response.data?.error || `HTTP ${response.status}`
    throw new Error(`PocketBase ${method} ${path}: ${detail}`)
  }
  return response.data
}

async function writeSyncLog(type, object, store, status, result) {
  try {
    await pbRequest("/api/sync_logs", {
      method: "POST",
      body: { type, object, store: store || "", status, result: String(result || "").slice(0, 300), occurred_at: pbDate() },
    })
  } catch (error) {
    logError("sync log 写入失败", error)
  }
}

// ---- OSS V1 签名（HMAC-SHA1）----

function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

function ossAuthorization(method, contentMd5, contentType, date, canonicalizedResource) {
  const stringToSign = [method, contentMd5 || "", contentType || "", date, canonicalizedResource].join("\n")
  const signature = createHmac("sha1", OSS_ACCESS_KEY_SECRET).update(stringToSign, "utf8").digest("base64")
  return `OSS ${OSS_ACCESS_KEY_ID}:${signature}`
}

function ossVirtualHost() {
  return `${OSS_BUCKET}.${OSS_ENDPOINT}`
}

async function listOssAudioObjects() {
  const objects = []
  let marker = ""
  for (let page = 0; page < 100; page += 1) {
    const query = new URLSearchParams()
    query.set("prefix", OSS_PREFIX)
    query.set("max-keys", String(OSS_MAX_LIST_KEYS))
    if (marker) query.set("marker", marker)
    const date = new Date().toUTCString()
    const resource = `/${OSS_BUCKET}/`
    const authorization = ossAuthorization("GET", "", "", date, resource)
    const response = await requestBuffer(`https://${ossVirtualHost()}/?${query.toString()}`, {
      method: "GET",
      headers: { Date: date, Authorization: authorization },
    })
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`OSS ListObjects 失败：HTTP ${response.status} ${String(response.data?.raw || "").slice(0, 200)}`)
    }
    const xml = response.data?.raw || ""
    const contents = xml.match(/<Contents>[\s\S]*?<\/Contents>/g) || []
    for (const block of contents) {
      const key = decodeXmlEntities(block.match(/<Key>([\s\S]*?)<\/Key>/)?.[1])
      const size = Number(block.match(/<Size>([\s\S]*?)<\/Size>/)?.[1] || 0)
      const lastModified = block.match(/<LastModified>([\s\S]*?)<\/LastModified>/)?.[1] || ""
      if (key) objects.push({ key, size, lastModified })
    }
    const truncated = /<IsTruncated>true<\/IsTruncated>/i.test(xml)
    if (!truncated) break
    marker = objects.length > 0 ? objects[objects.length - 1].key : ""
    if (!marker) break
  }
  return objects
}

function ossObjectUrl(key) {
  const encoded = key.split("/").map(encodeURIComponent).join("/")
  return `https://${ossVirtualHost()}/${encoded}`
}

// ---- 文件名解析 ----
// 例：WF2503Y001eecc4-260617164353260617164712-Z011-00aGRPDx.mp3
// 起止时间为 YYMMDDHHmmss（北京时间，各 12 位）。
const BADGE_FILENAME_RE = /^([A-Za-z0-9]+)-(\d{12})(\d{12})-([A-Za-z]\d*)-([A-Za-z0-9]+)\.(mp3|wav|m4a)$/i

function beijingToUtcDate(digits) {
  const s = String(digits || "")
  if (s.length !== 12) return null
  const iso = `20${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4, 6)}T${s.slice(6, 8)}:${s.slice(8, 10)}:${s.slice(10, 12)}+08:00`
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseBadgeFilename(fileName) {
  const match = BADGE_FILENAME_RE.exec(String(fileName || ""))
  if (!match) return { sn: "", startedAt: null, endedAt: null, chunk: "" }
  return {
    sn: match[1],
    startedAt: beijingToUtcDate(match[2]),
    endedAt: beijingToUtcDate(match[3]),
    chunk: match[4],
  }
}

function extensionOf(key) {
  const dot = key.lastIndexOf(".")
  return dot >= 0 ? key.slice(dot).toLowerCase() : ""
}

// ---- 设备绑定映射缓存 ----

let bindingCache = new Map()

async function refreshBindingCache() {
  const devices = []
  for (let page = 1; page <= 50; page += 1) {
    const data = await pbRequest(`/api/devices?page=${page}&perPage=500`)
    const items = Array.isArray(data?.items) ? data.items : []
    devices.push(...items)
    if (items.length < 500) break
  }
  const bindings = []
  for (let page = 1; page <= 50; page += 1) {
    const data = await pbRequest(`/api/device_bindings?page=${page}&perPage=500`)
    const items = Array.isArray(data?.items) ? data.items : []
    bindings.push(...items)
    if (items.length < 500) break
  }

  // 列表按 -created 排序：首次命中的即最新绑定。
  const deviceIdBySn = new Map()
  for (const device of devices) {
    if (device?.device_no && !deviceIdBySn.has(device.device_no)) {
      deviceIdBySn.set(device.device_no, device.id)
    }
  }
  const nextCache = new Map()
  for (const binding of bindings) {
    if (String(binding?.status || "") !== BINDING_ACTIVE_STATUS) continue
    const sn = [...deviceIdBySn.entries()].find(([, id]) => id === binding.device)?.[0]
    if (!sn || nextCache.has(sn)) continue
    nextCache.set(sn, { employee: String(binding.employee || ""), store: String(binding.store || "") })
  }
  bindingCache = nextCache
  log(`绑定映射刷新：设备 ${deviceIdBySn.size} 台，生效绑定 ${nextCache.size} 条`)
}

function mappingFor(sn) {
  return bindingCache.get(sn) || { employee: "", store: "" }
}

// ---- 登记与提交 ----

async function loadKnownObjectKeys() {
  const known = new Set()
  for (let page = 1; page <= 200; page += 1) {
    const data = await pbRequest(`/api/audio_files?page=${page}&perPage=500`)
    const items = Array.isArray(data?.items) ? data.items : []
    for (const item of items) known.add(String(item.object_key || ""))
    if (items.length < 500) break
  }
  return known
}

async function ensureAudioFileRecord(object) {
  const fileName = object.key.slice(OSS_PREFIX.length) || object.key
  const parsed = parseBadgeFilename(fileName)
  const payload = {
    object_key: object.key,
    file_name: fileName,
    device_sn: parsed.sn,
    size: object.size,
    oss_last_modified: object.lastModified ? pbDate(new Date(object.lastModified)) : "",
    started_at: parsed.startedAt ? pbDate(parsed.startedAt) : "",
    ended_at: parsed.endedAt ? pbDate(parsed.endedAt) : "",
    chunk: parsed.chunk,
    status: "submitting",
    attempts: 0,
  }
  const result = await pbRequest("/api/audio_files", { method: "POST", body: payload })
  return { duplicate: Boolean(result?.duplicate), item: result?.item }
}

async function markSubmitFailure(item, error) {
  const attempts = Number(item?.attempts || 0) + 1
  const dead = attempts > MAX_SUBMIT_RETRIES
  const nextRetryAt = new Date(Date.now() + attempts * RETRY_BACKOFF_BASE_MS)
  try {
    await pbRequest(`/api/audio_files/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      body: {
        status: dead ? "dead" : "submit_failed",
        attempts,
        next_retry_at: dead ? "" : pbDate(nextRetryAt),
        error_message: safeMessage(error),
      },
    })
  } catch (patchError) {
    logError(`audio_files ${item?.id} 状态更新失败`, patchError)
  }
  await writeSyncLog("OSS采集", item?.id || "?", "", "失败", safeMessage(error))
}

function forwardOssObjectToAsr(objectKey, fileName, metadata) {
  const remoteUrl = new URL(`${ASR_BASE_URL}/v1/jobs`)
  const boundary = `----yuqi-oss-${Math.random().toString(16).slice(2)}`
  const contentType = extensionOf(objectKey) === ".wav" ? "audio/wav" : "audio/mpeg"
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="metadata"\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName.replace(/"/g, "_")}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
    "utf8",
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8")

  return new Promise((resolve, reject) => {
    const remote = transportFor(remoteUrl).request(
      remoteUrl,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ASR_SERVICE_TOKEN}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Transfer-Encoding": "chunked",
        },
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
          const status = response.statusCode || 500
          if (status >= 200 && status < 300) {
            resolve(data)
          } else {
            reject(new Error(`ASR POST /v1/jobs: ${data?.detail || data?.message || data?.error || `HTTP ${status}`}`))
          }
        })
      },
    )

    let source = null
    const fail = (error) => {
      remote.destroy(error)
      source?.destroy()
      reject(error)
    }
    remote.on("timeout", () => fail(new Error("提交 ASR 任务超时")))
    remote.on("error", fail)

    const ossUrl = new URL(ossObjectUrl(objectKey))
    const date = new Date().toUTCString()
    const resource = `/${OSS_BUCKET}/${objectKey}`
    try {
      source = transportFor(ossUrl).request(
        ossUrl,
        {
          method: "GET",
          headers: { Date: date, Authorization: ossAuthorization("GET", "", "", date, resource) },
          timeout: REQUEST_TIMEOUT_MS,
        },
        (ossResponse) => {
          if ((ossResponse.statusCode || 500) >= 300) {
            const ossStatus = ossResponse.statusCode
            ossResponse.resume()
            fail(new Error(`OSS GetObject 失败：HTTP ${ossStatus}`))
            return
          }
          let total = 0
          const limiter = new Transform({
            transform(chunk, _encoding, callback) {
              total += chunk.length
              if (total > MAX_DOWNLOAD_BYTES) {
                callback(new Error(`音频文件超过 ${Math.floor(MAX_DOWNLOAD_BYTES / 1024 / 1024)} MB 限制`))
                return
              }
              callback(null, chunk)
            },
          })
          limiter.on("error", fail)
          ossResponse.pipe(limiter).pipe(remote, { end: true })
        },
      )
    } catch (error) {
      fail(error)
      return
    }
    remote.write(head)
  })
}

async function submitAudioItem(item) {
  const fileName = item.file_name || item.object_key.split("/").pop()
  const parsed = parseBadgeFilename(fileName)
  const mapping = mappingFor(parsed.sn)
  const metadata = {
    device: parsed.sn || String(item.device_sn || ""),
    employee: mapping.employee,
    store: mapping.store,
    language: "zh-CN",
  }
  try {
    const remote = await forwardOssObjectToAsr(item.object_key, fileName, metadata)
    const remoteJobId = String(remote?.job_id || "")
    if (!/^[0-9a-f]{32}$/i.test(remoteJobId)) throw new Error("ASR 返回的 job_id 无效")

    const occurredAt = parsed.startedAt ? pbDate(parsed.startedAt) : item.started_at || pbDate()
    const transcript = await pbRequest("/api/transcripts", {
      method: "POST",
      body: {
        device: metadata.device,
        employee: mapping.employee,
        store: mapping.store,
        summary: "OSS 自动采集，等待转写",
        full_text: "",
        qc_result: "",
        occurred_at: occurredAt,
        asr_status: "queued",
        audio_name: fileName,
        source: "oss_auto",
      },
    })
    const job = await pbRequest("/api/asr_jobs", {
      method: "POST",
      body: {
        remote_job_id: remoteJobId,
        transcript: transcript.id,
        status: String(remote.status || "queued").toLowerCase(),
        device: metadata.device,
        employee: mapping.employee,
        store: mapping.store,
        audio_name: fileName,
        audio_size: Number(item.size || 0),
        metadata_json: metadata,
        submitted_at: pbDate(),
        occurred_at: occurredAt,
      },
    })
    await pbRequest(`/api/transcripts/${encodeURIComponent(transcript.id)}`, {
      method: "PATCH",
      body: { asr_job: job.id },
    })
    await pbRequest(`/api/audio_files/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      body: { status: "submitted", transcript: transcript.id, asr_job: job.id, error_message: "", next_retry_at: "" },
    })
    await writeSyncLog("OSS采集", job.id, mapping.store, "成功", `已提交 ${fileName}`)
    log(`已提交 ${item.object_key} -> ASR ${remoteJobId}`)
  } catch (error) {
    logError(`提交失败 ${item.object_key}`, error)
    await markSubmitFailure(item, error)
  }
}

async function retryDueSubmissions() {
  const now = Date.now()
  let budget = MAX_SUBMITS_PER_CYCLE

  // 回收卡在 submitting 的记录（进程中途退出等异常场景）。
  const staleData = await pbRequest("/api/audio_files?status=submitting&perPage=500")
  const staleItems = Array.isArray(staleData?.items) ? staleData.items : []
  for (const item of staleItems) {
    if (budget <= 0) return
    const updatedAt = new Date(String(item.updated || "").replace(" ", "T").replace("Z", "+00:00")).getTime()
    if (Number.isFinite(updatedAt) && now - updatedAt < STALE_SUBMITTING_MS) continue
    log(`回收超时 submitting 记录：${item.object_key}`)
    budget -= 1
    await submitAudioItem(item)
  }

  const data = await pbRequest("/api/audio_files?status=submit_failed&perPage=500")
  const items = Array.isArray(data?.items) ? data.items : []
  for (const item of items) {
    if (budget <= 0) return
    const dueAt = item.next_retry_at ? new Date(String(item.next_retry_at).replace(" ", "T").replace("Z", "+00:00")).getTime() : 0
    if (Number.isFinite(dueAt) && dueAt > now) continue
    budget -= 1
    await submitAudioItem(item)
  }
}

async function retryFailedAsrJobs() {
  const data = await pbRequest("/api/asr_jobs?status=failed&perPage=200")
  const jobs = Array.isArray(data?.items) ? data.items : []
  for (const job of jobs) {
    if (!job?.remote_job_id || !job?.transcript) continue
    if (Number(job.attempts || 0) >= MAX_ASR_ATTEMPTS) continue
    let transcript = null
    try {
      transcript = await pbRequest(`/api/transcripts/${encodeURIComponent(job.transcript)}`)
    } catch (error) {
      logError(`转写记录 ${job.transcript} 读取失败`, error)
      continue
    }
    if (String(transcript?.source || "") !== "oss_auto") continue
    try {
      const remote = await requestBuffer(`${ASR_BASE_URL}/v1/jobs/${encodeURIComponent(job.remote_job_id)}/retry`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ASR_SERVICE_TOKEN}` },
      })
      if (remote.status < 200 || remote.status >= 300) {
        throw new Error(`HTTP ${remote.status} ${String(remote.data?.detail || remote.data?.raw || "").slice(0, 200)}`)
      }
      await pbRequest(`/api/asr_jobs/${encodeURIComponent(job.id)}`, {
        method: "PATCH",
        body: { status: "queued", error_code: "", error_message: "", finished_at: "" },
      })
      await pbRequest(`/api/transcripts/${encodeURIComponent(job.transcript)}`, {
        method: "PATCH",
        body: { asr_status: "queued" },
      })
      await writeSyncLog("ASR重试", job.id, job.store || "", "成功", "OSS 自动重试已进入队列")
      log(`ASR 失败任务自动重试 ${job.remote_job_id}（第 ${Number(job.attempts || 0)} 次）`)
    } catch (error) {
      logError(`ASR 自动重试失败 ${job.remote_job_id}`, error)
    }
  }
}

async function runCycle() {
  if (cycleInFlight) {
    log("上一轮扫描尚未结束，跳过本轮")
    return
  }
  cycleInFlight = true
  try {
    await refreshBindingCache()
    await retryFailedAsrJobs()

    const objects = (await listOssAudioObjects()).filter((object) => {
      if (object.size <= 0) return false
      return AUDIO_EXTENSIONS.has(extensionOf(object.key))
    })

    const known = await loadKnownObjectKeys()
    const fresh = objects.filter((object) => !known.has(object.key))
    log(`扫描完成：OSS 命中 ${objects.length} 个音频，新发现 ${fresh.length} 个`)

    let budget = MAX_SUBMITS_PER_CYCLE
    for (const object of fresh) {
      if (budget <= 0) {
        log(`单轮提交上限 ${MAX_SUBMITS_PER_CYCLE} 已用完，剩余新文件下轮继续`)
        break
      }
      const { duplicate, item } = await ensureAudioFileRecord(object)
      if (duplicate || !item) continue
      budget -= 1
      await submitAudioItem(item)
    }

    await retryDueSubmissions()
  } catch (error) {
    logError("扫描周期执行失败", error)
  } finally {
    cycleInFlight = false
  }
}

assertConfigured()
log(`启动：bucket=${OSS_BUCKET} endpoint=${OSS_ENDPOINT} prefix=${OSS_PREFIX || "(根)"} interval=${SCAN_INTERVAL_MS}ms`)
void runCycle()
// 注意：这里不能 unref()。扫描器没有常驻 HTTP 服务，unref 后事件循环清空进程会退出，
// 导致 PM2 反复拉起（表现为每几秒重启一次）。
const timer = setInterval(() => void runCycle(), SCAN_INTERVAL_MS)

function shutdown() {
  clearInterval(timer)
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
