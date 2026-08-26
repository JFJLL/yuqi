# Ticket 01：管理后台壳、导航与工作总览

## Outcome

管理员登录后看到与经理版一致的分组侧栏、顶部区域和工作总览，而不是当前扁平菜单与旧工作台。

## Blockers

无。

## Scope

- 按 Spec 建立 12 个目标模块的路由与分组导航，未完成模块提供统一、诚实的建设中/空状态。
- 复现经理版登录、侧栏、顶部栏、统计卡、门店表格、系统健康和待处理问题布局。
- 将当前待复核、待整改、待申诉等指标放进经理版工作总览，不删除现有能力。
- 覆盖 loading、empty、error、forbidden 和常见桌面宽度。

## Ownership

独占共享后台壳与主路由：`src/components/admin/AdminLayout.tsx`、`src/App.tsx`、后台登录客户端页面、工作总览页及其专属样式/测试。不要修改微信小程序、服务端认证模块、PocketBase schema 或业务集合。

## Acceptance

1. 导航名称、分组、选中态、折叠与目标信息架构一致。
2. 工作总览可显示真实 API 数据；不可用时显示明确状态，不伪造成功。
3. 角色或数据范围造成无权限时，页面与直接访问路由均正确处理。
4. 同视口截图与 `03-manager-dashboard.jpg` 对比，核心结构、密度和层级一致。

## Evidence

返回改动文件清单、路由映射、测试命令与结果、登录/首页/空状态截图，以及提供给后续 Ticket 的页面容器契约。

## Verification

先运行后台壳与首页定向测试，再运行 `rtk pnpm lint`、`rtk pnpm typecheck`、`rtk pnpm test`、`rtk pnpm build` 和浏览器 smoke；修改后执行 `$code-review`。
