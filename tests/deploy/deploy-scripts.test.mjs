import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { validateAsrHealth } from "../../scripts/check-asr-health.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "../..")
const scriptsDir = path.join(root, "deploy", "scripts")

describe("部署脚本静态分析与首次部署安全性", () => {
  const scriptFiles = readdirSync(scriptsDir).filter((f) => f.endsWith(".sh"))

  it("所有部署脚本存在且具有标准 bash 头部与 set -euo pipefail", () => {
    assert.ok(scriptFiles.length >= 7, `至少包含 7 个部署脚本，当前: ${scriptFiles.length}`)
    for (const f of scriptFiles) {
      const content = readFileSync(path.join(scriptsDir, f), "utf8")
      assert.ok(content.startsWith("#!/usr/bin/env bash"), `${f} 必须以 #!/usr/bin/env bash 开头`)
      assert.ok(content.includes("set -euo pipefail"), `${f} 必须包含 set -euo pipefail`)
    }
  })

  it("bash -n 语法检查 (如系统存在 bash)", () => {
    let hasBash = false
    try {
      execFileSync("bash", ["-c", "echo ok"], { cwd: scriptsDir, stdio: "pipe" })
      hasBash = true
    } catch (_) {
      hasBash = false
    }

    if (hasBash) {
      for (const f of scriptFiles) {
        const res = execFileSync("bash", ["-n", f], { cwd: scriptsDir, encoding: "utf8" })
        assert.equal(res, "", `${f} bash -n 语法检查必须干净`)
      }
    }
  })

  it("check-env.sh: ENV=test 使用 .env.test, ENV=production 使用 .env.production", () => {
    const content = readFileSync(path.join(scriptsDir, "check-env.sh"), "utf8")
    assert.ok(content.includes('ENV_NAME="${ENV:-test}"'), "必须支持 ENV 环境变量传入且默认 test")
    assert.ok(content.includes('.env.production'), "必须包含 .env.production 检查")
    assert.ok(content.includes('.env.test'), "必须包含 .env.test 检查")
  })

  it("check-env.sh: 端口未监听不报错 (首次运行安全)", () => {
    const content = readFileSync(path.join(scriptsDir, "check-env.sh"), "utf8")
    assert.ok(
      content.includes('say_ok "端口 ${port} 未监听') || content.includes("空闲"),
      "端口未监听时必须输出 ok/info，禁止 say_bad 报错退出"
    )
  })

  it("deploy.sh: 首次部署使用 start, 已存在使用 reload, 并向健康检查传递 ENV", () => {
    const content = readFileSync(path.join(scriptsDir, "deploy.sh"), "utf8")
    assert.ok(content.includes("pm2 start ecosystem.config.cjs"), "必须包含初次启动 start 逻辑")
    assert.ok(content.includes("pm2 reload ecosystem.config.cjs"), "必须包含重载 reload 逻辑")
    assert.ok(content.includes('ENV="${ENV_NAME}" bash'), "必须向 health-check 传递 ENV")
  })

  it("health-check.sh: 严格校验 PM2 状态为 online (stopped/errored 判失败)", () => {
    const content = readFileSync(path.join(scriptsDir, "health-check.sh"), "utf8")
    assert.ok(content.includes('pm2_status === "online"') || content.includes('pm2_status}" = "online"'), "必须判断 status 为 online")
    assert.ok(content.includes("say_bad") && content.includes("状态非 online"), "状态非 online 时必须 fail")
  })

  it("health-check.sh 与 check-asr-health.mjs: 生产与测试环境 ASR 健康检查矩阵", () => {
    // 1. 生产环境: 未配置 / degraded 必须拒绝
    const prodUnconfigured = validateAsrHealth({ status: "degraded", mode: "unconfigured", asr_configured: false }, "production")
    assert.equal(prodUnconfigured.ok, false, "生产环境未配置 ASR 必须失败")

    // 2. 生产环境: mock 模式必须拒绝
    const prodMock = validateAsrHealth({ status: "ok", mode: "mock", asr_configured: false }, "production")
    assert.equal(prodMock.ok, false, "生产环境处于 Mock 模式必须失败")

    // 3. 生产环境: private 配置正确必须通过
    const prodPrivate = validateAsrHealth({ status: "ok", mode: "private", asr_configured: true }, "production")
    assert.equal(prodPrivate.ok, true, "生产环境 private 配置完整必须通过")

    // 4. 测试环境: mock 模式允许通过
    const testMock = validateAsrHealth({ status: "ok", mode: "mock", asr_configured: false }, "test")
    assert.equal(testMock.ok, true, "测试环境 mock 模式必须通过")

    // 5. 测试环境: private 配置允许通过
    const testPrivate = validateAsrHealth({ status: "ok", mode: "private", asr_configured: true }, "test")
    assert.equal(testPrivate.ok, true, "测试环境 private 模式必须通过")
  })
})
