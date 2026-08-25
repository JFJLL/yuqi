import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { fetchMyIssues, type Issue } from "./employeeApi"

const riskColor: Record<string, "destructive" | "secondary" | "outline"> = {
  HIGH: "destructive",
  MEDIUM: "secondary",
  LOW: "outline",
}

export function EmployeeIssues() {
  const [items, setItems] = useState<Issue[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    fetchMyIssues().then((d) => setItems(d.items)).catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
  }, [])

  if (error) return <p className="text-sm text-destructive">{error}</p>

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">我的疑似问题</h2>
      <p className="text-xs text-muted-foreground -mt-2">以下问题已由管理人员复核并推送，供本人查看与处理。</p>
      {items.length === 0 && <p className="text-sm text-muted-foreground">暂无已推送问题</p>}
      {items.map((it) => (
        <Link key={it.id} to={`/employee/issues/${it.id}`} className="no-underline">
          <Card className="hover:bg-accent/50 transition-colors">
            <CardContent className="pt-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium leading-snug">{it.title}</span>
                <Badge variant={riskColor[it.risk_level] ?? "outline"}>{it.risk_level}</Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{it.evidence_text}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{it.rule_code}</span>
                <span>{it.pushed_at ? new Date(it.pushed_at).toLocaleDateString() : ""}</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
