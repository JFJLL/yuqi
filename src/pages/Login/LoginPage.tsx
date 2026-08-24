import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Cross } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth"

// 管理端登录页: 账号或手机号 + 密码, 后端 Argon2id 校验 + 登录限流
export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) {
      toast.error("请输入账号和密码")
      return
    }
    setSubmitting(true)
    try {
      await login(username.trim(), password)
      toast.success("登录成功")
      navigate("/", { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "登录失败, 请稍后重试")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-muted/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="w-11 h-11 rounded-xl bg-primary grid place-items-center text-primary-foreground">
            <Cross className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-semibold">药店AI运营管理后台</h1>
          <p className="text-xs text-muted-foreground">智能工牌销售合规系统 · 一期</p>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="username">账号 / 手机号</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="请输入账号或手机号"
              disabled={submitting}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="请输入密码"
              disabled={submitting}
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "登录中…" : "登 录"}
          </Button>
        </form>
      </div>
    </div>
  )
}
