import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { fetchDevice, requestBinding } from "./employeeApi"

export function EmployeeDevice() {
  const [data, setData] = useState<{ binding: unknown; device: { device_no?: string; status?: string } | null; consent: boolean } | null>(null)
  const [error, setError] = useState("")
  const [deviceNo, setDeviceNo] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchDevice().then(setData).catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
  }, [])

  async function handleRequest(e: FormEvent) {
    e.preventDefault()
    if (!deviceNo.trim()) {
      toast.error("请输入设备码")
      return
    }
    setSubmitting(true)
    try {
      await requestBinding(deviceNo.trim())
      toast.success("绑定申请已提交，等待店长或管理员审批")
      setDeviceNo("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "申请失败")
    } finally {
      setSubmitting(false)
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!data) return <p className="text-sm text-muted-foreground">加载中…</p>

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">当前设备</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {data.device ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">设备号</span>
                <span className="font-mono">{data.device.device_no}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">状态</span>
                <Badge variant={data.device.status === "ACTIVE" || data.device.status === "ONLINE" ? "default" : "secondary"}>
                  {data.device.status}
                </Badge>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">未绑定设备</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">发起绑定申请</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRequest} className="flex gap-2">
            <Input
              value={deviceNo}
              onChange={(e) => setDeviceNo(e.target.value)}
              placeholder="输入设备码，如 DEV-001"
              className="font-mono"
            />
            <Button type="submit" disabled={submitting}>{submitting ? "提交中…" : "申请"}</Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">申请需经店长或管理员审批后生效。</p>
        </CardContent>
      </Card>

      {!data.consent && (
        <Button asChild variant="outline">
          <a href="/employee/consent">先确认录音制度 →</a>
        </Button>
      )}
    </div>
  )
}
