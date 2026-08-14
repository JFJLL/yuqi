import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { getBasename } from './lib/pb'
import './_rh_session_bootstrap'
import './index.css'
import App from './App.tsx'

// Visual Edit runtime, dev only. 不要删这一行.
// (生产 build 时 import.meta.env.DEV = false, 整段被 tree-shake 掉.)
if (import.meta.env.DEV) import('./_rh_inspect').catch(() => undefined)

// App.tsx 用 <Routes>, 必须有 Router 祖先, 否则 react-router 直接 throw → 整页白屏.
// basename={getBasename()}: app 部署在 /app-preview/app-<id>/ 子路径下, 站内跳转需带前缀.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={getBasename()}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
