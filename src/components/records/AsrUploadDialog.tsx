import { useMemo, useState } from "react"
import { Upload } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { AsrSubmission } from "@/lib/asr"

export interface NamedOption {
  id: string
  name: string
  store?: string | null
}

type Employee = NamedOption
type Store = NamedOption

const ACCEPTED_AUDIO = ".wav,.mp3,.m4a,.flac,.ogg,.aac,.webm"
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024
const fieldClass =
  "min-h-9 w-full border border-border rounded-lg bg-card text-foreground outline-none px-2.5 text-sm focus:border-primary focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"

interface AsrUploadDialogProps {
  open: boolean
  stores: Store[]
  employees: Employee[]
  submitting: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: AsrSubmission) => Promise<void>
}

function currentDateTimeLocal() {
  const now = new Date()
  const timezoneOffset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

export function AsrUploadDialog({ open, stores, employees, submitting, onOpenChange, onSubmit }: AsrUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [store, setStore] = useState("")
  const [employee, setEmployee] = useState("")
  const [device, setDevice] = useState("")
  const [occurredAt, setOccurredAt] = useState(currentDateTimeLocal)
  const [hotwords, setHotwords] = useState("")
  const [error, setError] = useState("")

  const selectableEmployees = useMemo(
    () => employees.filter((item) => !store || item.store === store),
    [employees, store],
  )

  function reset() {
    setFile(null)
    setStore("")
    setEmployee("")
    setDevice("")
    setOccurredAt(currentDateTimeLocal())
    setHotwords("")
    setError("")
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !submitting) reset()
    onOpenChange(nextOpen)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) {
      setError("请选择需要转写的音频文件")
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("音频文件不能超过 200 MB")
      return
    }
    setError("")
    try {
      await onSubmit({
        file,
        device,
        employee,
        store,
        occurred_at: new Date(occurredAt).toISOString(),
        hotwords,
        language: "zh-CN",
      })
      reset()
      onOpenChange(false)
    } catch {
      // 上层已通过 toast 告知失败原因，保留当前表单以便修正并重试。
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>上传录音并开始转写</DialogTitle>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="asr-audio-file">
              音频文件
            </label>
            <input
              id="asr-audio-file"
              className={`${fieldClass} py-1.5`}
              type="file"
              accept={ACCEPTED_AUDIO}
              disabled={submitting}
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null
                setFile(next)
                setError(next && next.size > MAX_UPLOAD_BYTES ? "音频文件不能超过 200 MB" : "")
              }}
            />
            <p className="m-0 text-xs text-muted-foreground">
              支持 WAV、MP3、M4A、FLAC、OGG、AAC、WebM，最大 200 MB。音频仅通过云端网关提交至 ASR 服务。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <label className="grid gap-1.5 text-sm font-medium">
              门店
              <select
                className={fieldClass}
                value={store}
                disabled={submitting}
                onChange={(event) => {
                  const nextStore = event.target.value
                  setStore(nextStore)
                  if (employee && !employees.some((item) => item.id === employee && (!nextStore || item.store === nextStore))) {
                    setEmployee("")
                  }
                }}
              >
                <option value="">未关联门店</option>
                {stores.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              员工
              <select className={fieldClass} value={employee} disabled={submitting} onChange={(event) => setEmployee(event.target.value)}>
                <option value="">未关联员工</option>
                {selectableEmployees.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <label className="grid gap-1.5 text-sm font-medium">
              设备码
              <input className={fieldClass} maxLength={60} value={device} disabled={submitting} onChange={(event) => setDevice(event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              录音时间
              <input className={fieldClass} type="datetime-local" value={occurredAt} disabled={submitting} onChange={(event) => setOccurredAt(event.target.value)} />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">
            热词（可选）
            <input
              className={fieldClass}
              maxLength={500}
              placeholder="例如：药品名、门店专名，用空格分隔"
              value={hotwords}
              disabled={submitting}
              onChange={(event) => setHotwords(event.target.value)}
            />
          </label>
          {error && <p className="m-0 text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => handleOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={submitting || !file} className="gap-1.5">
              <Upload className="w-4 h-4" />
              {submitting ? "正在提交" : "提交转写"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
