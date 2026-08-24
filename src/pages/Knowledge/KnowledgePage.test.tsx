import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { KnowledgeRoute } from "."

const fetchRules = vi.fn()
const createRule = vi.fn()
const updateRule = vi.fn()
const fetchRuleVersions = vi.fn()
const deleteRule = vi.fn()

vi.mock("@/lib/v1", () => ({
  fetchRules: (...args: unknown[]) => fetchRules(...args),
  createRule: (...args: unknown[]) => createRule(...args),
  updateRule: (...args: unknown[]) => updateRule(...args),
  fetchRuleVersions: (...args: unknown[]) => fetchRuleVersions(...args),
  deleteRule: (...args: unknown[]) => deleteRule(...args),
}))

const rule = {
  id: "r1",
  rule_set: "DEFAULT",
  code: "R-OVERPROMISE",
  name: "夸大疗效",
  description: "夸大疗效风险",
  category: "夸大疗效表达",
  severity: "high",
  keywords: ["重点介绍", "阿莫西林"],
  enabled: true,
  version_no: 1,
  sort_order: 0,
  created_at: "2026-08-24T00:00:00Z",
  updated_at: "2026-08-24T00:00:00Z",
}

describe("KnowledgePage (规则库)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchRules.mockResolvedValue({ items: [rule], page: 1, page_size: 20, total: 1, total_pages: 1 })
    createRule.mockResolvedValue({ ...rule, code: "R-NEW" })
    updateRule.mockResolvedValue({ ...rule, enabled: false, version_no: 2 })
    fetchRuleVersions.mockResolvedValue([
      { id: "v2", version_no: 2, snapshot: { severity: "medium" }, changed_by: null, change_note: "调整", created_at: "2026-08-24T01:00:00Z" },
      { id: "v1", version_no: 1, snapshot: { severity: "high" }, changed_by: null, change_note: "创建", created_at: "2026-08-24T00:00:00Z" },
    ])
    deleteRule.mockResolvedValue({ ok: true })
  })

  it("渲染规则列表与统计", async () => {
    render(<KnowledgeRoute />)
    await waitFor(() => expect(screen.getByText("夸大疗效")).toBeInTheDocument())
    expect(screen.getByText("R-OVERPROMISE")).toBeInTheDocument()
    expect(screen.getByText(/共 1 条规则/)).toBeInTheDocument()
  })

  it("新增规则调用 createRule", async () => {
    const user = userEvent.setup()
    render(<KnowledgeRoute />)
    await user.click(screen.getByRole("button", { name: /新增规则/ }))
    await user.type(screen.getByPlaceholderText("如 R-OVERPROMISE"), "R-NEW")
    await user.type(screen.getByPlaceholderText("如 夸大疗效"), "新规则")
    await user.type(screen.getByPlaceholderText("如 重点介绍 阿莫西林"), "头孢 布洛芬")
    await user.click(screen.getByRole("button", { name: "保存" }))
    await waitFor(() => expect(createRule).toHaveBeenCalled())
    const body = createRule.mock.calls[0][0]
    expect(body.code).toBe("R-NEW")
    expect(body.keywords).toEqual(["头孢", "布洛芬"])
  })

  it("切换启停调用 updateRule", async () => {
    const user = userEvent.setup()
    render(<KnowledgeRoute />)
    await user.click(await screen.findByLabelText("停用规则"))
    await waitFor(() => expect(updateRule).toHaveBeenCalledWith("r1", expect.objectContaining({ enabled: false })))
  })

  it("查看版本历史", async () => {
    const user = userEvent.setup()
    render(<KnowledgeRoute />)
    await user.click(await screen.findByRole("button", { name: /版本/ }))
    await waitFor(() => expect(screen.getByText("规则版本历史 · 夸大疗效")).toBeInTheDocument())
    expect(screen.getByText("v2")).toBeInTheDocument()
    expect(screen.getByText("调整")).toBeInTheDocument()
  })
})
