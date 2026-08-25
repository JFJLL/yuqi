import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { fetchMyAppeals, supplementAppeal, type Appeal } from "./employeeApi"

const statusLabel: Record<string, string> = {
  PENDING: "待复核",
  NEEDS_MORE_INFO: "待补充",
  APPROVED: "申诉成立",
  REJECTED: "申诉驳回",
  CANCELLED: "已取消",
}

export function EmployeeAppeals() {
  const [items, setItems] = useState<Appeal[]>([])
  const [error, setError] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchMyAppeals().then((d) => setItems(d.items)).catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
  }, [])

  async function handleSupplement(e: FormEvent, id: string) {
    e.preventDefault()
    if (text.trim().length < 2) {
      toast.error("请填写补充说明")
      return
    }
    setSubmitting(true)
    try {
      await supplementAppeal(id, text.trim())
      toast.success("补充说明已提交")
      setOpenId(null)
      setText("")
      const d = await fetchMyAppeals()
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
      <h2 className="text-base font-semibold">我的申诉</h2>
      {items.length === 0 && <p className="text-sm text-muted-foreground">暂无申诉记录</p>}
      {items.map((it) => (
        <Card key={it.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm">申诉 #{it.id.slice(0, 8)}</CardTitle>
              <Badge variant={it.status === "APPROVED" ? "default" : it.status === "REJECTED" ? "destructive" : "secondary"}>
                {statusLabel[it.status] ?? it.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="text-xs text-muted-foreground">理由：{it.reason}</p>
            {it.supplementary_text && <p className="text-xs text-muted-foreground">补充：{it.supplementary_text}</p>}
            {it.review_comment && <p className="text-xs">复核意见：{it.review_comment}</p>}
            {(it.status === "PENDING" || it.status === "NEEDS_MORE_INFO") && (
              <>
                {openId === it.id ? (
                  <form onSubmit={(e) => handleSupplement(e, it.id)} className="flex flex-col gap-2 mt-1">
                    <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="补充说明（不覆盖原申诉内容）" />
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={submitting}>{submitting ? "提交中…" : "提交补充"}</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setOpenId(null)}>取消</Button>
                    </div>
                  </form>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setOpenId(it.id)}>补充说明</Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
