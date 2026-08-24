// VibeX 把每个 app 部署在子路径下 (/app-preview/app-<32hex>/ 或 /p/app-<32hex>/)。
// 这个正则提取该前缀; 本地直跑 dev (无前缀)时返回 null。
function matchVibexPrefix(): string | null {
  if (typeof window === "undefined") return null
  const m = window.location.pathname.match(/^\/(?:app-preview|p)\/app-[0-9a-f]{32}(?=\/|$)/)
  return m ? m[0] : null
}

// React Router 的 basename: 子路径部署时返回 app 前缀, 本地 dev 返回 "/"。
// <BrowserRouter basename={getBasename()}> 之后, 站内 <Link to="/x"> / navigate("/x")
// 会自动拼上前缀, 不会再掉到域名根。
export function getBasename(): string {
  return matchVibexPrefix() ?? "/"
}
