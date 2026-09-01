import { pb } from "./pb"

// 药店连锁 AI 运营管理后台 — 后端接口封装
// 自定义路由挂在 PocketBase 的 /api/admin、/api/<collection> 下, 统一走 pb.send

export interface DashboardStats {
  transcripts_today: number
  stores_covered: number
  stores_total: number
  issues_today: number
  high_risk: number
  rectify_rate: number
  open_tasks: number
  overdue_tasks: number
  pending_appeals: number
  overdue_appeals: number
}

export interface KeyIssue {
  id: string
  employee_name: string
  store_name: string
  issue_type: string
  risk: string
  state: string
  quote: string
  advice: string
  occurred_at: string
}

export interface StoreRankItem {
  store_id: string
  store_name: string
  issue_count: number
  share: number
}

export interface DashboardSummary {
  generated_at: string
  stats: DashboardStats
  key_issues: KeyIssue[]
  store_rank: StoreRankItem[]
}

export type DashboardTab = "all" | "high" | "appealing"

// ---- 前端内存缓存 (SWR 模式: 秒切标签页零等待) ----
interface CacheEntry<T> {
  data: T
  timestamp: number
}

const memoryCache = new Map<string, CacheEntry<unknown>>()
const CACHE_TTL_MS = 60000 // 60 秒内存热缓存

export function invalidateCache(collection?: string) {
  if (collection) {
    for (const key of memoryCache.keys()) {
      if (key.startsWith(`list:${collection}:`)) {
        memoryCache.delete(key)
      }
    }
  } else {
    memoryCache.clear()
  }
}

export function fetchDashboardSummary(tab: DashboardTab): Promise<DashboardSummary> {
  const cacheKey = `dashboard:${tab}`
  const cached = memoryCache.get(cacheKey) as CacheEntry<DashboardSummary> | undefined
  if (cached && Date.now() - cached.timestamp < 30000) {
    return Promise.resolve(cached.data)
  }
  return pb.send<DashboardSummary>("/api/admin/dashboard/summary", {
    method: "GET",
    query: { tab },
  }).then((data) => {
    memoryCache.set(cacheKey, { data, timestamp: Date.now() })
    return data
  })
}

export function triggerSync(): Promise<{ ok: boolean; synced_at: string }> {
  invalidateCache()
  return pb.send("/api/admin/sync", { method: "POST" })
}

// ---- 巡检与人工复核闭环安全接口 ----
export function reviewIssue(id: string, action: "APPROVE" | "REJECT" | "DISMISS", notes?: string): Promise<{ ok: boolean }> {
  return pb.send(`/api/yuqi/issues/${id}/review`, {
    method: "POST",
    body: { action, notes },
  })
}

export function pushIssueRectification(id: string, deadline_days = 3, notes?: string): Promise<{ ok: boolean }> {
  return pb.send(`/api/yuqi/issues/${id}/push`, {
    method: "POST",
    body: { deadline_days, notes },
  })
}

export function closeIssue(id: string, reason?: string): Promise<{ ok: boolean }> {
  return pb.send(`/api/yuqi/issues/${id}/close`, {
    method: "POST",
    body: { reason },
  })
}

// ---- 通用业务表 CRUD ----

export interface ListResponse<T> {
  items: T[]
  page: number
  perPage: number
  totalItems: number
}

export interface Region {
  id: string
  name: string
  code?: string
  manager_name?: string
  manager_mobile?: string
  status?: string
  storeCount?: number
  employeeCount?: number
}

export interface Store {
  id: string
  code?: string
  name: string
  region: string
  address?: string
  status?: string
  manager_name?: string
  manager_mobile?: string
  manager_employee?: string
  employeeCount?: number
  deviceCount?: number
}

export interface Employee {
  id: string
  name: string
  phone: string
  role: string
  store: string
  status: string
}

export interface InspectionIssueRecord {
  id: string
  transcript: string
  employee: string
  store: string
  issue_type: string
  risk: string
  state: string
  quote: string
  advice: string
  occurred_at: string
  created?: string
  updated?: string
}

export interface Device {
  id: string
  device_no: string
  type: string
  status: string
  power: number
  texts_today: number
  last_online_at: string
}

export interface DeviceBinding {
  id: string
  device: string
  employee: string
  store: string
  effective_date: string
  status: string
  approved_at?: string
  created?: string
  updated?: string
}

export interface DeviceLog {
  id: string
  device: string
  type: string
  content: string
  status: string
  occurred_at: string
  created?: string
}

export type TranscriptMarkColor = "red" | "yellow" | "blue" | "gray"

export interface TranscriptMark {
  speaker: string
  start_ms: number | null
  end_ms: number | null
  color: TranscriptMarkColor
  note: string
  created_at: string
}

export interface TranscriptRecord {
  id: string
  device: string
  employee: string
  store: string
  summary: string
  full_text: string
  segments_json?: Array<{
    text: string
    start_ms: number | null
    end_ms: number | null
    speaker: string
  }>
  asr_job?: string
  asr_status?: "queued" | "running" | "succeeded" | "failed" | ""
  model?: string
  audio_name?: string
  source?: string
  qc_result: string
  occurred_at: string
  speaker_aliases?: Record<string, string>
  marks_json?: TranscriptMark[]
  created?: string
  updated?: string
}

export interface RectifyTaskRecord {
  id: string
  title: string
  owner: string
  store: string
  source_issue: string
  due_date: string
  progress: number
  state: string
  created?: string
}

export interface AppealRecord {
  id: string
  issue: string
  reason: string
  status: string
  reviewer: string
  reviewed_at: string
  created?: string
}

export interface KnowledgeItem {
  id: string
  category: string
  name: string
  rule: string
  status: string
  updated?: string
}

export interface ComplianceRule {
  id: string
  name: string
  risk: string
  description: string
  enabled: boolean
}

export interface ModelEval {
  id: string
  scenario: string
  accuracy: string
  note: string
  progress: number
  status: string
}

export interface SyncLog {
  id: string
  type: string
  object: string
  store: string
  status: string
  result: string
  occurred_at: string
}

export interface AppSetting {
  id: string
  key: string
  value: string
}

// 导出 CSV (带 BOM, Excel 直接打开不乱码)
export function exportCsv(filename: string, head: string[], rows: (string | number)[][]) {
  const escape = (cell: string | number) => `"${String(cell ?? "").replace(/"/g, '""')}"`
  const csv = ["﻿" + head.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function fetchList<T>(
  collection: string,
  query?: Record<string, string | number>,
  options?: { bypassCache?: boolean }
): Promise<ListResponse<T>> {
  const cacheKey = `list:${collection}:${JSON.stringify(query || {})}`
  const cached = memoryCache.get(cacheKey) as CacheEntry<ListResponse<T>> | undefined
  if (!options?.bypassCache && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return Promise.resolve(cached.data)
  }
  return pb.send<ListResponse<T>>(`/api/${collection}`, { method: "GET", query }).then((res) => {
    memoryCache.set(cacheKey, { data: res, timestamp: Date.now() })
    return res
  })
}

export function createRecord<T>(collection: string, body: Record<string, unknown>): Promise<T> {
  invalidateCache(collection)
  return pb.send(`/api/${collection}`, { method: "POST", body })
}

export function updateRecord<T>(
  collection: string,
  id: string,
  body: Record<string, unknown>,
): Promise<T> {
  invalidateCache(collection)
  // 禁用自动取消：连续 PATCH 同一条记录（如标记/别名/替换）不应互相取消
  // https://github.com/pocketbase/js-sdk#auto-cancellation
  return pb.send(`/api/${collection}/${id}`, { method: "PATCH", body, requestKey: null } as never)
}

export function deleteRecord(
  collection: string,
  id: string,
): Promise<{ ok: boolean }> {
  return pb.send(`/api/${collection}/${id}`, { method: "DELETE" })
}

// 本月每个员工的问题数 (前端按 occurred_at 归属当月聚合)
export async function fetchEmployeeIssueCounts(): Promise<Record<string, number>> {
  const data = await fetchList<InspectionIssueRecord>("inspection_issues", { perPage: 500 })
  const now = new Date()
  const counts: Record<string, number> = {}
  for (const item of data.items) {
    if (!item.employee || !item.occurred_at) continue
    const at = new Date(item.occurred_at.includes("T") ? item.occurred_at : item.occurred_at.replace(" ", "T"))
    if (Number.isNaN(at.getTime())) continue
    if (at.getFullYear() !== now.getFullYear() || at.getMonth() !== now.getMonth()) continue
    counts[item.employee] = (counts[item.employee] ?? 0) + 1
  }
  return counts
}
