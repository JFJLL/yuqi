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

## 三、ASR 重复导入幂等验证

- 导出真实网关 `importSucceededJob` 函数并在集成测试中针对同一 `asr_job` 调用两次。
- 统计 6 类核心数据表（`transcripts`, `sessions`, `transcript_segments`, `processing_jobs`, `risk_segments`, `issues`），严格断言记录总数完全保持一致 (+0)。
- 模拟崩溃导致 `result_imported_at` 丢失后重放，6 类数据仍严格保持不变 (+0)。

---

## 四、ASR 健康检查环境矩阵验证

- 生产环境未配置真实 ASR (degraded/unconfigured) 或处于 mock 模式时，健康检查判定为 FAIL (Exit 1)。
- 生产环境配置 private ASR 时，健康检查判定为 PASS (Exit 0)。
- 测试环境处于 mock 或 private 模式时，健康检查判定为 PASS (Exit 0)。

---

## 五、最终验收结论

所有 P0 修复、数据范围加固、ASR 重复导入幂等测试、生产健康检查修复及全量门禁命令全数通过。工作区干净，达到合并候选标准。

**最终状态**: `MERGE CANDIDATE`
