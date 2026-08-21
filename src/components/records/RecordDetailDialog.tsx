import { useMemo } from "react"
import { Copy, FileText, MessagesSquare, Users } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Pill, stateTone, type PillTone } from "@/components/dashboard/Pill"
import type { TranscriptRecord } from "@/lib/admin"
import type { RecordRow } from "./RecordTable"

interface RecordDetailDialogProps {
  record: RecordRow | null
  onClose: () => void
}

type TranscriptSegment = NonNullable<TranscriptRecord["segments_json"]>[number]

interface SpeakerTurn {
  speaker: string
  startMs: number | null
  endMs: number | null
  text: string
  segmentCount: number
}

const ASR_STATE: Record<string, { label: string; tone: PillTone }> = {
  queued: { label: "ASR 排队中", tone: "gray" },
  running: { label: "ASR 转写中", tone: "blue" },
  succeeded: { label: "ASR 已完成", tone: "green" },
  failed: { label: "ASR 失败", tone: "red" },
}

const SPEAKER_BADGE_CLASSES = [
  "border-primary/30 bg-primary/10 text-primary",
  "border-secondary bg-secondary text-secondary-foreground",
  "border-accent bg-accent text-accent-foreground",
  "border-muted bg-muted text-muted-foreground",
]

const MAX_TURN_CHARACTERS = 260
const MAX_TURN_SEGMENTS = 10
const MAX_SAME_TURN_GAP_MS = 5_000
const MAX_PLAIN_PARAGRAPH_CHARACTERS = 280

function millisecondsLabel(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--:--"
  const totalSeconds = Math.max(0, Math.floor(value / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function normalizedSpeaker(value: string) {
  const speaker = String(value || "unknown").trim()
  return speaker && speaker !== "spk_unknown" ? speaker : "unknown"
}

function segmentGap(previous: SpeakerTurn, next: TranscriptSegment) {
  if (previous.endMs === null || next.start_ms === null) return 0
  return Math.max(0, next.start_ms - previous.endMs)
}

function groupSpeakerTurns(segments: TranscriptSegment[]): SpeakerTurn[] {
  const turns: SpeakerTurn[] = []
  for (const segment of segments) {
    const text = String(segment.text || "").trim()
    if (!text) continue
    const speaker = normalizedSpeaker(segment.speaker)
    const previous = turns[turns.length - 1]
    const canMerge = Boolean(
      previous &&
      previous.speaker === speaker &&
      previous.segmentCount < MAX_TURN_SEGMENTS &&
      previous.text.length + text.length <= MAX_TURN_CHARACTERS &&
      segmentGap(previous, segment) <= MAX_SAME_TURN_GAP_MS,
    )
    if (canMerge) {
      previous.text += text
      previous.endMs = segment.end_ms
      previous.segmentCount += 1
      continue
    }
    turns.push({
      speaker,
      startMs: segment.start_ms,
      endMs: segment.end_ms,
      text,
      segmentCount: 1,
    })
  }
  return turns
}

function buildPlainParagraphs(segments: TranscriptSegment[], fallback: string) {
  const source = segments.length > 0
    ? segments.map((segment) => String(segment.text || "").trim()).filter(Boolean)
    : (fallback.match(/[^。！？!?；;\n]+[。！？!?；;]?/g) ?? [fallback]).map((text) => text.trim()).filter(Boolean)
  const paragraphs: string[] = []
  let current = ""
  for (const text of source) {
    if (current && current.length + text.length > MAX_PLAIN_PARAGRAPH_CHARACTERS) {
      paragraphs.push(current)
      current = ""
    }
    current += text
  }
  if (current) paragraphs.push(current)
  return paragraphs
}

export function RecordDetailDialog({ record, onClose }: RecordDetailDialogProps) {
  const segments = useMemo(() => record?.segments_json ?? [], [record?.segments_json])
  const turns = useMemo(() => groupSpeakerTurns(segments), [segments])
  const plainParagraphs = useMemo(
    () => buildPlainParagraphs(segments, record?.full_text || record?.summary || ""),
    [record?.full_text, record?.summary, segments],
  )
  const speakerStats = useMemo(() => {
    const counts = new Map<string, number>()
    for (const segment of segments) {
      const speaker = normalizedSpeaker(segment.speaker)
      counts.set(speaker, (counts.get(speaker) ?? 0) + 1)
    }
    return Array.from(counts, ([speaker, count], index) => ({ speaker, count, index }))
  }, [segments])
  const speakerIndex = useMemo(
    () => new Map(speakerStats.map((speaker) => [speaker.speaker, speaker.index])),
    [speakerStats],
  )
  const asrState = record?.asr_status ? ASR_STATE[record.asr_status] : null

  function speakerLabel(speaker: string) {
    if (speaker === "unknown") return "未识别说话人"
    return `说话人 ${(speakerIndex.get(speaker) ?? 0) + 1}`
  }

  async function copyTranscript() {
    const text = turns.length > 0
      ? turns.map((turn) => `[${millisecondsLabel(turn.startMs)}] ${speakerLabel(turn.speaker)}：${turn.text}`).join("\n\n")
      : record?.full_text || record?.summary || ""
    try {
      await navigator.clipboard.writeText(text)
      toast.success("转写文本已复制")
    } catch {
      toast.error("复制失败，请手动选择文本")
    }
  }

  return (
    <Dialog open={!!record} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[min(90vh,880px)] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        {record ? (
          <>
            <div className="shrink-0 border-b border-border px-6 py-5 pr-14">
              <DialogHeader className="gap-2">
                <DialogTitle className="flex flex-wrap items-center gap-2 text-xl">
                  <span>转写详情</span>
                  {asrState ? <Pill tone={asrState.tone}>{asrState.label}</Pill> : null}
                  <Pill tone={stateTone(record.qc_result)}>{record.qc_result || "未质检"}</Pill>
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>{record.employeeName || "未关联员工"}</span>
                  <span>·</span>
                  <span>{record.storeName || "未关联门店"}</span>
                  <span>·</span>
                  <span>设备 {record.device || "-"}</span>
                  <span>·</span>
                  <span>{record.occurred_at ? record.occurred_at.slice(0, 16) : "-"}</span>
                  {record.audio_name ? <><span>·</span><span className="max-w-full truncate">{record.audio_name}</span></> : null}
                </div>
              </DialogHeader>
            </div>

            <Tabs key={record.id} defaultValue={segments.length > 0 ? "dialogue" : "plain"} className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-3">
                <TabsList>
                  <TabsTrigger value="dialogue" disabled={segments.length === 0}>
                    <MessagesSquare data-icon="inline-start" />
                    对话分段
                  </TabsTrigger>
                  <TabsTrigger value="plain">
                    <FileText data-icon="inline-start" />
                    纯文本
                  </TabsTrigger>
                </TabsList>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {segments.length > 0 ? (
                    <>
                      <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" />{speakerStats.length} 位说话人</span>
                      <span>{segments.length} 个句段</span>
                    </>
                  ) : null}
                  <Button type="button" variant="outline" size="sm" onClick={() => void copyTranscript()}>
                    <Copy data-icon="inline-start" />
                    复制文本
                  </Button>
                </div>
              </div>

              <TabsContent value="dialogue" className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=active]:flex">
                <ScrollArea className="min-h-0 flex-1">
                  <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
                    <div className="flex flex-wrap gap-2">
                      {speakerStats.map((speaker) => (
                        <Badge
                          key={speaker.speaker}
                          variant="outline"
                          className={SPEAKER_BADGE_CLASSES[speaker.index % SPEAKER_BADGE_CLASSES.length]}
                        >
                          {speakerLabel(speaker.speaker)} · {speaker.count} 句
                        </Badge>
                      ))}
                    </div>
                    {turns.map((turn, index) => {
                      const toneIndex = speakerIndex.get(turn.speaker) ?? 0
                      return (
                        <article
                          key={`${turn.startMs}-${turn.endMs}-${index}`}
                          className="grid grid-cols-[132px_minmax(0,1fr)] gap-4 rounded-xl border border-border bg-card p-4 shadow-sm [content-visibility:auto] [contain-intrinsic-size:0_112px] max-sm:grid-cols-1 max-sm:gap-2"
                        >
                          <div className="flex flex-col items-start gap-2">
                            <Badge variant="outline" className={SPEAKER_BADGE_CLASSES[toneIndex % SPEAKER_BADGE_CLASSES.length]}>
                              {speakerLabel(turn.speaker)}
                            </Badge>
                            <span className="font-mono text-xs text-muted-foreground">
                              {millisecondsLabel(turn.startMs)} – {millisecondsLabel(turn.endMs)}
                            </span>
                          </div>
                          <p className="m-0 whitespace-pre-wrap break-words text-[15px] leading-7 text-foreground">{turn.text}</p>
                        </article>
                      )
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="plain" className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=active]:flex">
                <ScrollArea className="min-h-0 flex-1">
                  <div className="mx-auto flex max-w-3xl flex-col gap-5 p-6 text-[15px] leading-8">
                    {plainParagraphs.length > 0 ? plainParagraphs.map((paragraph, index) => (
                      <p key={index} className="m-0 whitespace-pre-wrap break-words">{paragraph}</p>
                    )) : <p className="m-0 text-muted-foreground">转写结果尚未生成</p>}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>

            <div className="flex shrink-0 justify-end border-t border-border px-6 py-3">
              <Button variant="outline" onClick={onClose}>关闭</Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
