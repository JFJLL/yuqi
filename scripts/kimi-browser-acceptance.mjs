import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import assert from "node:assert/strict"
import { startPbTestServer, bootstrapTestEnvironment, getFreePort } from "../tests/helpers/pb-test-server.mjs"

const KIMI_URL = "http://127.0.0.1:10086/command"
const SESSION = "manager-ui-acceptance"
const OUT_DIR = path.resolve("outputs/manager-ui-integration/screenshots")
const VIZ_DIR = "C:\\Users\\liuhao_PC\\.codex\\visualizations\\2026\\08\\26\\01a03c87-ec68-7cd3-bb88-56105c301515\\screenshots"

fs.mkdirSync(OUT_DIR, { recursive: true })
try { fs.mkdirSync(VIZ_DIR, { recursive: true }) } catch (_) {}

async function kimiCmd(action, args = {}) {
  const res = await fetch(KIMI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, args, session: SESSION }),
  })
  if (!res.ok) throw new Error(`Kimi daemon HTTP error: ${res.status}`)
  const data = await res.json()
  if (data.ok === false || data.error) throw new Error(`Kimi command ${action} failed: ${data.error || data.message}`)
  return data
}

async function evalJs(code) {
  const res = await kimiCmd("evaluate", { code })
  return res.data?.value ?? res.value
}

async function main() {
  console.log("[kimi-acceptance] 1. Starting PocketBase and seeding accounts...")
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
  console.log(`[kimi-acceptance] 2. Starting Vite preview on port ${previewPort}...`)
  const preview = spawn("pnpm", ["preview", "--port", String(previewPort), "--strictPort"], {
    cwd: path.resolve("."),
    stdio: "pipe",
    shell: true,
    env: { ...process.env, VITE_PB_URL: pbServer.url },
  })
  await new Promise((r) => setTimeout(r, 2000))

  const baseUrl = `http://127.0.0.1:${previewPort}`
  console.log(`[kimi-acceptance] 3. Opening Kimi WebBridge browser tab: ${baseUrl}/login...`)

  // Step 1: Open Login Page
  const navRes = await kimiCmd("navigate", { url: `${baseUrl}/login?pb_url=${encodeURIComponent(pbServer.url)}`, newTab: true, group_title: "Manager UI 真实浏览器验收" })
  assert.ok(navRes.data?.success || navRes.success, "导航到登录页必须成功")
  await new Promise((r) => setTimeout(r, 1500))

  // Take Login Page screenshot
  let shot = await kimiCmd("screenshot", { path: path.join(OUT_DIR, "kimi-01-login.png") })
  let sPath = shot.data?.path || shot.path
  assert.ok(sPath && fs.existsSync(sPath), "登录页截图必须成功写入")
  console.log("[kimi-acceptance] Saved login screenshot:", sPath)
  try { if (sPath) fs.copyFileSync(sPath, path.join(VIZ_DIR, "kimi-01-login.png")) } catch (_) {}

  // Step 2: Test wrong password
  console.log("[kimi-acceptance] 4. Testing invalid password...")
  await evalJs(`(() => {
    const setVal = (sel, val) => { const el = document.querySelector(sel); const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); desc.set.call(el, val); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    setVal('#username', 'admin');
    setVal('#password', 'wrongpassword123');
    document.querySelector('form')?.requestSubmit();
  })()`)
  await new Promise((r) => setTimeout(r, 1000))
  let wrongShot = await kimiCmd("screenshot", { path: path.join(OUT_DIR, "kimi-01b-wrong-pass.png") })
  let wPath = wrongShot.data?.path || wrongShot.path
  assert.ok(wPath && fs.existsSync(wPath), "错误密码拦截截图必须生成")
  const hasErr = await evalJs("document.body.innerText.includes('用户名或密码错误')")
  assert.ok(hasErr, "错误密码必须提示用户名或密码错误")
  try { if (wPath) fs.copyFileSync(wPath, path.join(VIZ_DIR, "kimi-01b-wrong-pass.png")) } catch (_) {}
  console.log("[kimi-acceptance] Verified wrong password rejection.")

  // Step 3: Real Admin Login
  console.log("[kimi-acceptance] 5. Performing real admin login...")
  await kimiCmd("evaluate", {
    code: `(() => {
      const setVal = (sel, val) => {
        const el = document.querySelector(sel);
        if (!el) return;
        const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        desc.set.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      setVal('#username', 'admin');
      setVal('#password', 'Passw0rd!');
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
    })()`
  })
  await new Promise((r) => setTimeout(r, 3000))

  // Step 4: Dashboard Verification
  console.log("[kimi-acceptance] 6. Capturing real Dashboard...")
  const currentPath = await evalJs("window.location.pathname")
  assert.equal(currentPath, "/", "登录后必须跳转到工作总览 /")
  const dashBody = await evalJs("document.body.innerText")
  assert.ok(dashBody.includes("北京大区"), "首页门店表格必须展示北京大区")
  assert.ok(dashBody.includes("上海区域"), "首页门店表格必须展示上海区域")
  assert.ok(!dashBody.includes("i174gp5290r8g33"), "不得展示内部 ID")
  let dashShot = await kimiCmd("screenshot", { path: path.join(OUT_DIR, "kimi-02-dashboard.png") })
  let dPath = dashShot.data?.path || dashShot.path
  assert.ok(dPath && fs.existsSync(dPath), "工作总览截图必须生成")
  try { if (dPath) fs.copyFileSync(dPath, path.join(VIZ_DIR, "kimi-02-dashboard.png")) } catch (_) {}
  console.log("[kimi-acceptance] Saved dashboard screenshot:", dPath)

  // Step 5: Permissions Page Verification
  console.log("[kimi-acceptance] 7. Navigating to Permissions Page...")
  await kimiCmd("navigate", { url: `${baseUrl}/permissions` })
  await new Promise((r) => setTimeout(r, 2000))
  const permBody = await evalJs("document.body.innerText")
  assert.ok(permBody.includes("超级管理员"), "权限页必须展示角色矩阵")
  assert.ok(permBody.includes("系统管理员") || permBody.includes("审计员"), "管理员列表必须展示真实账号")
  let permShot = await kimiCmd("screenshot", { path: path.join(OUT_DIR, "kimi-03-permissions.png") })
  let pPath = permShot.data?.path || permShot.path
  assert.ok(pPath && fs.existsSync(pPath), "权限管理截图必须生成")
  try { if (pPath) fs.copyFileSync(pPath, path.join(VIZ_DIR, "kimi-03-permissions.png")) } catch (_) {}
  console.log("[kimi-acceptance] Saved permissions screenshot:", pPath)

  // Step 6: Reports Page Verification
  console.log("[kimi-acceptance] 8. Navigating to Reports Page...")
  await kimiCmd("navigate", { url: `${baseUrl}/reports` })
  await new Promise((r) => setTimeout(r, 2000))
  const repBody = await evalJs("document.body.innerText")
  assert.ok(repBody.includes("基础报表与合规经营指标"), "基础报表标题正常")
  let repShot = await kimiCmd("screenshot", { path: path.join(OUT_DIR, "kimi-04-reports.png") })
  let rPath = repShot.data?.path || repShot.path
  assert.ok(rPath && fs.existsSync(rPath), "报表页面截图必须生成")
  try { if (rPath) fs.copyFileSync(rPath, path.join(VIZ_DIR, "kimi-04-reports.png")) } catch (_) {}
  console.log("[kimi-acceptance] Saved reports screenshot:", rPath)

  // Step 7: Activity / Training Center Verification
  console.log("[kimi-acceptance] 9. Navigating to Activity / Training Center...")
  await kimiCmd("navigate", { url: `${baseUrl}/activity` })
  await new Promise((r) => setTimeout(r, 2000))
  const actBody = await evalJs("document.body.innerText")
  assert.ok(actBody.includes("员工业务记录") && actBody.includes("学习记录与考核"), "培训中心正常加载")
  let actShot = await kimiCmd("screenshot", { path: path.join(OUT_DIR, "kimi-05-activity.png") })
  let aPath = actShot.data?.path || actShot.path
  assert.ok(aPath && fs.existsSync(aPath), "培训业务截图必须生成")
  try { if (aPath) fs.copyFileSync(aPath, path.join(VIZ_DIR, "kimi-05-activity.png")) } catch (_) {}
  console.log("[kimi-acceptance] Saved activity screenshot:", aPath)

  // Step 8: Auditor restricted access test (403 Forbidden)
  console.log("[kimi-acceptance] 10. Testing Auditor restricted access...")
  await evalJs("localStorage.removeItem('yuqi_auth_session')")
  await kimiCmd("navigate", { url: `${baseUrl}/login` })
  await new Promise((r) => setTimeout(r, 1500))
  await kimiCmd("evaluate", {
    code: `(() => {
      const setVal = (sel, val) => {
        const el = document.querySelector(sel);
        if (!el) return;
        const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        desc.set.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      setVal('#username', 'auditor');
      setVal('#password', 'Passw0rd!');
      const form = document.querySelector('form');
      if (form) form.requestSubmit();
    })()`
  })
  await new Promise((r) => setTimeout(r, 3000))

  // Auditor direct URL to /permissions -> should be blocked to /403
  await kimiCmd("navigate", { url: `${baseUrl}/permissions` })
  await new Promise((r) => setTimeout(r, 2000))
  const auditorUrl = await evalJs("window.location.pathname")
  assert.equal(auditorUrl, "/403", "审计员访问权限页必须被 403 拦截")
  let forbadShot = await kimiCmd("screenshot", { path: path.join(OUT_DIR, "kimi-06-forbidden-auditor.png") })
  let fPath = forbadShot.data?.path || forbadShot.path
  assert.ok(fPath && fs.existsSync(fPath), "403拦截截图必须生成")
  try { if (fPath) fs.copyFileSync(fPath, path.join(VIZ_DIR, "kimi-06-forbidden-auditor.png")) } catch (_) {}
  console.log("[kimi-acceptance] Saved auditor 403 screenshot:", fPath)

  console.log("[kimi-acceptance] Closing browser session and cleanup...");
  await kimiCmd("close_session")
  preview.kill()
  await pbServer.stop()
  console.log("[kimi-acceptance] All Kimi WebBridge browser verifications successfully finished!");
}

main().catch((err) => {
  console.error("[kimi-acceptance] Fatal:", err)
  process.exit(1)
})
