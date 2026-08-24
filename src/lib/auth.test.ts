import { describe, expect, it } from "vitest"
import { hasPermission, type AuthState } from "./auth"
import type { MePayload } from "./api"

function makeMe(overrides: Partial<MePayload> = {}): MePayload {
  return {
    user: {
      id: "u1",
      tenant_id: "t1",
      username: "admin",
      mobile: null,
      display_name: "管理员",
      status: "ACTIVE",
      is_super_admin: false,
      created_at: "2026-01-01T00:00:00Z",
      roles: [],
    },
    tenant: { id: "t1", code: "demo", name: "演示", status: "ACTIVE", is_demo: true },
    roles: [],
    permissions: ["issue:review"],
    data_scope_types: ["ALL"],
    is_super_admin: false,
    ...overrides,
  }
}

describe("hasPermission", () => {
  it("super admin bypasses permission list", () => {
    const me = makeMe({ is_super_admin: true, permissions: [] })
    expect(hasPermission(me, "anything:manage")).toBe(true)
  })

  it("regular user needs explicit permission", () => {
    const me = makeMe()
    expect(hasPermission(me, "issue:review")).toBe(true)
    expect(hasPermission(me, "users:manage")).toBe(false)
  })

  it("null session has no permission", () => {
    expect(hasPermission(null, "issue:review")).toBe(false)
  })
})

describe("AuthState contract", () => {
  it("exposes login/logout/refresh", () => {
    // 类型契约检查: 编译期保证字段存在
    const state: AuthState = {
      me: null,
      loading: true,
      login: async () => undefined,
      logout: async () => undefined,
      refresh: async () => undefined,
    }
    expect(state.me).toBeNull()
    expect(state.loading).toBe(true)
    expect(typeof state.login).toBe("function")
    expect(typeof state.logout).toBe("function")
    expect(typeof state.refresh).toBe("function")
  })
})
