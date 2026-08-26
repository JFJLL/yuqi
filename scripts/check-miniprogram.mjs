import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { parse } from "@babel/parser"

const MINI_ROOT = path.resolve("miniprogram")

console.log("Checking WeChat miniprogram files under:", MINI_ROOT)

if (!fs.existsSync(MINI_ROOT)) {
  console.error("miniprogram directory not found!")
  process.exit(1)
}

const appJsonPath = path.join(MINI_ROOT, "app.json")
if (!fs.existsSync(appJsonPath)) {
  console.error("app.json not found!")
  process.exit(1)
}

const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"))
console.log("Found", appJson.pages.length, "pages in app.json")

for (const p of appJson.pages) {
  const base = path.join(MINI_ROOT, p)
  const requiredExts = [".js", ".json", ".wxml", ".wxss"]
  for (const ext of requiredExts) {
    const file = base + ext
    if (!fs.existsSync(file)) {
      console.error("Missing page file:", file)
      process.exit(1)
    }
  }
}

// 检查全部 js 文件语法
function checkJs(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      checkJs(full)
    } else if (e.name.endsWith(".js")) {
      const code = fs.readFileSync(full, "utf8")
      try {
        parse(code, { sourceType: "module", plugins: ["asyncGenerators", "objectRestSpread"] })
      } catch (err) {
        console.error("JS syntax error in:", full, err.message)
        process.exit(1)
      }
    }
  }
}

checkJs(MINI_ROOT)

// 检查接口契约与后端路由对齐
console.log("Verifying miniprogram API contract endpoints...")
const EXPECTED_ENDPOINTS = [
  "/auth/wechat/login",
  "/auth/stores",
  "/auth/profile",
  "/auth/profile/rebind",
  "/employee/dashboard",
  "/employee/feedbacks",
  "/employee/feedbacks/",
  "/manager/store/devices",
  "/employee/device/bind",
  "/employee/device/unbind",
  "/employee/learning-tasks",
  "/recommendations",
]

const apiServiceCode = fs.readFileSync(path.join(MINI_ROOT, "services/api.js"), "utf8")
for (const ep of EXPECTED_ENDPOINTS) {
  if (!apiServiceCode.includes(ep)) {
    console.error("Missing API endpoint in api.js:", ep)
    process.exit(1)
  }
}

// 检查后端 hooks 是否覆盖所有小程序端点
const hooksDir = path.resolve("pocketbase/pb_hooks")
const allHooksCode = fs.readdirSync(hooksDir)
  .filter((f) => f.endsWith(".pb.js"))
  .map((f) => fs.readFileSync(path.join(hooksDir, f), "utf8"))
  .join("\n")

const REQUIRED_BACKEND_ROUTES = [
  "/api/yuqi/auth/wechat/login",
  "/api/yuqi/auth/stores",
  "/api/yuqi/auth/profile",
  "/api/yuqi/auth/profile/rebind",
  "/api/yuqi/employee/dashboard",
  "/api/yuqi/employee/feedbacks",
  "/api/yuqi/employee/feedbacks/{id}/learned",
  "/api/yuqi/employee/learning-tasks",
  "/api/yuqi/recommendations",
]

for (const route of REQUIRED_BACKEND_ROUTES) {
  if (!allHooksCode.includes(route)) {
    console.error("Backend pb_hooks missing required mini-program route:", route)
    process.exit(1)
  }
}

// 执行小程序核心服务逻辑单元测试
console.log("Testing miniprogram client service logic...")
globalThis.wx = {
  getStorageSync: (k) => null,
  setStorageSync: (k, v) => {},
  removeStorageSync: (k) => {},
  request: (options) => {
    setTimeout(() => {
      const url = options.url || ""
      if (url.includes("/employee/learning-tasks/") && url.endsWith("/exam/submit")) {
        options.success && options.success({ statusCode: 200, data: { ok: true, score: 100, passed: true } })
      } else if (url.includes("/employee/learning-tasks/") && url.endsWith("/exam")) {
        options.success && options.success({ statusCode: 200, data: { examId: "ex_1", questions: [{ id: "q_1", stem: "测试题干" }] } })
      } else if (url.includes("/employee/learning-tasks/")) {
        options.success && options.success({ statusCode: 200, data: { task: { id: "task_1" }, course: { title: "测试课程" }, units: [{ id: "u_1", title: "第一章" }] } })
      } else if (url.endsWith("/employee/learning-tasks")) {
        options.success && options.success({ statusCode: 200, data: { items: [{ id: "task_1", courseTitle: "测试课程", progressPercent: 0, status: "IN_PROGRESS" }] } })
      } else {
        options.success && options.success({ statusCode: 200, data: { ok: true } })
      }
    }, 10)
  },
}
const req = createRequire(import.meta.url)
const api = req(path.resolve(MINI_ROOT, "services/api.js"))
async function testServiceLogic() {
  const tasks = await api.getLearningTasks()
  if (!Array.isArray(tasks) || tasks.length === 0) {
    console.error("api.getLearningTasks failed to return array")
    process.exit(1)
  }
  const detail = await api.getLearningTaskDetail(tasks[0].id)
  if (!detail.task || !detail.units) {
    console.error("api.getLearningTaskDetail failed")
    process.exit(1)
  }
  const examPaper = await api.getExamPaper(tasks[0].id)
  if (!examPaper.questions || examPaper.questions[0].answer !== undefined) {
    console.error("api.getExamPaper leaked standard answer or failed")
    process.exit(1)
  }
  const submitResult = await api.submitExam(tasks[0].id, { [examPaper.questions[0].id]: "A" })
  if (!submitResult.passed) {
    console.error("api.submitExam failed")
    process.exit(1)
  }
  console.log("Mini-program service logic & offline test suite passed!")
}
await testServiceLogic()

console.log("WeChat miniprogram structure, syntax, and API contracts verified successfully!")
