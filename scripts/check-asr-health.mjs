#!/usr/bin/env node
// scripts/check-asr-health.mjs — 校验 ASR Gateway 健康检查 JSON
// 用法:
//   node scripts/check-asr-health.mjs --env production --json '{"status":"ok","mode":"private","asr_configured":true}'
//   curl -sf http://127.0.0.1:18084/health | node scripts/check-asr-health.mjs --env production

import { readFileSync } from "node:fs"

export function validateAsrHealth(healthData, env = "production") {
  if (!healthData || typeof healthData !== "object") {
    return { ok: false, message: "ASR health 响应不是有效 JSON 对象" }
  }

  const { status, mode, asr_configured } = healthData
  const isProd = env === "production"

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
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--env" && args[i + 1]) {
      env = args[++i]
    } else if (args[i] === "--json" && args[i + 1]) {
      jsonStr = args[++i]
    }
  }
  return { env, jsonStr }
}

const isMain = Boolean(
  process.argv[1] &&
    (process.argv[1].endsWith("check-asr-health.mjs") || process.argv[1].endsWith("check-asr-health.js"))
)

if (isMain) {
  const { env, jsonStr } = parseArgs(process.argv.slice(2))
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

  const result = validateAsrHealth(data, env)
  if (result.ok) {
    console.log(`[check-asr-health] [ok] ${result.message}`)
    process.exit(0)
  } else {
    console.error(`[check-asr-health] [fail] ${result.message}`)
    process.exit(1)
  }
}
