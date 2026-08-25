import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { startPbTestServer, bootstrapTestEnvironment, getFreePort } from "../helpers/pb-test-server.mjs"
import {
  startWorkerLoop,
  stopWorkerLoop,
  isWorkerLoopRunning,
  runOnce,
  isExecutedDirectly,
  getPbUrl,
  getServiceToken,
} from "../../server/business-worker.mjs"
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "../..")

async function waitFor(predicate, timeoutMs = 15000, intervalMs = 200) {
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

describe("一期 Worker 生命周期与独立/内嵌双模式测试 (Worker Lifecycle & Standalone Mode)", () => {
  let pbServer
  let env

  before(async () => {
    pbServer = await startPbTestServer({ envMode: "test" })
    env = await bootstrapTestEnvironment(pbServer)
    process.env.YUQI_PB_URL = pbServer.url
    process.env.YUQI_SERVICE_TOKEN = env.serviceToken
  })

  after(async () => {
    stopWorkerLoop()
    if (pbServer) {
      await pbServer.stop()
    }
  })

  it("1. 模块导入无副作用: import 后 Worker Loop 处于停止状态", () => {
    assert.equal(isWorkerLoopRunning(), false, "导入模块不应自动启动 Worker Loop")
    assert.equal(typeof isExecutedDirectly, "function")
    assert.equal(isExecutedDirectly(), false, "测试环境下 isExecutedDirectly 应为 false")
    assert.equal(getPbUrl(), pbServer.url)
    assert.equal(getServiceToken(), env.serviceToken)
  })

  it("2. runOnce 在无任务时返回 false，且不会抛出异常", async () => {
    const processed = await runOnce()
    assert.equal(processed, false, "无任务时 runOnce 必须返回 false")
  })

  it("3. startWorkerLoop 具有单循环保护: 多次启动返回同一 Promise 且只有一个运行中实例", async () => {
    const p1 = startWorkerLoop({ pollMs: 100 })
    assert.equal(isWorkerLoopRunning(), true, "启动后 isWorkerLoopRunning 应为 true")
    const p2 = startWorkerLoop({ pollMs: 100 })
    assert.equal(p1, p2, "重复调用 startWorkerLoop 必须返回同一个 Promise 句柄")

    // 停止循环
    stopWorkerLoop()
    await p1
    assert.equal(isWorkerLoopRunning(), false, "stopWorkerLoop 后循环必须优雅退出并置 running=false")
  })

  it("4. processing_jobs 入队后 runOnce 返回 true 并成功处理", async () => {
    // 入队一个 noop 任务
    const enqRes = await pbServer.req("POST", "/api/yuqi/internal/jobs/enqueue", {
      job_type: "NOTIFICATION_DISPATCH",
      business_key: "test-lifecycle-1",
      idempotency_key: `test-lifecycle-notif-${Date.now()}`,
      payload_json: { test: true },
    }, { "X-Yuqi-Service-Token": env.serviceToken })
    assert.equal(enqRes.status, 200)
    const jobId = enqRes.data.job.id

    // 运行一次
    const processed = await runOnce()
    assert.equal(processed, true, "存在任务时 runOnce 必须返回 true")

    // 检查任务状态已更新为 SUCCEEDED
    const jobRes = await pbServer.req("GET", `/api/collections/processing_jobs/records/${jobId}`, null, {
      Authorization: env.tokens.superuser,
    })
    assert.equal(jobRes.data.status, "SUCCEEDED")
  })

  it("5. Standalone 模式验证: YUQI_EMBEDDED_WORKER=0 时 Gateway 不消费任务，独立 Worker 消费任务", async () => {
    const standalonePort = await getFreePort()
    const gatewayEnv = {
      ...process.env,
      YUQI_ENV: "test",
      NODE_ENV: "test",
      YUQI_ASR_MOCK: "1",
      YUQI_ASR_GATEWAY_HOST: "127.0.0.1",
      YUQI_ASR_GATEWAY_PORT: String(standalonePort),
      POCKETBASE_URL: pbServer.url,
      YUQI_PB_URL: pbServer.url,
      YUQI_SERVICE_TOKEN: env.serviceToken,
      YUQI_SERVICE_TENANT_CODE: "demo",
      YUQI_UPLOAD_TOKEN_SECRET: "test-upload-token-secret-123456",
      YUQI_EMBEDDED_WORKER: "0",
    }
    delete gatewayEnv.VITEST

    const gw = spawn("node", ["server/asr-gateway.mjs"], {
      cwd: root,
      env: gatewayEnv,
      stdio: "pipe",
    })

    try {
      // 等待 Gateway 就绪
      await waitFor(async () => {
        const res = await fetch(`http://127.0.0.1:${standalonePort}/health`)
        if (res.status === 200) {
          const data = await res.json()
          return data.embedded_worker?.enabled === false && data.embedded_worker?.running === false
        }
        return false
      }, 15000)

      // 入队任务
      const enq = await pbServer.req("POST", "/api/yuqi/internal/jobs/enqueue", {
        job_type: "RETENTION_CHECK",
        business_key: "test-standalone-1",
        idempotency_key: `test-standalone-${Date.now()}`,
        payload_json: { standalone: true },
      }, { "X-Yuqi-Service-Token": env.serviceToken })
      assert.equal(enq.status, 200)
      const targetJobId = enq.data.job.id

      // 等待 500ms 验证 Gateway 确实没有消费该任务 (仍为 QUEUED)
      await new Promise((r) => setTimeout(r, 500))
      const checkJob1 = await pbServer.req("GET", `/api/collections/processing_jobs/records/${targetJobId}`, null, {
        Authorization: env.tokens.superuser,
      })
      assert.equal(checkJob1.data.status, "QUEUED", "YUQI_EMBEDDED_WORKER=0 时 Gateway 绝不自动消费任务")

      // 模拟独立 Worker 消费该任务 (调用 runOnce)
      const handled = await runOnce()
      assert.equal(handled, true, "独立 Worker 处理任务成功")

      const checkJob2 = await pbServer.req("GET", `/api/collections/processing_jobs/records/${targetJobId}`, null, {
        Authorization: env.tokens.superuser,
      })
      assert.equal(checkJob2.data.status, "SUCCEEDED", "独立 Worker 消费后任务状态转为 SUCCEEDED")
    } finally {
      gw.kill()
    }
  })
})
