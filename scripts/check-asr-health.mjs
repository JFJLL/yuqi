#!/usr/bin/env node
// scripts/check-asr-health.mjs — 校验 ASR Gateway 健康检查 JSON
// 用法:
//   node scripts/check-asr-health.mjs --env production --json '{"status":"ok","mode":"private","asr_configured":true}'
//   curl -sf http://127.0.0.1:18084/health | node scripts/check-asr-health.mjs --env production

import { readFileSync } from "node:fs"

export function validateAsrHealth(healthData, env = "production", options = {}) {
  if (!healthData || typeof healthData !== "object") {
    return { ok: false, message: "ASR health 响应不是有效 JSON 对象" }
  }

  const { status, mode, asr_configured, embedded_worker } = healthData
  const isProd = env === "production"
  const requireEmbedded = Boolean(options.requireEmbeddedWorker)

  // 严格要求内嵌 Worker (例如部署切量时验证)
  if (requireEmbedded) {
    if (!embedded_worker || typeof embedded_worker !== "object") {
      return {
        ok: false,
        message: "ASR Gateway 响应缺少 embedded_worker 字段 (可能是旧版本网关未包含内嵌 Worker)",
      }
    }
    if (embedded_worker.enabled !== true || embedded_worker.running !== true) {
      return {
        ok: false,
        message: `ASR Gateway 的内嵌 Worker 未处于就绪状态 (enabled=${embedded_worker.enabled}, running=${embedded_worker.running})`,
      }
    }
  } else if (embedded_worker && typeof embedded_worker === "object") {
    // 未强制要求但已启用时，running 必须为 true
    const { enabled, running } = embedded_worker
    if (enabled === true && running !== true) {
      return {
        ok: false,
        message: "ASR Gateway 的内嵌 Worker (embedded_worker) 未处于运行状态",
      }
    }
  }

  if (isProd) {
    // 生产环境必须要求真实 private ASR 且配置完整
    if (status === "ok" && mode === "private" && asr_configured === true) {
      return { ok: true, message: "ASR Gateway 生产模式已就绪 (private)" }
    }
    if (status === "degraded" || mode === "unconfigured" || !asr_configured) {
      return {
        ok: false,
        message: `ASR Gateway 生产环境未配置真实 ASR (status=${status}, mode=${mode}, asr_configured=${asr_configured})`,
      }
    }
    if (mode === "mock") {
      return {
        ok: false,
        message: "ASR Gateway 处于 Mock 模式，禁止在生产环境通过健康检查",
      }
    }
    return {
      ok: false,
      message: `ASR Gateway 状态异常 (status=${status}, mode=${mode}, asr_configured=${asr_configured})`,
    }
  }

  // 测试环境允许 mock 或 private
  if (status === "ok" && (mode === "mock" || mode === "private")) {
    return { ok: true, message: `ASR Gateway 测试模式已就绪 (${mode})` }
  }

  return {
    ok: false,
    message: `ASR Gateway 状态异常 (status=${status}, mode=${mode}, asr_configured=${asr_configured})`,
  }
}

// CLI 执行
function parseArgs(args) {
  let env = process.env.ENV || "production"
  let jsonStr = ""
  let requireEmbeddedWorker = String(process.env.REQUIRE_EMBEDDED_WORKER || "") === "1"
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--env" && args[i + 1]) {
      env = args[++i]
    } else if (args[i] === "--json" && args[i + 1]) {
      jsonStr = args[++i]
    } else if (args[i] === "--require-embedded-worker") {
      requireEmbeddedWorker = true
    }
  }
  return { env, jsonStr, requireEmbeddedWorker }
}

const isMain = Boolean(
  process.argv[1] &&
    (process.argv[1].endsWith("check-asr-health.mjs") || process.argv[1].endsWith("check-asr-health.js"))
)

if (isMain) {
  const { env, jsonStr, requireEmbeddedWorker } = parseArgs(process.argv.slice(2))
  let raw = jsonStr
  if (!raw) {
    try {
      raw = readFileSync(0, "utf8").trim()
    } catch (_) {
      raw = ""
    }
  }

  if (!raw) {
    console.error("[check-asr-health] 缺少 JSON 输入")
    process.exit(1)
  }

  let data = null
  try {
    data = JSON.parse(raw)
  } catch (err) {
    console.error(`[check-asr-health] JSON 解析失败: ${err.message}`)
    process.exit(1)
  }

  const result = validateAsrHealth(data, env, { requireEmbeddedWorker: Boolean(requireEmbeddedWorker) })
  if (result.ok) {
    console.log(`[check-asr-health] [ok] ${result.message}`)
    process.exit(0)
  } else {
    console.error(`[check-asr-health] [fail] ${result.message}`)
    process.exit(1)
  }
}
