import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { fetchProfile, type EmployeeProfile } from "./employeeApi"

export function EmployeeProfilePage() {
  const [data, setData] = useState<EmployeeProfile | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchProfile().then(setData).catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
  }, [])

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!data) return <p className="text-sm text-muted-foreground">加载中…</p>

  const rows: Array<[string, string]> = [
    ["姓名", data.employee?.name ?? data.user.display_name ?? ""],
    ["手机号", data.employee?.phone ?? data.user.mobile ?? ""],
    ["岗位", data.employee?.role ?? ""],
    ["所属门店", data.store?.name ?? "—"],
    ["在职状态", data.employee?.status ?? ""],
    ["账号", data.user.email ?? ""],
  ]

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">个人信息</h2>
      <Card>
        <CardContent className="pt-4 flex flex-col divide-y">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-muted-foreground">{k}</span>
              <span>{v || "—"}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        系统识别结果仅为疑似风险，最终判断由授权管理人员完成。
      </p>
    </div>
  )
}
