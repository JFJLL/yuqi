import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

test("Ticket 01: 管理后台导航与信息架构契约", async () => {
  const layoutContent = fs.readFileSync("src/components/admin/AdminLayout.tsx", "utf8")
  
  // 12 个目标模块必须存在
  const expectedModules = [
    "工作总览",
    "区域与门店",
    "员工与店长",
    "设备管理",
    "录音与转写",
    "AI巡检结果",
    "申诉复核",
    "员工业务记录",
    "基础报表",
    "账号与权限",
    "系统参数",
    "操作审计"
  ]

  for (const mod of expectedModules) {
    assert.ok(layoutContent.includes(mod), "AdminLayout 缺少目标模块: " + mod)
  }

  // 4 个分组
  const expectedGroups = ["组织与设备", "巡检业务", "管理配置"]
  for (const grp of expectedGroups) {
    assert.ok(layoutContent.includes(grp), "AdminLayout 缺少目标分组: " + grp)
  }
})

test("Ticket 01: 路由表包含 12 个目标模块路由", async () => {
  const appContent = fs.readFileSync("src/App.tsx", "utf8")
  const expectedPaths = [
    'path="/"',
    'path="/organization"',
    'path="/employees"',
    'path="/devices"',
    'path="/recordings"',
    'path="/inspection"',
    'path="/appeals"',
    'path="/activity"',
    'path="/reports"',
    'path="/permissions"',
    'path="/settings"',
    'path="/audit"'
  ]

  for (const p of expectedPaths) {
    assert.ok(appContent.includes(p), "App.tsx 缺少路由: " + p)
  }
})

test("Ticket 01: 登录页与工作总览布局符合经理版契约", async () => {
  const loginContent = fs.readFileSync("src/pages/LoginPage.tsx", "utf8")
  assert.ok(loginContent.includes("集团巡检管理"), "LoginPage 缺少品牌标题")
  assert.ok(loginContent.includes("请登录总部工作台"), "LoginPage 缺少副标题")
  assert.ok(loginContent.includes("登录系统"), "LoginPage 缺少登录按钮文本")

  const dashContent = fs.readFileSync("src/pages/Dashboard/DashboardPage.tsx", "utf8")
  assert.ok(dashContent.includes("营业门店"), "DashboardPage 缺少营业门店卡片")
  assert.ok(dashContent.includes("在职员工"), "DashboardPage 缺少在职员工卡片")
  assert.ok(dashContent.includes("在线设备"), "DashboardPage 缺少在线设备卡片")
  assert.ok(dashContent.includes("待处理问题"), "DashboardPage 缺少待处理问题卡片")
  assert.ok(dashContent.includes("门店巡检概况"), "DashboardPage 缺少门店巡检概况表格")
  assert.ok(dashContent.includes("系统运行状态"), "DashboardPage 缺少系统运行状态侧栏")
})
