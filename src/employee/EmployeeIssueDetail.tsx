import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { fetchIssueDetail, submitAppeal, type Issue, type RiskSegment } from "./employeeApi"

const riskColor: Record<string, "destructive" | "secondary" | "outline"> = {
  HIGH: "destructive",
  MEDIUM: "secondary",
  LOW: "outline",
}

function fmtMs(ms: number) {
  if (!ms && ms !== 0) return ""
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, "0")}`
}

export function EmployeeIssueDetail() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const [issue, setIssue] = useState<Issue | null>(null)
  const [segments, setSegments] = useState<RiskSegment[]>([])
  const [error, setError] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchIssueDetail(id).then((d) => {
      setIssue(d.issue)
      setSegments(d.segments)
    }).catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
  }, [id])

  async function handleAppeal(e: FormEvent) {
    e.preventDefault()
    if (reason.trim().length < 2) {
      toast.error("请填写申诉理由")
      return
    }
    setSubmitting(true)
    try {
      await submitAppeal(issue!.id, reason.trim())
      toast.success("申诉已提交")
      navigate("/employee/appeals", { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "提交失败")
    } finally {
      setSubmitting(false)
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!issue) return <p className="text-sm text-muted-foreground">加载中…</p>

  const canAppeal = issue.appeal_status === "NONE" || issue.appeal_status === "REJECTED" || issue.appeal_status === "CANCELLED"

  return (
    <div className="flex flex-col gap-3">
      <Button variant="ghost" size="sm" className="w-fit -ml-2 text-muted-foreground" asChild>
        <Link to="/employee/issues"><ArrowLeft className="w-4 h-4" />返回列表</Link>
      </Button>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm leading-snug">{issue.title}</CardTitle>
            <Badge variant={riskColor[issue.risk_level] ?? "outline"}>{issue.risk_level}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div>
            <span className="text-xs text-muted-foreground">规则编码：</span>
            <span className="font-mono text-xs">{issue.rule_code}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">风险原因：</span>
            <p className="mt-0.5">{issue.summary}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">整改建议：</span>
            <p className="mt-0.5">{issue.advice}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">推荐表达：</span>
            <p className="mt-0.5 text-primary">{issue.recommended_expression}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">证据片段</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {segments.length === 0 && <p className="text-xs text-muted-foreground">暂无片段</p>}
          {segments.map((seg) => (
            <div key={seg.id} className="rounded-lg border p-3 flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{seg.speaker}</span>
                <span className="font-mono">{fmtMs(seg.start_ms)} – {fmtMs(seg.end_ms)}</span>
              </div>
              <p className="text-sm">{seg.text}</p>
            </div>
          ))}
          <p className="text-xs text-muted-foreground mt-1">
            系统识别结果仅为疑似风险，最终判断由授权管理人员完成。
          </p>
        </CardContent>
      </Card>

      {canAppeal && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">发起申诉</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAppeal} className="flex flex-col gap-2">
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="请说明申诉理由，例如：该话术为顾客自述，非本人表达"
                rows={3}
              />
              <Button type="submit" disabled={submitting}>
                {submitting ? "提交中…" : "提交申诉"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {issue.rectification_status !== "NONE" && issue.rectification_status !== "CONFIRMED" && (
        <Button variant="outline" asChild>
          <Link to="/employee/rectifications">查看整改任务 →</Link>
        </Button>
      )}
    </div>
  )
}
