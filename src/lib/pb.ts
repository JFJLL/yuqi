import PocketBase from "pocketbase"

import { vibexAuthHeaders } from "./rhLogin"
import { getSessionToken } from "./auth"

// VibeX 把每个 app 部署在子路径下 (/app-preview/app-<32hex>/ 或 /p/app-<32hex>/)。
// 这个正则提取该前缀; 本地直跑 dev (无前缀)时返回 null。
function matchVibexPrefix(): string | null {
  if (typeof window === "undefined") return null
  const m = window.location.pathname.match(/^\/(?:app-preview|p)\/app-[0-9a-f]{32}(?=\/|$)/)
  return m ? m[0] : null
}

// 浏览器侧用 VibeX 路径推 __pb 代理前缀; 本地直跑 dev (无 app-preview 前缀)时 fallback 到 /__pb
export function getPocketBaseUrl(): string {
  const prefix = matchVibexPrefix()
  return prefix ? `${prefix}/__pb` : "/__pb"
}

// React Router 的 basename: 子路径部署时返回 app 前缀, 本地 dev 返回 "/"。
// <BrowserRouter basename={getBasename()}> 之后, 站内 <Link to="/x"> / navigate("/x")
// 会自动拼上前缀, 不会再掉到域名根 (即 vibex.runninghub.cn/x 这种错误跳转)。
export function getBasename(): string {
  return matchVibexPrefix() ?? "/"
}

export const pb = new PocketBase(getPocketBaseUrl())

// 禁用 SDK 自动取消: StrictMode 双跑 effect / 连续请求会互相 abort (如登录后 /me、员工首页)
pb.autoCancellation(false)

// B1 沙箱域(*.apps.vibex.cn)上访问者身份靠 X-Vibex-Scoped-Token 承载
// (老域 vibexAuthHeaders() 返回空对象, 零影响)。挂在 SDK 层, 让所有
// pb.collection(...) 请求自动携带, 业务代码不用感知。
pb.beforeSend = (url, options) => {
  const headers = { ...(options.headers || {}) }
  const extra = vibexAuthHeaders()
  if (Object.keys(extra).length > 0) {
    Object.assign(headers, extra)
  }
  // 会话自管: 注入一期业务 Token (SDK authStore 为空时也带上)
  const token = getSessionToken()
  if (token && !headers.Authorization) {
    headers.Authorization = token
  }
  return { url, options: { ...options, headers } }
}

pb.authStore.onChange(() => {
  // hook for UI updates; 业务代码按需订阅
}, true)
