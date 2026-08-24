import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, type Notification } from "./employeeApi"

export function EmployeeNotifications() {
  const [items, setItems] = useState<Notification[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    fetchNotifications().then((d) => setItems(d.items)).catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
  }, [])

  async function handleRead(it: Notification) {
    if (it.is_read) return
    await markNotificationRead(it.id).catch(() => undefined)
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, is_read: true } : x)))
  }

  async function handleReadAll() {
    await markAllNotificationsRead().catch(() => undefined)
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })))
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">消息中心</h2>
        <Button variant="ghost" size="sm" onClick={handleReadAll}>全部已读</Button>
      </div>
      {items.length === 0 && <p className="text-sm text-muted-foreground">暂无消息</p>}
      {items.map((it) => (
        <Card key={it.id} className={it.is_read ? "opacity-70" : ""} onClick={() => handleRead(it)}>
          <CardContent className="pt-4 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{it.title}</span>
              {!it.is_read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
            </div>
            <p className="text-xs text-muted-foreground">{it.body}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{new Date(it.created).toLocaleString()}</span>
              {it.link && (
                <Link to={it.link} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>查看 →</Link>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
