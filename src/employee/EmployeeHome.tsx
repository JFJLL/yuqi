import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchHome, type EmployeeHome } from "./employeeApi"

export function EmployeeHome() {
  const [data, setData] = useState<EmployeeHome | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchHome().then(setData).catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
  }, [])

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!data) return <p className="text-sm text-muted-foreground">加载中…</p>

  const items = [
    { label: "待办问题", value: data.issue_count, to: "/employee/issues" },
    { label: "待办整改", value: data.rectification_count, to: "/employee/rectifications" },
    { label: "申诉中", value: data.appeal_count, to: "/employee/appeals" },
    { label: "未读消息", value: data.unread_notifications, to: "/employee/notifications" },
  ]

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-4 gap-2 text-center">
            {items.map((it) => (
              <Link key={it.label} to={it.to} className="flex flex-col items-center gap-1 no-underline">
                <span className="text-2xl font-semibold text-primary">{it.value}</span>
                <span className="text-xs text-muted-foreground">{it.label}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">我的设备</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {data.binding ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">绑定状态</span>
                <Badge>已绑定</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">设备ID</span>
                <span className="font-mono">{data.binding.device}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">生效日期</span>
                <span>{new Date(data.binding.effective_date).toLocaleDateString()}</span>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">尚未绑定设备</p>
              <Button asChild size="sm">
                <Link to="/employee/device">去绑定</Link>
              </Button>
            </>
          )}
          {!data.consent && (
            <Button asChild variant="outline" size="sm" className="mt-1">
              <Link to="/employee/consent">确认录音制度 →</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        系统识别结果仅为疑似风险，最终判断由授权管理人员完成。
      </p>
    </div>
  )
}
