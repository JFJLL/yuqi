import { useState, type FormEvent } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Cross } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { adminLogin, currentRole } from "@/lib/auth"

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? "/"

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!username || !password) {
      toast.error("请输入账号和密码")
      return
    }
    setLoading(true)
    try {
      await adminLogin(username.trim(), password)
      toast.success("登录成功")
      const role = currentRole()
      navigate(role === "EMPLOYEE" ? "/employee/home" : from, { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "登录失败，请检查账号密码"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary grid place-items-center text-primary-foreground">
            <Cross className="w-6 h-6" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold">药店AI运营 · 管理端</h1>
            <p className="mt-1 text-sm text-muted-foreground">销售合规智能巡检系统</p>
          </div>
        </div>
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border bg-card p-6 shadow-sm flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-sm font-medium">账号</label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="邮箱或用户名"
              autoComplete="username"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium">密码</label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="登录密码"
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "登录中…" : "登录"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            员工请使用手机验证码登录
            <a href="/employee/login" className="ml-1 text-primary hover:underline">员工入口 →</a>
          </p>
        </form>
      </div>
    </div>
  )
}
