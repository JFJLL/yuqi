import { useCallback, useEffect, useState } from "react"
import {
  ApiError,
  authApi,
  meApi,
  setToken,
  getToken,
  type LoginPayload,
  type MyIssue,
  type MyRectification,
} from "./api"
import "./app.css"

const STATUS_LABEL: Record<string, string> = {
  APPEALING: "申诉中",
  APPEAL_APPROVED: "申诉通过",
  APPEAL_REJECTED: "申诉驳回",
  PENDING: "待整改",
  SUBMITTED: "待确认",
  CONFIRMED: "已完成",
  REJECTED: "已驳回",
  DISMISSED: "已驳回",
}

function statusText(status: string): string {
  return STATUS_LABEL[status] ?? status
}

// ---------- 登录 ----------
function LoginView({ onLoggedIn }: { onLoggedIn: (payload: LoginPayload) => void }) {
  const [mobile, setMobile] = useState("")
  const [code, setCode] = useState("")
  const [debugCode, setDebugCode] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const send = async () => {
    setBusy(true)
    setError("")
    try {
      const resp = await authApi.sendSms(mobile.trim())
      setSent(true)
      // 非生产环境 mock provider 会在响应中带 debug_code, 便于开发调试
      if (resp.debug_code) setDebugCode(resp.debug_code)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "发送失败")
    } finally {
      setBusy(false)
    }
  }

  const login = async () => {
    setBusy(true)
    setError("")
    try {
      const payload = await authApi.loginBySms(mobile.trim(), code.trim())
      onLoggedIn(payload)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "登录失败")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <h1>员工合规助手</h1>
      <p className="muted">使用本人在门店档案中登记的手机号登录</p>
      <label>手机号</label>
      <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="13800000000" inputMode="tel" />
      <label>验证码</label>
      <div className="row">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="6 位验证码"
          inputMode="numeric"
        />
        <button disabled={busy || mobile.trim().length < 6} onClick={send}>
          {sent ? "重新发送" : "获取验证码"}
        </button>
      </div>
      {debugCode && sent && <p className="debug">开发环境验证码：{debugCode}</p>}
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy || code.length < 4} onClick={login}>
        登录
      </button>
    </div>
  )
}

// ---------- 我的问题 ----------
function IssuesView({ onLogout }: { onLogout: () => void }) {
  const [issues, setIssues] = useState<MyIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [appealing, setAppealing] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await meApi.issues()
      setIssues(data.items)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const appeal = async (id: string) => {
    setAppealing(id)
    setError("")
    try {
      await meApi.appeal(id, reason.trim() || "申请复核该问题")
      setReason("")
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "申诉失败")
    } finally {
      setAppealing(null)
    }
  }

  return (
    <section>
      <div className="header">
        <h2>我的问题</h2>
        <button onClick={onLogout}>退出</button>
      </div>
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">加载中…</p>}
      {!loading && issues.length === 0 && <p className="muted">暂无问题记录</p>}
      {issues.map((issue) => (
        <article key={issue.id} className="card">
          <div className="row-between">
            <strong>{issue.issue_type}</strong>
            <span className={`risk risk-${issue.risk}`}>{issue.risk}风险</span>
          </div>
          <blockquote>{issue.quote}</blockquote>
          <p className="muted">{statusText(issue.state)} · {issue.occurred_at?.slice(0, 10) ?? "-"}</p>
          {issue.appeal_status === "APPEALING" ? (
            <p className="muted">申诉处理中</p>
          ) : issue.appeal_status === "NONE" ? (
            <div className="appeal-box">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="申诉理由（可选）" />
              <button disabled={appealing === issue.id} onClick={() => void appeal(issue.id)}>
                申诉
              </button>
            </div>
          ) : (
            <p className="muted">{statusText(issue.appeal_status)}</p>
          )}
        </article>
      ))}
    </section>
  )
}

// ---------- 我的整改 ----------
function RectificationsView({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<MyRectification[]>([])
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await meApi.rectifications()
      setItems(data.items)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const submit = async (id: string) => {
    setSubmitting(id)
    setError("")
    try {
      await meApi.submitRectification(id, comments[id]?.trim() || "已完成整改")
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "提交失败")
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <section>
      <div className="header">
        <button onClick={onBack}>← 返回</button>
        <h2>我的整改</h2>
      </div>
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">加载中…</p>}
      {!loading && items.length === 0 && <p className="muted">暂无整改任务</p>}
      {items.map((item) => (
        <article key={item.id} className="card">
          <div className="row-between">
            <strong>{item.title}</strong>
            <span className="muted">{statusText(item.status)}</span>
          </div>
          <blockquote>{item.quote}</blockquote>
          <p className="muted">
            截止 {item.due_date.slice(0, 10)} · 进度 {item.progress}%
            {item.escalation_count > 0 ? ` · 已升级 ${item.escalation_count} 次` : ""}
          </p>
          {item.status === "PENDING" && (
            <div className="appeal-box">
              <input
                value={comments[item.id] ?? ""}
                onChange={(e) => setComments((prev) => ({ ...prev, [item.id]: e.target.value }))}
                placeholder="整改说明（可选）"
              />
              <button disabled={submitting === item.id} onClick={() => void submit(item.id)}>
                提交整改
              </button>
            </div>
          )}
          {item.status === "SUBMITTED" && <p className="muted">已提交，等待店长确认</p>}
        </article>
      ))}
    </section>
  )
}

// ---------- 主壳 ----------
export default function App() {
  const [payload, setPayload] = useState<LoginPayload | null>(null)
  const [tab, setTab] = useState<"issues" | "rectifications">("issues")

  // 简单会话恢复: 内存 Token (刷新页面需重新登录; 生产可接入 Cookie 轮换)
  useEffect(() => {
    if (getToken() && !payload) {
      void meApi.issues().then((data) => {
        if (data) {
          setPayload({ access_token: getToken()!, expires_in: 0, user: { id: "", display_name: "员工", mobile: null }, tenant: { id: "", code: "", name: "" }, permissions: [] })
        }
      }).catch(() => setToken(null))
    }
  }, [payload])

  const onLoggedIn = (p: LoginPayload) => {
    setToken(p.access_token)
    setPayload(p)
  }

  const onLogout = () => {
    setToken(null)
    setPayload(null)
  }

  if (!payload) return <LoginView onLoggedIn={onLoggedIn} />

  return (
    <div className="app">
      <p className="hello">你好，{payload.user.display_name || "员工"}（{payload.tenant.name}）</p>
      <nav>
        <button className={tab === "issues" ? "active" : ""} onClick={() => setTab("issues")}>
          我的问题
        </button>
        <button className={tab === "rectifications" ? "active" : ""} onClick={() => setTab("rectifications")}>
          我的整改
        </button>
      </nav>
      {tab === "issues" ? <IssuesView onLogout={onLogout} /> : <RectificationsView onBack={() => setTab("issues")} />}
    </div>
  )
}
