import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { employeeLogin, sendSmsCode } from "@/lib/auth"

export function EmployeeLogin() {
  const navigate = useNavigate()
  const [mobile, setMobile] = useState("")
  const [code, setCode] = useState("")
  const [sending, setSending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(false)

  async function handleSendCode() {
    if (!/^1\d{10}$/.test(mobile)) {
      toast.error("请输入正确的 11 位手机号")
      return
    }
    setSending(true)
    try {
      const res = await sendSmsCode(mobile)
      toast.success(res.sms_configured ? "验证码已发送" : "短信服务未配置")
      setCountdown(60)
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) clearInterval(timer)
          return c - 1
        })
      }, 1000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "发送失败，请稍后再试")
    } finally {
      setSending(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!/^1\d{10}$/.test(mobile) || !/^\d{4,6}$/.test(code)) {
      toast.error("请输入正确的手机号和验证码")
      return
    }
    setLoading(true)
    try {
      await employeeLogin(mobile, code)
      toast.success("登录成功")
      navigate("/employee/home", { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "登录失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary grid place-items-center text-primary-foreground">
            <Smartphone className="w-6 h-6" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold">员工端登录</h1>
            <p className="mt-1 text-sm text-muted-foreground">使用手机号验证码登录</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-6 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mobile" className="text-sm font-medium">手机号</label>
            <Input
              id="mobile"
              inputMode="numeric"
              maxLength={11}
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
              placeholder="请输入手机号"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="code" className="text-sm font-medium">验证码</label>
            <div className="flex gap-2">
              <Input
                id="code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="6 位验证码"
              />
              <Button type="button" variant="outline" className="w-28 shrink-0" disabled={sending || countdown > 0} onClick={handleSendCode}>
                {countdown > 0 ? `${countdown}s` : sending ? "发送中…" : "获取验证码"}
              </Button>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "登录中…" : "登录"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            管理端入口
            <a href="/login" className="ml-1 text-primary hover:underline">前往登录 →</a>
          </p>
        </form>
      </div>
    </div>
  )
}
