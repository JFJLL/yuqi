import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RecordsRoute } from "."

const fetchRecordings = vi.fn()
const fetchRecordingSummary = vi.fn()
const fetchEmployees = vi.fn()
const fetchStores = vi.fn()
const fetchRecordingDetail = vi.fn()
const uploadRecording = vi.fn()
const retryRecording = vi.fn()
const deleteRecording = vi.fn()
const updateTranscript = vi.fn()

vi.mock("@/lib/v1", () => ({
  fetchRecordings: (...args: unknown[]) => fetchRecordings(...args),
  fetchRecordingSummary: (...args: unknown[]) => fetchRecordingSummary(...args),
  fetchEmployees: (...args: unknown[]) => fetchEmployees(...args),
  fetchStores: (...args: unknown[]) => fetchStores(...args),
  fetchRecordingDetail: (...args: unknown[]) => fetchRecordingDetail(...args),
  uploadRecording: (...args: unknown[]) => uploadRecording(...args),
  retryRecording: (...args: unknown[]) => retryRecording(...args),
  deleteRecording: (...args: unknown[]) => deleteRecording(...args),
  updateTranscript: (...args: unknown[]) => updateTranscript(...args),
}))

const item = {
  id: "a1",
  occurred_at: "2026-08-01T10:30:00+08:00",
  employee: "e1",
  store: "s1",
  employee_name: "店员甲",
  store_name: "A 店",
  device: "WF-TEST-001",
  source: "manual",
  audio_name: "rec.wav",
  summary: "重点介绍了 阿莫西林胶囊 的用法。",
  qc_result: "",
  asr_status: "succeeded",
  asr_job: "j1",
  file_size: 1024,
}

const detail = {
  ...item,
  audio_file_id: "a1",
  full_text: "您好，请问有什么可以帮您？\n重点介绍了 阿莫西林胶囊。",
  segments_json: [
    { text: "您好，请问有什么可以帮您？", start_ms: 0, end_ms: 2400, speaker: "customer" },
    { text: "重点介绍了 阿莫西林胶囊。", start_ms: 2400, end_ms: 9000, speaker: "staff" },
  ],
  speaker_aliases: {},
  marks_json: [],
  current_version: 1,
  model: null,
}

const summary = {
  total: 1, done_count: 1, pending_count: 0, failed_count: 0,
  retryable_count: 0, merge_count: 0, resend_count: 0,
}

describe("RecordsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchRecordings.mockResolvedValue({ items: [item], page: 1, page_size: 20, total: 1, total_pages: 1 })
    fetchRecordingSummary.mockResolvedValue(summary)
    fetchEmployees.mockResolvedValue({ items: [{ id: "e1", name: "店员甲" }], page: 1, page_size: 200, total: 1, total_pages: 1 })
    fetchStores.mockResolvedValue({ items: [{ id: "s1", name: "A 店" }], page: 1, page_size: 200, total: 1, total_pages: 1 })
    fetchRecordingDetail.mockResolvedValue(detail)
    uploadRecording.mockResolvedValue({ id: "a1", asr_job: "j1", status: "queued" })
    retryRecording.mockResolvedValue({ id: "a1", asr_job: "j1", status: "succeeded" })
    deleteRecording.mockResolvedValue({ ok: true })
    updateTranscript.mockResolvedValue({ ok: true, version: 2 })
  })

  it("渲染转写列表与服务端汇总", async () => {
    render(<RecordsRoute />)
    await waitFor(() => expect(screen.getByText("重点介绍了 阿莫西林胶囊 的用法。")).toBeInTheDocument())
    expect(screen.getAllByText("店员甲").length).toBeGreaterThan(0)
    expect(screen.getAllByText("A 店").length).toBeGreaterThan(0)
    expect(fetchRecordings).toHaveBeenCalled()
    expect(fetchRecordingSummary).toHaveBeenCalled()
  })

  it("打开详情对话框并展示对话分段", async () => {
    const user = userEvent.setup()
    render(<RecordsRoute />)
    await user.click(await screen.findByRole("button", { name: "查看文本" }))
    await waitFor(() => expect(screen.getByText("转写详情")).toBeInTheDocument())
    expect(screen.getByText("您好，请问有什么可以帮您？")).toBeInTheDocument()
    expect(screen.getByText("重点介绍了 阿莫西林胶囊。")).toBeInTheDocument()
  })

  it("上传录音: 提交 multipart 表单", async () => {
    const user = userEvent.setup()
    render(<RecordsRoute />)
    await user.click(screen.getByRole("button", { name: /上传录音/ }))
    const file = new File(["data"], "rec.mp3", { type: "audio/mpeg" })
    await user.upload(screen.getByLabelText(/音频文件/), file)
    await user.click(screen.getByRole("button", { name: /提交转写/ }))
    await waitFor(() => expect(uploadRecording).toHaveBeenCalled())
    const form = uploadRecording.mock.calls[0][0] as FormData
    expect(form.get("file")).toBeInstanceOf(File)
    expect(String(form.get("language"))).toBe("zh-CN")
  })

  it("删除记录调用软删除 API", async () => {
    const user = userEvent.setup()
    render(<RecordsRoute />)
    await user.click(await screen.findByRole("button", { name: "删除" }))
    await user.click(screen.getByRole("button", { name: "确认删除" }))
    await waitFor(() => expect(deleteRecording).toHaveBeenCalledWith("a1"))
  })
})
