import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { LoginPage } from "./LoginPage"
import { useAuth } from "@/lib/auth"

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>()
  return {
    ...actual,
    useAuth: vi.fn(),
  }
})

const { toastMock } = vi.hoisted(() => ({
  toastMock: { error: vi.fn(), success: vi.fn() },
}))
vi.mock("sonner", () => ({ toast: toastMock }))

const mockUseAuth = vi.mocked(useAuth)

beforeEach(() => {
  toastMock.error.mockClear()
  toastMock.success.mockClear()
})

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )
}

describe("LoginPage", () => {
  it("renders username and password fields", () => {
    mockUseAuth.mockReturnValue({
      me: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    })
    renderLogin()
    expect(screen.getByLabelText("账号 / 手机号")).toBeInTheDocument()
    expect(screen.getByLabelText("密码")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /登\s*录/ })).toBeInTheDocument()
  })

  it("shows error when fields are empty", async () => {
    mockUseAuth.mockReturnValue({
      me: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    })
    renderLogin()
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /登\s*录/ }))
    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith("请输入账号和密码")
    })
  })

  it("calls login with credentials and navigates", async () => {
    const login = vi.fn(async () => undefined)
    mockUseAuth.mockReturnValue({
      me: null,
      loading: false,
      login,
      logout: vi.fn(),
      refresh: vi.fn(),
    })
    renderLogin()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText("账号 / 手机号"), "admin")
    await user.type(screen.getByLabelText("密码"), "Secret-123!")
    await user.click(screen.getByRole("button", { name: /登\s*录/ }))
    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("admin", "Secret-123!")
    })
  })

  it("shows error message on failed login", async () => {
    const login = vi.fn(async () => {
      throw new Error("账号或密码错误")
    })
    mockUseAuth.mockReturnValue({
      me: null,
      loading: false,
      login,
      logout: vi.fn(),
      refresh: vi.fn(),
    })
    renderLogin()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText("账号 / 手机号"), "admin")
    await user.type(screen.getByLabelText("密码"), "wrong")
    await user.click(screen.getByRole("button", { name: /登\s*录/ }))
    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith("账号或密码错误")
    })
  })
})
