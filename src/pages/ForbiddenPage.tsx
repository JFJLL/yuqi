import { Link } from "react-router-dom"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ForbiddenPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="text-center flex flex-col items-center gap-3">
        <ShieldAlert className="w-12 h-12 text-destructive" />
        <h1 className="text-2xl font-semibold">403 · 无权访问</h1>
        <p className="text-sm text-muted-foreground">当前账号没有访问该页面的权限，如有疑问请联系管理员。</p>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/">返回工作台</Link>
          </Button>
          <Button asChild>
            <Link to="/employee/home">员工首页</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
