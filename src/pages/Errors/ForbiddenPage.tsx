import { Link } from "react-router-dom"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ForbiddenPage() {
  return (
    <div className="min-h-[60vh] grid place-items-center">
      <div className="text-center">
        <ShieldAlert className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h1 className="text-2xl font-semibold mb-1">403 · 没有权限</h1>
        <p className="text-sm text-muted-foreground mb-5">您没有权限访问该页面, 请联系管理员。</p>
        <Button asChild>
          <Link to="/">返回工作台</Link>
        </Button>
      </div>
    </div>
  )
}
