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

export function fetchDashboardSummary(tab: DashboardTab): Promise<DashboardSummary> {
  return pb.send("/api/admin/dashboard/summary", {
    method: "GET",
    query: { tab },
  })
}

export function triggerSync(): Promise<{ ok: boolean; synced_at: string }> {
  return pb.send("/api/admin/sync", { method: "POST" })
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
  code: string
}

export interface Store {
  id: string
  name: string
  region: string
  address: string
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
  created?: string
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
): Promise<ListResponse<T>> {
  return pb.send(`/api/${collection}`, { method: "GET", query })
}

export function createRecord<T>(collection: string, body: Record<string, unknown>): Promise<T> {
  return pb.send(`/api/${collection}`, { method: "POST", body })
}

export function updateRecord<T>(
  collection: string,
  id: string,
  body: Record<string, unknown>,
): Promise<T> {
  return pb.send(`/api/${collection}/${id}`, { method: "PATCH", body })
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
