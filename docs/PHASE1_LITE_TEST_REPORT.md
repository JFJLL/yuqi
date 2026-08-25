# 一期轻量闭环 · 测试报告 (TEST REPORT)

## 测试体系

- 单元测试: Vitest (`pnpm test`)
  - server/risk-analyzer (8 类规则: 命中/不命中/排除/幂等)
  - server/business-worker 领取/重试/幂等逻辑 (Mock PB 客户端)
  - 权限/范围辅助函数
- 集成测试: Node 内置 test runner (`pnpm test:integration`)
  - 启动仓库内 PocketBase 二进制 (临时 pb_data + 临时端口), 执行迁移, 建演示租户与各角色用户, 走 HTTP 真实路由, 结束清理
- 前端: 构建即类型检查 (tsc -b)

## 场景覆盖 (25 项)

1. 未登录不可读业务数据
2. 跨 tenant 404/403
3. A 店店长不能查看/修改 B 店问题
4. 区域经理查看本区域子门店
5. 员工仅看本人已推送问题
6. 待复核问题不出现在员工端
7. 设备活跃绑定唯一
8. OSS 重复对象不重复登记
9. ASR 重复回调不重复写结果
10. 分析任务幂等
11. 八类规则命中
12. 一会话多个问题
13. 证据时间锚点
14. 申诉通过保留原始问题
15. 申诉驳回进入整改
16. 要求补充后再次提交
17. 整改退回后再次提交
18. 店长确认关闭
19. 报表数据更新
20. 导出包含操作人标识
21. 查看完整转写写审计
22. 证据锁阻止删除
23. Worker 崩溃任务恢复
24. 固定验证码生产禁用
25. demo seed 幂等

# 一期轻量闭环 · 测试报告 (TEST REPORT)

## 测试体系

- 单元测试: Vitest (`pnpm test`)
  - `server/rule-analyzer.test.mjs` (8 类规则正反用例、正则复杂度防御、相邻窗口组词、时间锚点与幂等性等 18 个用例)
- 集成测试: Node 内置 test runner (`pnpm test:integration`)
  - `tests/integration/phase1-scenarios.test.mjs` (覆盖 25 项核心业务与安全场景)
  - `tests/integration/phase1-e2e-flow.test.mjs` (覆盖 2 条全流程完整贯通验收链路)
- 质量门禁:
  - TypeScript 类型检查 (`pnpm typecheck`)
  - 代码风格审查 (`pnpm lint`)
  - 密钥扫描 (`pnpm lint:secrets`)
  - 前端生产构建 (`pnpm build`)

## 25 项场景覆盖结果

| 序号 | 场景名称 | 测试文件 | 验证方式 | 结果 |
|---|---|---|---|---|
| 1 | 未登录不可读业务数据 | phase1-scenarios.test.mjs | HTTP 401 / 底层集合规则 403 | PASS |
| 2 | 跨 tenant 返回 404/403 | phase1-scenarios.test.mjs | 其他租户访问 demo 资源 | PASS |
| 3 | A 店店长不能查看/修改 B 店问题 | phase1-scenarios.test.mjs | STORE 数据范围 + 守卫路由 | PASS |
| 4 | 区域经理查看本区域子门店 | phase1-scenarios.test.mjs | ORG_TREE 树遍历 + 跨区 404 | PASS |
| 5 | 员工仅看本人已推送问题 | phase1-scenarios.test.mjs | SELF 范围 + 状态过滤 | PASS |
| 6 | 待复核问题不出现在员工端 | phase1-scenarios.test.mjs | review=PENDING 列表不返回且直查 404 | PASS |
| 7 | 设备活跃绑定唯一 | phase1-scenarios.test.mjs | 部分唯一索引 (tenant+device ACTIVE) | PASS |
| 8 | OSS 重复对象不重复登记 | phase1-scenarios.test.mjs | object_key 唯一索引 + 幂等返回 duplicate:true | PASS |
| 9 | ASR 重复回调不重复写结果 | phase1-scenarios.test.mjs | 转写/分段幂等更新 | PASS |
| 10 | 分析任务幂等 | phase1-scenarios.test.mjs | idempotency_key 幂等入队 | PASS |
| 11 | 八类规则命中与不命中 | phase1-scenarios.test.mjs | 正向命中 + 排除话术 | PASS |
| 12 | 一会话多个问题 | phase1-scenarios.test.mjs | 单会话命中多规则生成多问题 | PASS |
| 13 | 证据时间锚点 | phase1-scenarios.test.mjs | start_ms / end_ms / speaker 保留 | PASS |
| 14 | 申诉通过保留原始问题 | phase1-scenarios.test.mjs | 申诉 APPROVED, 问题 CLOSED, 原始规则保留 | PASS |
| 15 | 申诉驳回进入整改 | phase1-scenarios.test.mjs | 申诉 REJECTED, 进入整改派发 | PASS |
| 16 | 要求补充后再次提交 | phase1-scenarios.test.mjs | NEEDS_MORE_INFO -> supplement 恢复 PENDING | PASS |
| 17 | 整改退回后再次提交 | phase1-scenarios.test.mjs | NEEDS_REVISION -> submit, retry_count=1 | PASS |
| 18 | 店长确认关闭 | phase1-scenarios.test.mjs | confirm -> CONFIRMED, 问题 CLOSED | PASS |
| 19 | 报表数据更新 | phase1-scenarios.test.mjs | GET /api/reports/overview 服务端聚合 | PASS |
| 20 | 导出包含操作人标识 | phase1-scenarios.test.mjs | CSV 包含租户/操作人/免责声明/写审计 | PASS |
| 21 | 查看完整转写写审计 | phase1-scenarios.test.mjs | transcript_view 写 audit_logs | PASS |
| 22 | 证据锁阻止删除 | phase1-scenarios.test.mjs | 被问题引用的转写删除返回 400 | PASS |
| 23 | Worker 崩溃任务恢复 | phase1-scenarios.test.mjs | 锁超时原子重新领取 | PASS |
| 24 | 固定验证码生产禁用 | phase1-scenarios.test.mjs | YUQI_ENV=production 返回 503 sms_not_configured | PASS |
| 25 | demo seed 幂等 | phase1-scenarios.test.mjs | 两次执行 seed-phase1-demo.mjs 数量不增加 | PASS |

## 端到端贯通链路覆盖结果 (Section 18)

1. **Flow 1 完整合规闭环**: 管理员登录 -> 创建组织/门店/员工/设备 -> 员工知情同意 -> 申请并审批绑定 -> 音频上传与 Mock 转写 -> 会话与分段入库 -> Worker 规则分析 -> 命中生成疑似问题 -> 合规复核通过并推送 -> 员工验证码登录查看 -> 员工申诉 -> 店长驳回 -> 派发整改 -> 员工提交 -> 店长退回 -> 员工重提 -> 店长确认 -> 问题关闭 -> 报表数据与导出更新 -> 审计日志完整记录。(**PASS**, 180ms)
2. **Flow 2 申诉成立闭环**: 疑似问题 -> 合规复核推送 -> 员工申诉 -> 申诉成立通过 -> 原始命中规则保留 -> 最终有效问题数扣减 / 误报数增加 -> 申诉通过率更新。(**PASS**, 28ms)

## 执行摘要

- 单测用例数: **18** 全部通过
- 集成用例数: **27** (25 场景 + 2 E2E 流程) 全部通过
- 类型检查: **PASS** (0 错误)
- ESLint: **PASS** (0 错误)
- 密钥扫描: **PASS** (0 泄露)
- 前端构建: **PASS** (dist 输出正常)
