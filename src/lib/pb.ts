import PocketBase from "pocketbase"

import { vibexAuthHeaders } from "./rhLogin"

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

// 仅 AI 能力 (aigc/llm) 通过 __pb 代理调用 pb_hooks 路由; 业务数据一律走 /api/v1。
export const pb = new PocketBase(getPocketBaseUrl())

// B1 沙箱域(*.apps.vibex.cn)上访问者身份靠 X-Vibex-Scoped-Token 承载
// (老域 vibexAuthHeaders() 返回空对象, 零影响)。挂在 SDK 层, 让所有
// pb.collection(...) 请求自动携带, 业务代码不用感知。
pb.beforeSend = (url, options) => {
  const extra = vibexAuthHeaders()
  if (Object.keys(extra).length > 0) {
    options.headers = { ...(options.headers || {}), ...extra }
  }
  return { url, options }
}

pb.authStore.onChange(() => {
  // hook for UI updates; 业务代码按需订阅
}, true)
