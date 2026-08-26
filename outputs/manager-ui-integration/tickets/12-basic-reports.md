# Ticket 12：基础报表

## Outcome

管理员能在经理版“基础报表”中按区域、门店、员工和时间查看、解释并导出经营与巡检指标。

## Blockers

Ticket 01、Ticket 03、Ticket 06、Ticket 07、Ticket 09、Ticket 10。

## Scope

- 区域/门店/员工/时间筛选、统计卡、趋势和明细。
- 明确有效问题、误报、整改、申诉、培训完成等指标口径。
- 屏幕数据与导出使用同一查询和权限范围。
- loading、empty、error、forbidden 与大数据量分页。

## Ownership

独占基础报表页面、聚合/导出 API 和测试。不得修改前序业务状态机；只通过其公开契约聚合数据。

## Acceptance

1. 每个指标在 UI 可查看定义、时间范围和数据更新时间。
2. 筛选、汇总、明细和导出结果一致。
3. 导出遵守租户和数据范围，并写操作审计。
4. 页面布局、筛选和表格语言符合经理版。

## Evidence

返回指标口径、聚合/导出契约、范围与一致性测试、页面和导出截图。

## Verification

先运行报表聚合、导出、权限和 UI 定向测试，再运行 `rtk pnpm verify`；修改后执行 `$code-review`。
