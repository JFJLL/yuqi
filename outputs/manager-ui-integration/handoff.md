# Handoff：已验证事实与参考证据

## 1. 两个项目

- 当前项目：`D:\download\pic-vec\yuqi`
- 经理项目：`D:\download\eyang-inspection-20260825\eyang-inspection-20260825`
- 分析时当前分支：`main`，HEAD `6555d08`，工作区干净。
- 经理项目不是 Git 仓库，主要由 `backend/`、`backend-local-preview/`、`wechat-miniprogram/` 构成。

## 2. 技术结论

- 当前项目：React 19 + TypeScript + Vite + PocketBase + Node 网关/任务进程，已有较完整的人工复核、整改、申诉、通知、设备、租户和范围能力。
- 经理项目：静态 `backend/admin.html`、单文件 Python `backend/server.py`、自定义 SQLite 和原生小程序。
- 合并策略：当前项目保留为技术底座；经理版只作为产品、视觉、字段和交互参考，在当前架构中重建。
- 当前 `package.json` 已包含 `miniprogram-ci`，可以把原生小程序纳入工程化验证。

## 3. 关键代码入口

当前项目：

- 管理后台导航：`src/components/admin/AdminLayout.tsx`
- 路由入口：`src/App.tsx`
- 员工端 API：`src/employee/employeeApi.ts`
- 短信员工登录钩子：`pocketbase/pb_hooks/auth.pb.js`
- 员工首页/问题/设备/资料/申诉/整改：`pocketbase/pb_hooks/phase1.pb.js`

经理项目：

- 后台页面：`backend/admin.html`
- 接口与业务样例：`backend/server.py`
- 原生小程序：`wechat-miniprogram/miniprogram/`

这些路径是执行起点，不是限制；实现前应检查仓库最新状态和 `.codegraph/`。

## 4. 视觉证据

对比截图位于：

`C:\Users\liuhao_PC\.codex\visualizations\2026\08\26\01a03c26-9f70-7010-9577-6eda47121649\backend-compare\screenshots`

| 文件 | 内容 |
|---|---|
| `01-manager-login.png` | 经理版登录 |
| `03-manager-dashboard.jpg` | 经理版工作总览 |
| `04-current-login.jpg` | 当前登录 |
| `05-current-dashboard.png` | 当前工作台 |
| `06-manager-organization.png` | 经理版区域与门店 |
| `07-current-organization.png` | 当前组织管理 |
| `08-manager-activity.png` | 经理版员工业务记录 |
| `09-manager-learning.png` | 经理版学习记录 |
| `10-current-training.png` | 当前培训占位页 |
| `11-manager-permissions.png` | 经理版权限管理 |
| `12-current-settings.png` | 当前系统设置 |

视觉实现必须以这些截图和经理运行页面为准，在相同桌面视口截图对比。不要凭记忆重新设计。

## 5. 已验证的产品差异

- 经理版按“工作总览 / 组织与设备 / 巡检业务 / 管理配置”分组，当前项目是 15 个扁平菜单。
- 经理版组织管理包含区域、门店、店长、批量操作和员工/设备计数；当前页面主要是员工列表。
- 经理版工作总览更适合集团运营；当前工作台更强调整改、申诉和个人待办。目标是经理版布局，同时保留当前闭环指标。
- 经理版权限页具备角色卡、权限矩阵、管理员账号和集团/区域/门店范围；当前底层模型更强，但前端表达不足。
- 经理版培训只有学习记录样例，当前是占位页。目标不是照抄不足，而是在经理版视觉下补齐课程、任务、进度、考试和成绩。

## 6. 不可复制的经理实现

- 微信登录是占位实现：未真实校验登录 code/手机号 code，并可能自动创建员工。
- 部分员工接口缺少严格所有权边界。
- AI 结果可能直接进入待整改，绕过人工复核。
- 部分任务领取缺乏原子并发保护。
- 本地预览配置含非空 ingest key，不得复制、记录或提交。
- 经理项目无正式测试体系；只验证过 Python/小程序 JavaScript 基础语法。

## 7. 执行约束

- 开工前读取当前会话生效的 AGENTS 指令；若仓库根目录存在 `AGENTS.md`，也要完整读取。所有 shell 命令经 `rtk`。
- 若仓库根目录存在 `.codegraph/`，定位代码前先使用 CodeGraph。
- 不得覆盖其他会话的工作；每个 Ticket 只修改其声明的责任区，公共文件由指定 Ticket 所有者管理。
- 发现依赖契约变化时，先更新 Ticket 证据和接口说明，不在无关模块做顺手重构。
- 任何生产凭据、部署或真实外部写入不在本次授权范围内。
