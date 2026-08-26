import { useState, type FormEvent } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { adminLogin, currentRole } from "@/lib/auth"

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const from = (location.state as { from?: string } | null)?.from ?? "/"

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorMessage("")
    if (!username || !password) {
      setErrorMessage("请输入用户名和密码")
      toast.error("请输入用户名和密码")
      return
    }
    setLoading(true)
    try {
      await adminLogin(username.trim(), password)
      toast.success("登录成功，欢迎使用集团巡检管理后台")
      const role = currentRole()
      navigate(role === "EMPLOYEE" ? "/employee/home" : from, { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "登录失败，请检查用户名与密码"
      setErrorMessage(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-[#edf2f6] px-4 font-sans">
      <div className="w-[420px] max-w-full bg-white border border-[#dbe3ec] rounded-lg shadow-[0_18px_50px_rgba(16,34,54,0.12)] p-7">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-[38px] h-[38px] rounded-[7px] bg-[#2587bf] grid place-items-center text-white shrink-0 shadow-sm">
            <ShieldCheck className="w-[23px] h-[23px]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#172033] leading-tight m-0">集团巡检管理</h1>
            <p className="mt-0.5 text-xs text-[#65738a] m-0">请登录总部工作台</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-xs font-medium text-[#65738a]">用户名</label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入管理员用户名"
              autoComplete="username"
              className="h-9 border-[#cfd9e4] focus:border-[#438cb5] focus:ring-2 focus:ring-[#438cb5]/20 bg-white"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-medium text-[#65738a]">密码</label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
              className="h-9 border-[#cfd9e4] focus:border-[#438cb5] focus:ring-2 focus:ring-[#438cb5]/20 bg-white"
            />
          </div>

          {errorMessage && (
            <div className="text-xs text-[#b43c3c] bg-[#fae9e9] border border-[#f3c2c2] rounded p-2">
              {errorMessage}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full h-10 bg-[#1672a8] hover:bg-[#125c88] text-white font-medium">
            {loading ? "登录中…" : "登录系统"}
          </Button>
          <p className="text-xs text-[#65738a] text-center mt-2">
            员工请使用手机验证码登录
            <a href="/employee/login" className="ml-1 text-[#1672a8] hover:underline font-medium">员工入口 →</a>
          </p>
        </form>
      </div>
    </div>
  )
}
