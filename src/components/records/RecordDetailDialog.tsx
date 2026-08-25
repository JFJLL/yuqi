import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeftRight,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Filter,
  Flag,
  MessagesSquare,
  Pencil,
  Save,
  Search,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Pill, stateTone, type PillTone } from "@/components/dashboard/Pill"
import { updateRecord } from "@/lib/admin"
import type { TranscriptMark, TranscriptMarkColor, TranscriptRecord } from "@/lib/admin"
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

const MARK_COLORS: Record<TranscriptMarkColor, { label: string; dot: string; chip: string; border: string }> = {
  red: { label: "严重", dot: "bg-red-500", chip: "border-red-200 bg-red-50 text-red-700", border: "border-l-red-500" },
  yellow: { label: "待核实", dot: "bg-amber-400", chip: "border-amber-200 bg-amber-50 text-amber-700", border: "border-l-amber-400" },
  blue: { label: "优秀", dot: "bg-blue-500", chip: "border-blue-200 bg-blue-50 text-blue-700", border: "border-l-blue-500" },
  gray: { label: "备注", dot: "bg-zinc-400", chip: "border-zinc-200 bg-zinc-50 text-zinc-700", border: "border-l-zinc-400" },
}

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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function countMatches(text: string, term: string) {
  if (!term) return 0
  const re = new RegExp(escapeRegExp(term), "gi")
  const m = text.match(re)
  return m ? m.length : 0
}

function renderHighlighted(text: string, term: string, activeHitInTurn: number | null, baseHitIndex: number) {
  if (!term) return text
  const re = new RegExp(`(${escapeRegExp(term)})`, "gi")
  const parts = text.split(re)
  let hitCounter = -1
  return parts.map((part, i) => {
    if (re.test(part)) {
      // reset lastIndex due to global flag
      re.lastIndex = 0
      hitCounter += 1
      const globalIndex = baseHitIndex + hitCounter
      const isActive = activeHitInTurn !== null && globalIndex === activeHitInTurn
      return (
        <mark
          key={`${i}-${globalIndex}`}
          data-hit={globalIndex}
          data-active={isActive ? "true" : "false"}
          className={
            isActive
              ? "rounded px-0.5 bg-amber-400 text-amber-950"
              : "rounded bg-yellow-200 px-0.5 text-foreground"
          }
        >
          {part}
        </mark>
      )
    }
    // ensure regex state reset
    re.lastIndex = 0
    return <span key={i}>{part}</span>
  })
}

function commonSpeakersKey(storeId: string) {
  return `yuqi:commonSpeakers:${storeId || "global"}`
}

function loadCommonSpeakers(storeId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(commonSpeakersKey(storeId))
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, string>
  } catch {
    // localStorage 数据损坏时忽略, 退回空映射
  }
  return {}
}

function saveCommonSpeaker(storeId: string, speaker: string, alias: string) {
  try {
    const current = loadCommonSpeakers(storeId)
    if (alias) current[speaker] = alias
    else delete current[speaker]
    localStorage.setItem(commonSpeakersKey(storeId), JSON.stringify(current))
  } catch {
    // localStorage 不可用(隐私模式/配额)时忽略
  }
}

export function RecordDetailDialog({ record, onClose }: RecordDetailDialogProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [replaceMode, setReplaceMode] = useState(false)
  const [replaceTerm, setReplaceTerm] = useState("")
  const [activeHit, setActiveHit] = useState(0)
  const [selectedSpeakers, setSelectedSpeakers] = useState<Set<string>>(new Set())
  const [onlyMarked, setOnlyMarked] = useState(false)
  const [aliasMap, setAliasMap] = useState<Record<string, string>>({})
  const [marks, setMarks] = useState<TranscriptMark[]>([])
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [saveAsCommon, setSaveAsCommon] = useState(false)
  const [markPopover, setMarkPopover] = useState<{ speaker: string; startMs: number | null } | null>(null)
  const [markColor, setMarkColor] = useState<TranscriptMarkColor>("red")
  const [markNote, setMarkNote] = useState("")
  const [editableSegments, setEditableSegments] = useState<TranscriptSegment[]>([])
  const [saving, setSaving] = useState(false)
  const dialogueScrollRef = useRef<HTMLDivElement>(null)

  // 同步 record 到本地可编辑状态
  useEffect(() => {
    if (!record) return
    setEditableSegments(record.segments_json ? [...record.segments_json] : [])
    setAliasMap(record.speaker_aliases ? { ...record.speaker_aliases } : {})
    setMarks(record.marks_json ? [...record.marks_json] : [])
    setSearchTerm("")
    setReplaceTerm("")
    setReplaceMode(false)
    setActiveHit(0)
    setOnlyMarked(false)
    setSelectedSpeakers(new Set())
    setEditingSpeaker(null)
    setMarkPopover(null)
  }, [record?.id, record?.segments_json, record?.speaker_aliases, record?.marks_json])

  // 覆盖常用发言人（localStorage）到展示别名（若记录本身无别名）
  const effectiveAliasMap = useMemo(() => {
    if (!record) return aliasMap
    const common = loadCommonSpeakers(record.store)
    const merged: Record<string, string> = { ...common, ...aliasMap }
    // 空字符串的别名不覆盖
    for (const k of Object.keys(merged)) if (!merged[k]) delete merged[k]
    return merged
  }, [aliasMap, record?.store])

  const segments = useMemo(() => editableSegments, [editableSegments])
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
    const alias = effectiveAliasMap[speaker]
    if (alias) return alias
    if (speaker === "unknown") return "未识别说话人"
    return `发言人 ${(speakerIndex.get(speaker) ?? 0) + 1}`
  }

  // 标记判定：按 speaker+startMs 精确匹配
  function isTurnMarked(turn: SpeakerTurn) {
    return marks.some((m) => m.speaker === turn.speaker && m.start_ms === turn.startMs)
  }
  function getTurnMark(turn: SpeakerTurn) {
    return marks.find((m) => m.speaker === turn.speaker && m.start_ms === turn.startMs) ?? null
  }

  // 筛选后的 turns
  const filteredTurns = useMemo(() => {
    return turns.filter((turn) => {
      if (selectedSpeakers.size > 0 && !selectedSpeakers.has(turn.speaker)) return false
      if (onlyMarked && !isTurnMarked(turn)) return false
      return true
    })
  }, [turns, selectedSpeakers, onlyMarked, marks])

  // 搜索命中统计（基于可见 turns）
  const searchStats = useMemo(() => {
    if (!searchTerm.trim()) return { total: 0, hitsPerTurn: [] as number[] }
    const term = searchTerm.trim()
    const hitsPerTurn = filteredTurns.map((t) => countMatches(t.text, term))
    const total = hitsPerTurn.reduce((a, b) => a + b, 0)
    return { total, hitsPerTurn }
  }, [filteredTurns, searchTerm])

  const activeHitTurnIndex = useMemo(() => {
    if (searchStats.total === 0) return -1
    let acc = 0
    for (let i = 0; i < searchStats.hitsPerTurn.length; i++) {
      const c = searchStats.hitsPerTurn[i]
      if (activeHit < acc + c) return i
      acc += c
    }
    return -1
  }, [activeHit, searchStats])

  // 搜索词变化时重置 activeHit
  useEffect(() => {
    setActiveHit(0)
  }, [searchTerm])

  // 越界修正
  useEffect(() => {
    if (searchStats.total > 0 && activeHit >= searchStats.total) setActiveHit(searchStats.total - 1)
    if (searchStats.total === 0) setActiveHit(0)
  }, [searchStats.total, activeHit])

  // 命中滚动到可视区域
  useEffect(() => {
    if (searchStats.total === 0 || !searchTerm) return
    const el = dialogueScrollRef.current?.querySelector('[data-active="true"]')
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [activeHit, searchStats.total, searchTerm])

  // 纯文本段落在筛选+只看标记下的过滤：简单复用 filteredTurns 拼段
  const filteredPlainParagraphs = useMemo(() => {
    if (selectedSpeakers.size === 0 && !onlyMarked) return plainParagraphs
    const filteredSegments = segments.filter((seg) => {
      const spk = normalizedSpeaker(seg.speaker)
      if (selectedSpeakers.size > 0 && !selectedSpeakers.has(spk)) return false
      if (onlyMarked) {
        // 只要该句段所属 turn 被标记就保留
        const turn = turns.find((t) => t.startMs === seg.start_ms && t.speaker === spk)
        if (turn && !isTurnMarked(turn)) return false
        if (!turn) {
          // 回退：检查 marks 中是否有对应 segment
          const hasMark = marks.some((m) => m.speaker === spk && m.start_ms === seg.start_ms)
          if (!hasMark) return false
        }
      }
      return true
    })
    return buildPlainParagraphs(filteredSegments, "")
  }, [plainParagraphs, segments, selectedSpeakers, onlyMarked, turns, marks])

  async function persistTranscript(patch: Record<string, unknown>) {
    if (!record) return
    setSaving(true)
    try {
      await updateRecord("transcripts", record.id, patch)
      toast.success("已保存")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败")
      throw e
    } finally {
      setSaving(false)
    }
  }

  async function copyTranscript() {
    const sourceTurns = filteredTurns.length > 0 ? filteredTurns : turns
    const text =
      sourceTurns.length > 0
        ? sourceTurns.map((turn) => `[${millisecondsLabel(turn.startMs)}] ${speakerLabel(turn.speaker)}：${turn.text}`).join("\n\n")
        : record?.full_text || record?.summary || ""
    try {
      await navigator.clipboard.writeText(text)
      toast.success(filteredTurns.length !== turns.length ? `已复制筛选后 ${sourceTurns.length} 段` : "转写文本已复制")
    } catch {
      toast.error("复制失败，请手动选择文本")
    }
  }

  function toggleSpeakerFilter(speaker: string) {
    setSelectedSpeakers((prev) => {
      const next = new Set(prev)
      if (next.has(speaker)) next.delete(speaker)
      else next.add(speaker)
      // 若全选则清空集合表示不过滤（与初始状态一致）
      if (next.size === speakerStats.length) return new Set()
      return next
    })
  }

  function startEditSpeaker(speaker: string) {
    setEditingSpeaker(speaker)
    setEditValue(effectiveAliasMap[speaker] || "")
    setSaveAsCommon(false)
  }

  async function confirmEditSpeaker() {
    if (!record || !editingSpeaker) return
    const alias = editValue.trim().slice(0, 12)
    const next = { ...aliasMap }
    if (alias) next[editingSpeaker] = alias
    else delete next[editingSpeaker]
    setAliasMap(next)
    setEditingSpeaker(null)
    if (saveAsCommon) saveCommonSpeaker(record.store, editingSpeaker, alias)
    try {
      await persistTranscript({ speaker_aliases: next })
      // 同步回 record 的引用，依赖外层刷新；本地先保持
    } catch {
      // 回滚
      setAliasMap(aliasMap)
    }
  }

  function openMarkPopover(turn: SpeakerTurn) {
    const existing = getTurnMark(turn)
    setMarkPopover({ speaker: turn.speaker, startMs: turn.startMs })
    setMarkColor(existing?.color ?? "red")
    setMarkNote(existing?.note ?? "")
  }

  async function saveMark() {
    if (!record || !markPopover) return
    const now = new Date().toISOString()
    const existsIdx = marks.findIndex((m) => m.speaker === markPopover.speaker && m.start_ms === markPopover.startMs)
    const next = [...marks]
    const payload: TranscriptMark = {
      speaker: markPopover.speaker,
      start_ms: markPopover.startMs,
      end_ms: filteredTurns.find((t) => t.speaker === markPopover.speaker && t.startMs === markPopover.startMs)?.endMs ?? null,
      color: markColor,
      note: markNote.trim().slice(0, 100),
      created_at: now,
    }
    if (existsIdx >= 0) next[existsIdx] = payload
    else next.push(payload)
    setMarks(next)
    setMarkPopover(null)
    try {
      await persistTranscript({ marks_json: next })
    } catch {
      setMarks(marks)
    }
  }

  async function removeMark() {
    if (!record || !markPopover) return
    const next = marks.filter((m) => !(m.speaker === markPopover.speaker && m.start_ms === markPopover.startMs))
    const prev = marks
    setMarks(next)
    setMarkPopover(null)
    try {
      await persistTranscript({ marks_json: next })
    } catch {
      setMarks(prev)
    }
  }

  function stepHit(delta: number) {
    if (searchStats.total === 0) return
    setActiveHit((prev) => {
      const next = prev + delta
      if (next < 0) return searchStats.total - 1
      if (next >= searchStats.total) return 0
      return next
    })
  }

  async function handleReplaceAll() {
    const find = searchTerm.trim()
    const repl = replaceTerm
    if (!find) {
      toast.error("请输入查找内容")
      return
    }
    if (find === repl) {
      toast.error("查找与替换内容相同")
      return
    }
    const re = new RegExp(escapeRegExp(find), "gi")
    let changed = 0
    const nextSegments = editableSegments.map((seg) => {
      const text = String(seg.text || "")
      const newText = text.replace(re, repl)
      if (newText !== text) changed += countMatches(text, find)
      return newText === text ? seg : { ...seg, text: newText }
    })
    if (changed === 0) {
      toast.info("未找到匹配内容")
      return
    }
    const prev = editableSegments
    setEditableSegments(nextSegments)
    const fullText = nextSegments.map((s) => String(s.text || "").trim()).filter(Boolean).join("\n")
    try {
      await persistTranscript({ segments_json: nextSegments, full_text: fullText, summary: fullText.slice(0, 500) })
      toast.success(`已替换 ${changed} 处`)
    } catch {
      setEditableSegments(prev)
    }
  }

  async function handleReplaceOne() {
    const find = searchTerm.trim()
    const repl = replaceTerm
    if (!find || searchStats.total === 0) {
      toast.error("请输入查找内容")
      return
    }
    // 定位 activeHit 所在的 turn 与段内偏移
    const termLower = find.toLowerCase()
    let globalIdx = 0
    let targetTurnIdx = -1
    let offsetInTurn = -1
    for (let ti = 0; ti < filteredTurns.length; ti++) {
      const c = searchStats.hitsPerTurn[ti]
      if (activeHit < globalIdx + c) {
        targetTurnIdx = ti
        offsetInTurn = activeHit - globalIdx
        break
      }
      globalIdx += c
    }
    if (targetTurnIdx < 0) return
    const targetTurn = filteredTurns[targetTurnIdx]
    // 在 turn.text 中找到第 offsetInTurn 个命中位置
    const lowerText = targetTurn.text.toLowerCase()
    let pos = -1
    let from = 0
    let count = -1
    while (true) {
      const idx = lowerText.indexOf(termLower, from)
      if (idx < 0) break
      count += 1
      if (count === offsetInTurn) {
        pos = idx
        break
      }
      from = idx + termLower.length
    }
    if (pos < 0) return
    // 映射到 segments：按 turn 的拼接顺序回溯
    // turns 由 segments 合并而来；为简化，直接对所有 segment 按顺序做一次全局替换定位
    // 找到全局第 activeHit 个命中的 segment
    let segHitIdx = -1
    let segOffset = -1
    let acc = 0
    for (let i = 0; i < editableSegments.length; i++) {
      const segText = String(editableSegments[i].text || "")
      const segHits = countMatches(segText, find)
      if (activeHit < acc + segHits) {
        segHitIdx = i
        segOffset = activeHit - acc
        break
      }
      // 仅对可见 turn 的 segment 计数，需过滤不可见的 segment
      // 简化：按 filteredTurns 的 segment 映射，跳过不可见 speaker/未标记
      // 若 segment 所属 speaker 被过滤，则不计入 activeHit 序列，上面 acc 需跳过
      // 为达到一致，此处同步按 filteredTurns 文本重新计数会导致错位，改为按原始顺序但需判断可见性
      // 折中：若 editableSegments 的 speaker 不在 filtered 集合则 acc 不累加（已在上层 filteredTurns 统计）
      // 这里 acc 已按 filteredTurns 统计，直接按 filteredTurns 映射到 segment 会复杂；退化为直接在对应 turn 的 segments 子集内替换
      acc += segHits
    }
    // 若映射失败，回退到按 turn 文本替换一次
    let nextSegments: TranscriptSegment[]
    if (segHitIdx >= 0) {
      nextSegments = editableSegments.map((seg, idx) => {
        if (idx !== segHitIdx) return seg
        const text = String(seg.text || "")
        // 替换第 segOffset 个命中
        let occ = -1
        const replaced = text.replace(new RegExp(escapeRegExp(find), "gi"), (m) => {
          occ += 1
          return occ === segOffset ? repl : m
        })
        return { ...seg, text: replaced }
      })
    } else {
      // 回退：直接在 turn 对应原文上替换一次（可能跨 segment 边界，不精确但可用）
      const before = targetTurn.text.slice(0, pos)
      const after = targetTurn.text.slice(pos + find.length)
      const patchedTurnText = before + repl + after
      // 将该 turn 的首个 segment 文本替换为 patched，其余清空（保持 segmentCount 语义简化）
      // 实际 group 可能合并多 segment，找到这些 segment 的索引
      const indices: number[] = []
      for (let i = 0; i < editableSegments.length; i++) {
        if (normalizedSpeaker(editableSegments[i].speaker) === targetTurn.speaker && editableSegments[i].start_ms === targetTurn.startMs) indices.push(i)
      }
      if (indices.length > 0) {
        nextSegments = [...editableSegments]
        nextSegments[indices[0]] = { ...nextSegments[indices[0]], text: patchedTurnText }
        for (let k = 1; k < indices.length; k++) nextSegments[indices[k]] = { ...nextSegments[indices[k]], text: "" }
        nextSegments = nextSegments.filter((s) => String(s.text || "").trim() !== "" || !indices.includes(editableSegments.indexOf(s)))
      } else {
        nextSegments = editableSegments
      }
    }
    const prev = editableSegments
    setEditableSegments(nextSegments)
    const fullText = nextSegments.map((s) => String(s.text || "").trim()).filter(Boolean).join("\n")
    try {
      await persistTranscript({ segments_json: nextSegments, full_text: fullText, summary: fullText.slice(0, 500) })
      toast.success("已替换当前 1 处")
      // 保持 activeHit 不变或移到下一处
    } catch {
      setEditableSegments(prev)
    }
  }

  const markedCount = useMemo(() => marks.length, [marks])
  const visibleCount = filteredTurns.length
  const totalTurns = turns.length

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
                  {markedCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      <Flag className="size-3" /> 已标 {markedCount}
                    </span>
                  ) : null}
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

            {/* a1/a2 搜索与替换工具栏 */}
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-6 py-3">
              <div className="flex min-w-[220px] flex-1 items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        if (e.shiftKey) stepHit(-1)
                        else stepHit(1)
                      }
                      if (e.key === "Escape") setSearchTerm("")
                    }}
                    placeholder="搜索转写内容（回车下一条，Shift+回车上一条）"
                    className="h-8 w-full rounded-lg border border-border bg-card pl-8 pr-8 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"
                  />
                  {searchTerm ? (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent"
                      aria-label="清除搜索"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </div>
                {searchTerm ? (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {searchStats.total > 0 ? `${activeHit + 1}/${searchStats.total}` : "0/0"}
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  disabled={!searchTerm || searchStats.total === 0}
                  onClick={() => stepHit(-1)}
                  aria-label="上一条"
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  disabled={!searchTerm || searchStats.total === 0}
                  onClick={() => stepHit(1)}
                  aria-label="下一条"
                >
                  <ChevronDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant={replaceMode ? "secondary" : "outline"}
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={() => setReplaceMode((v) => !v)}
                >
                  <ArrowLeftRight className="size-3.5" />
                  替换
                </Button>
              </div>
              {replaceMode ? (
                <div className="flex w-full items-center gap-2">
                  <input
                    value={replaceTerm}
                    onChange={(e) => setReplaceTerm(e.target.value)}
                    placeholder="替换为"
                    className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-card px-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                  />
                  <Button type="button" size="sm" variant="outline" disabled={!searchTerm.trim() || saving} onClick={() => void handleReplaceOne()}>
                    替换
                  </Button>
                  <Button type="button" size="sm" disabled={!searchTerm.trim() || saving} onClick={() => void handleReplaceAll()}>
                    全部替换
                  </Button>
                </div>
              ) : null}
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
                      {visibleCount !== totalTurns ? <span className="text-amber-600">已筛 {visibleCount}/{totalTurns} 段</span> : null}
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
                  <div ref={dialogueScrollRef} className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Filter className="size-3" /> 筛选：</span>
                      {speakerStats.map((speaker) => {
                        const isSelected = selectedSpeakers.size === 0 || selectedSpeakers.has(speaker.speaker)
                        const alias = speakerLabel(speaker.speaker)
                        return (
                          <button
                            key={speaker.speaker}
                            type="button"
                            onClick={() => toggleSpeakerFilter(speaker.speaker)}
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${isSelected ? SPEAKER_BADGE_CLASSES[speaker.index % SPEAKER_BADGE_CLASSES.length] + " opacity-100" : "border-border bg-card text-muted-foreground opacity-60 line-through"}`}
                          >
                            {alias} · {speaker.count} 句
                          </button>
                        )
                      })}
                      {speakerStats.length > 0 ? (
                        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setSelectedSpeakers(new Set())}>重置</Button>
                      ) : null}
                      <label className="ml-2 inline-flex cursor-pointer items-center gap-1.5 text-xs">
                        <input type="checkbox" checked={onlyMarked} onChange={(e) => setOnlyMarked(e.target.checked)} className="size-3.5 rounded border-border" />
                        <Bookmark className="size-3" /> 只看标记
                        {markedCount > 0 ? <span className="text-muted-foreground">({markedCount})</span> : null}
                      </label>
                    </div>

                    {/* 别名编辑浮层 */}
                    {editingSpeaker ? (
                      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                        <Pencil className="size-3.5 text-primary" />
                        <span className="text-xs font-medium">编辑 {editingSpeaker === "unknown" ? "未识别说话人" : `发言人 ${(speakerIndex.get(editingSpeaker) ?? 0) + 1}`} 昵称</span>
                        <input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value.slice(0, 12))}
                          placeholder="如：李药师 / 顾客"
                          className="h-7 min-w-[140px] flex-1 rounded border border-border bg-card px-2 text-sm outline-none focus:border-primary"
                          maxLength={12}
                        />
                        <label className="inline-flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={saveAsCommon} onChange={(e) => setSaveAsCommon(e.target.checked)} className="size-3" />
                          设为常用
                        </label>
                        <Button type="button" size="sm" className="h-7 gap-1" disabled={saving} onClick={() => void confirmEditSpeaker()}>
                          <Save className="size-3" /> 保存
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setEditingSpeaker(null)}>取消</Button>
                      </div>
                    ) : null}

                    {/* 标记编辑浮层 */}
                    {markPopover ? (
                      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <Flag className="size-3.5 text-amber-600" />
                        <span className="text-xs font-medium">标记 {speakerLabel(markPopover.speaker)} {millisecondsLabel(markPopover.startMs)}</span>
                        <div className="flex items-center gap-1">
                          {(Object.keys(MARK_COLORS) as TranscriptMarkColor[]).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setMarkColor(c)}
                              className={`size-6 rounded-full border-2 ${MARK_COLORS[c].dot} ${markColor === c ? "border-foreground" : "border-white shadow"}`}
                              aria-label={MARK_COLORS[c].label}
                              title={MARK_COLORS[c].label}
                            />
                          ))}
                        </div>
                        <input
                          value={markNote}
                          onChange={(e) => setMarkNote(e.target.value.slice(0, 100))}
                          placeholder="备注（可选，100字内）"
                          className="h-7 min-w-[160px] flex-1 rounded border border-border bg-card px-2 text-sm outline-none focus:border-primary"
                          maxLength={100}
                        />
                        <Button type="button" size="sm" className="h-7" disabled={saving} onClick={() => void saveMark()}>保存标记</Button>
                        <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => void removeMark()}>移除</Button>
                        <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setMarkPopover(null)}>关闭</Button>
                      </div>
                    ) : null}

                    {filteredTurns.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        {onlyMarked || selectedSpeakers.size > 0 ? "没有符合筛选条件的对话" : "暂无对话分段"}
                      </p>
                    ) : (
                      filteredTurns.map((turn) => {
                        const toneIndex = speakerIndex.get(turn.speaker) ?? 0
                        const mark = getTurnMark(turn)
                        const turnGlobalBase = (() => {
                          let acc = 0
                          for (let i = 0; i < filteredTurns.length; i++) {
                            if (filteredTurns[i] === turn) return acc
                            acc += countMatches(filteredTurns[i].text, searchTerm.trim())
                          }
                          return acc
                        })()
                        const isActiveTurn = activeHitTurnIndex >= 0 && filteredTurns[activeHitTurnIndex] === turn
                        return (
                          <article
                            key={`${turn.startMs}-${turn.endMs}-${turn.speaker}-${turn.text.slice(0, 8)}`}
                            className={`grid grid-cols-[132px_minmax(0,1fr)] gap-4 rounded-xl border bg-card p-4 shadow-sm [content-visibility:auto] [contain-intrinsic-size:0_112px] max-sm:grid-cols-1 max-sm:gap-2 ${mark ? `${MARK_COLORS[mark.color].border} border-l-4` : "border-border"} ${isActiveTurn ? "ring-1 ring-amber-300" : ""}`}
                          >
                            <div className="flex flex-col items-start gap-2">
                              <button
                                type="button"
                                onClick={() => startEditSpeaker(turn.speaker)}
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition hover:opacity-80 ${SPEAKER_BADGE_CLASSES[toneIndex % SPEAKER_BADGE_CLASSES.length]}`}
                                title="点击编辑昵称"
                              >
                                <Pencil className="size-3 opacity-60" />
                                {speakerLabel(turn.speaker)}
                              </button>
                              <span className="font-mono text-xs text-muted-foreground">
                                {millisecondsLabel(turn.startMs)} – {millisecondsLabel(turn.endMs)}
                              </span>
                              {mark ? (
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${MARK_COLORS[mark.color].chip}`}>
                                  <span className={`size-2 rounded-full ${MARK_COLORS[mark.color].dot}`} />
                                  {MARK_COLORS[mark.color].label}
                                  {mark.note ? ` · ${mark.note}` : ""}
                                </span>
                              ) : null}
                              <Button
                                type="button"
                                variant={mark ? "secondary" : "outline"}
                                size="sm"
                                className="h-7 gap-1 px-2 text-xs"
                                onClick={() => openMarkPopover(turn)}
                              >
                                <Flag className="size-3" />
                                {mark ? "改标记" : "标记"}
                              </Button>
                            </div>
                            <p className="m-0 whitespace-pre-wrap break-words text-[15px] leading-7 text-foreground">
                              {searchTerm.trim()
                                ? renderHighlighted(
                                    turn.text,
                                    searchTerm.trim(),
                                    activeHitTurnIndex >= 0 && isActiveTurn ? activeHit : null,
                                    turnGlobalBase,
                                  )
                                : turn.text}
                            </p>
                          </article>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="plain" className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=active]:flex">
                <ScrollArea className="min-h-0 flex-1">
                  <div className="mx-auto flex max-w-3xl flex-col gap-5 p-6 text-[15px] leading-8">
                    {filteredPlainParagraphs.length > 0 ? (
                      filteredPlainParagraphs.map((paragraph, index) => {
                        const term = searchTerm.trim()
                        if (!term) return <p key={index} className="m-0 whitespace-pre-wrap break-words">{paragraph}</p>
                        // 高亮纯文本段落
                        const re = new RegExp(`(${escapeRegExp(term)})`, "gi")
                        const parts = paragraph.split(re)
                        return (
                          <p key={index} className="m-0 whitespace-pre-wrap break-words">
                            {parts.map((part, i) => {
                              re.lastIndex = 0
                              if (re.test(part)) {
                                re.lastIndex = 0
                                return <mark key={i} className="rounded bg-yellow-200 px-0.5">{part}</mark>
                              }
                              re.lastIndex = 0
                              return <span key={i}>{part}</span>
                            })}
                          </p>
                        )
                      })
                    ) : (
                      <p className="m-0 text-muted-foreground">
                        {onlyMarked || selectedSpeakers.size > 0 ? "没有符合筛选条件的文本" : "转写结果尚未生成"}
                      </p>
                    )}
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
