import { pb, getBasename } from "./pb"
import { vibexAuthHeaders } from "./rhLogin"

export type AsrJobStatus = "queued" | "running" | "succeeded" | "failed"

export interface AsrSegment {
  text: string
  start_ms: number | null
  end_ms: number | null
  speaker: string
}

export interface AsrJob {
  id: string
  remote_job_id: string
  transcript: string
  status: AsrJobStatus
  device: string
  employee: string
  store: string
  audio_name: string
  audio_size: number
  audio_sha256?: string
  metadata_json?: Record<string, unknown>
  submitted_at?: string
  started_at?: string
  finished_at?: string
  last_polled_at?: string
  result_imported_at?: string
  occurred_at?: string
  attempts: number
  error_code?: string
  error_message?: string
  created?: string
  updated?: string
}

export interface AsrSubmission {
  file: File
  device?: string
  employee?: string
  store?: string
  occurred_at?: string
  language?: string
  hotwords?: string
}

export interface AsrSubmitResponse {
  job: AsrJob
  transcript: { id: string }
}

function gatewayUrl(path: string): string {
  const basename = getBasename()
  const base = basename === "/" ? "/__asr" : `${basename}/__asr`
  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}

function browserHeaders(): Record<string, string> {
  const headers: Record<string, string> = { ...vibexAuthHeaders() }
  if (pb.authStore.token) headers.Authorization = pb.authStore.token
  return headers
}

async function parseGatewayError(response: Response, fallback: string): Promise<Error> {
  const payload = (await response.json().catch(() => ({}))) as { message?: string; error?: string }
  return new Error(payload.message || payload.error || fallback)
}

export async function submitAsrAudio(input: AsrSubmission): Promise<AsrSubmitResponse> {
  const metadata = {
    device: input.device || "",
    employee: input.employee || "",
    store: input.store || "",
    occurred_at: input.occurred_at || new Date().toISOString(),
    language: input.language || "zh-CN",
    hotwords: input.hotwords || "",
  }
  const headers = browserHeaders()
  headers["X-Yuqi-Audio-Name"] = encodeURIComponent(input.file.name)
  headers["X-Yuqi-Asr-Metadata"] = encodeURIComponent(JSON.stringify(metadata))
  const response = await fetch(gatewayUrl("/api/asr/jobs"), {
    method: "POST",
    credentials: "include",
    headers,
    body: input.file,
  })
  if (!response.ok) throw await parseGatewayError(response, `音频提交失败（HTTP ${response.status}）`)
  return (await response.json()) as AsrSubmitResponse
}

export async function retryAsrJob(jobId: string): Promise<AsrJob> {
  const response = await fetch(gatewayUrl(`/api/asr/jobs/${encodeURIComponent(jobId)}/retry`), {
    method: "POST",
    credentials: "include",
    headers: browserHeaders(),
  })
  if (!response.ok) throw await parseGatewayError(response, `转写重试失败（HTTP ${response.status}）`)
  const body = (await response.json()) as { job: AsrJob }
  return body.job
}
