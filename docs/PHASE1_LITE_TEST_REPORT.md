# 一期轻量闭环 · 测试报告 (TEST REPORT)

**分支**: `codex/yuqi-phase1-lite-pocketbase-v1`
**测试时间**: 2026-08-25
**状态**: `MERGE CANDIDATE`

---

## 一、测试体系与分层

| 测试层级 | 命令 | 工具/框架 | 覆盖范围 | 结果 |
|---|---|---|---|---|
| 单元测试 | `pnpm test` | Vitest v4 | 8 类正式内置规则 56+ table-driven 测试 + 上传 Token 安全 | **42/42 PASS** |
| 集成测试 | `pnpm test:integration` | Node.js Test Runner | 27 项端到端业务场景 + 2 条完整闭环 Flow | **29/29 PASS** |
| 子进程 E2E | `pnpm test:e2e` | Node.js Test Runner | 真实多子进程自动化端到端贯通测试 | **1/1 PASS** |
| 部署验证 | `pnpm test:deploy` | Node.js Test Runner | 部署脚本静态分析、环境区分与 ASR 健康检查矩阵 | **7/7 PASS** |
| 全量门禁 | `pnpm verify` | All-in-one | lint + typecheck + secrets + test + integration + e2e + deploy + build + diff | **ALL PASS** |

---

## 二、数据范围隔离验证

- `transcript_segments` 与 `risk_segments` 通过 `session.store.region` 递归查询实现了华东大区与北京大区的严格隔离。
- 区域经理不可见跨大区分段与证据 (404 / 列表过滤)；A 店店长不可见跨店记录 (404 / 列表过滤)。
- 员工端禁止调用通用 CRUD API (403)，仅允许通过已推送问题的员工专用接口获取必要片段。
- 审计员对全租户数据只读 (200)，所有写操作均被拒绝 (403)。

---

## 三、ASR 导入原子性与下游故障恢复验证 (ASR Import Atomicity & Recovery)

针对 ASR 导入原子性完成语义进行了单点 P0 深度加固与测试覆盖：
1. **故障注入 (Test A - Downstream Failure)**: 模拟 ASR 成功后在下游 `persistSessionAndSegments` 发生异常。断言异常未被吞掉并正确抛出，`asr_job.result_imported_at` 严格保持为空，`asr_job.status` 保持为 `queued`，`error_code` 置为 `downstream_persist_failed`，`error_message` 记录脱敏错误信息，未产生孤儿 `sessions` 或 `processing_jobs`。
2. **自动恢复重试 (Test B - Downstream Recovery)**: 对上述失败状态的 `asr_job` 再次执行真实导入。断言成功恢复，`asr_job.status` 置为 `succeeded`，`result_imported_at` 回填时间戳，`error_code` 清空，下游 `session`, `transcript_segments`, `processing_jobs`, `risk_segments`, `issues` 全部正常补齐并被 Worker 成功处理。
3. **半完成故障幂等恢复 (Test C - Partial Recovery)**: 模拟部分下游数据（如 `session` 与分段 1）已写入后发生崩溃。再次重试导入后，断言已存在数据被安全复用，分段不重复，最终分段为严格递增序列 `[1, 2, 3]`。
4. **重复导入与崩溃重放验证 (Test D - Replay & Crash Idempotency)**: 对带 `result_imported_at` 的完成任务重复调用立即安全跳过；模拟崩溃丢失 `result_imported_at` 后重放，6 类核心数据表（`transcripts`, `sessions`, `transcript_segments`, `processing_jobs`, `risk_segments`, `issues`）记录总数严格保持完全一致 (+0)。

---

## 四、ASR 健康检查环境矩阵验证

- 生产环境未配置真实 ASR (degraded/unconfigured) 或处于 mock 模式时，健康检查判定为 FAIL (Exit 1)。
- 生产环境配置 private ASR 时，健康检查判定为 PASS (Exit 0)。
- 测试环境处于 mock 或 private 模式时，健康检查判定为 PASS (Exit 0)。

---

## 五、最终验收结论

所有 P0 修复、数据范围加固、ASR 重复导入幂等测试、生产健康检查修复及全量门禁命令全数通过。工作区干净，达到合并候选标准。

**最终状态**: `MERGE CANDIDATE`
