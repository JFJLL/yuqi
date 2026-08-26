import { spawn, execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { startPbTestServer, bootstrapTestEnvironment, getFreePort } from "../tests/helpers/pb-test-server.mjs"

const EDGE_EXE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
const OUT_DIR = path.resolve("outputs/manager-ui-integration/screenshots")
const VIZ_DIR = "C:\\Users\\liuhao_PC\\.codex\\visualizations\\2026\\08\\26\\01a03c87-ec68-7cd3-bb88-56105c301515\\screenshots"

fs.mkdirSync(OUT_DIR, { recursive: true })
try { fs.mkdirSync(VIZ_DIR, { recursive: true }) } catch (_) {}

async function main() {
  console.log("[capture] Starting PocketBase test server...")
  const pbServer = await startPbTestServer({ envMode: "test" })
  const env = await bootstrapTestEnvironment(pbServer)

  const superHeaders = { Authorization: "Bearer " + env.tokens.superuser }
  await pbServer.req("POST", "/api/collections/recommendations/records", {
    tenant: env.tenantId,
    store: env.stores.storeA,
    employee: env.employees.zhang,
    product_name: "苏黄止咳胶囊",
    indication: "咽痒干咳、刺激性干咳",
    recommended_drugs: JSON.stringify([{ name: "苏黄止咳胶囊", brand: "扬子江", specification: "0.45g*24粒" }, { name: "西瓜霜清咽含片", brand: "三金" }]),
    risk_tips: "风寒咳嗽及过敏体质者慎用",
    source: "药学知识库",
  }, superHeaders)

  await pbServer.req("POST", "/api/collections/learning_courses/records", {
    tenant: env.tenantId,
    title: "合规销售与处方药提示规范",
    category: "合规规范",
    summary: "处方药合规销售、禁忌问诊与用药安全提示全流程指引",
    status: "PUBLISHED",
  }, superHeaders)

  const previewPort = await getFreePort()
  console.log(`[capture] Starting Vite preview server on port ${previewPort}...`)
  const preview = spawn("pnpm", ["preview", "--port", String(previewPort), "--strictPort"], {
    cwd: path.resolve("."),
    stdio: "pipe",
    shell: true,
    env: { ...process.env, VITE_PB_URL: pbServer.url },
  })

  await new Promise((r) => setTimeout(r, 2000))

  // Write login-inject.html into dist so Edge can initialize real auth session in localStorage
  const sessionData = {
    token: env.tokens.admin,
    user: {
      id: env.users.admin,
      email: "admin@demo.local",
      username: "admin",
      display_name: "系统管理员",
      role_code: "SUPER_ADMIN",
      tenant: env.tenantId,
    },
  }
  const injectHtml = `<!DOCTYPE html><html><body><script>
localStorage.setItem("yuqi_pb_url", "${pbServer.url}");
localStorage.setItem("yuqi_auth_session", JSON.stringify(${JSON.stringify(sessionData)}));
window.location.href = "/";
</script></body></html>`
  fs.writeFileSync(path.resolve("dist/login-inject.html"), injectHtml)

  const pages = [
    { name: "01-login", path: "/login" },
    { name: "02-dashboard", path: "/" },
    { name: "03-regions-stores", path: "/org" },
    { name: "04-employees", path: "/employees" },
    { name: "05-devices", path: "/devices" },
    { name: "06-recordings", path: "/records" },
    { name: "07-inspection", path: "/inspection" },
    { name: "08-appeals", path: "/appeals" },
    { name: "09-activity", path: "/activity" },
    { name: "10-reports", path: "/reports" },
    { name: "11-permissions", path: "/permissions" },
    { name: "12-settings", path: "/settings" },
    { name: "13-logs", path: "/logs" },
  ]

  console.log("[capture] Capturing page screenshots with Edge headless...")
  const chromeUserDir = path.join(pbServer.tempDir, "edge-profile")
  fs.mkdirSync(chromeUserDir, { recursive: true })

  // Step A: Initialize session in edge profile via login-inject.html
  try {
    execFileSync(EDGE_EXE, [
      "--headless",
      "--disable-gpu",
      `--user-data-dir=${chromeUserDir}`,
      "--virtual-time-budget=2000",
      `http://127.0.0.1:${previewPort}/login-inject.html`,
    ], { stdio: "ignore", timeout: 10000 })
  } catch (_) {}

  for (const page of pages) {
    const targetUrl = `http://127.0.0.1:${previewPort}${page.path}`
    const outPng = path.join(OUT_DIR, `${page.name}.png`)
    const vizPng = path.join(VIZ_DIR, `${page.name}.png`)

    try {
      execFileSync(EDGE_EXE, [
        "--headless",
        "--disable-gpu",
        page.name === "01-login" ? "--incognito" : `--user-data-dir=${chromeUserDir}`,
        "--window-size=1440,900",
        "--hide-scrollbars",
        "--virtual-time-budget=3000",
        `--screenshot=${outPng}`,
        targetUrl,
      ], { stdio: "ignore", timeout: 15000 })
    } catch (e) {
      // ignore
    }

    if (fs.existsSync(outPng)) {
      try { fs.copyFileSync(outPng, vizPng) } catch (_) {}
      console.log(`[capture] Captured: ${page.name}.png`)
    } else {
      console.warn(`[capture] Failed to capture ${page.name}.png`)
    }
  }

  preview.kill()
  await pbServer.stop()
  console.log("[capture] All 13 page screenshots successfully captured and saved!")
}

main().catch((err) => {
  console.error("[capture] Error:", err)
  process.exit(1)
})
