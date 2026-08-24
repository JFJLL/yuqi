import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"

// 全局 fetch mock: 测试中按需覆写
if (!globalThis.fetch) {
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }))
}
