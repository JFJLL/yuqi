import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { fetchMyRectifications, submitRectification, type Rectification } from "./employeeApi"

const statusLabel: Record<string, string> = {
  PENDING: "待提交",
  SUBMITTED: "已提交待确认",
  NEEDS_REVISION: "已退回",
  CONFIRMED: "已确认",
  OVERDUE: "已逾期",
  CANCELLED: "已取消",
}

export function EmployeeRectifications() {
  const [items, setItems] = useState<Rectification[]>([])
  const [error, setError] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [evidence, setEvidence] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchMyRectifications().then((d) => setItems(d.items)).catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
  }, [])

  async function handleSubmit(e: FormEvent, id: string) {
    e.preventDefault()
    if (text.trim().length < 2) {
      toast.error("请填写整改说明")
      return
    }
    setSubmitting(true)
    try {
      await submitRectification(id, text.trim(), evidence.trim() || undefined)
      toast.success("整改已提交，等待确认")
      setOpenId(null)
      setText("")
      setEvidence("")
      const d = await fetchMyRectifications()
      setItems(d.items)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "提交失败")
    } finally {
      setSubmitting(false)
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">我的整改任务</h2>
      {items.length === 0 && <p className="text-sm text-muted-foreground">暂无整改任务</p>}
      {items.map((it) => (
        <Card key={it.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm">{it.title}</CardTitle>
              <Badge variant={it.status === "CONFIRMED" ? "default" : it.status === "NEEDS_REVISION" || it.status === "OVERDUE" ? "destructive" : "secondary"}>
                {statusLabel[it.status] ?? it.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {it.requirements && <p className="text-xs text-muted-foreground">要求：{it.requirements}</p>}
            {it.due_at && (
              <p className="text-xs text-muted-foreground">
                截止：{new Date(it.due_at).toLocaleDateString()}
                {it.retry_count > 0 && ` · 退回 ${it.retry_count} 次`}
              </p>
            )}
            {it.confirmation_comment && <p className="text-xs text-destructive">退回原因：{it.confirmation_comment}</p>}
            {it.submission_text && <p className="text-xs text-muted-foreground">说明：{it.submission_text}</p>}
            {(it.status === "PENDING" || it.status === "NEEDS_REVISION" || it.status === "OVERDUE") && (
              <>
                {openId === it.id ? (
                  <form onSubmit={(e) => handleSubmit(e, it.id)} className="flex flex-col gap-2 mt-1">
                    <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="填写整改说明" />
                    <Input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="凭证文件名（可选）" />
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={submitting}>{submitting ? "提交中…" : "提交整改"}</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setOpenId(null)}>取消</Button>
                    </div>
                  </form>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => { setOpenId(it.id); setText(""); setEvidence("") }}>填写并提交</Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
