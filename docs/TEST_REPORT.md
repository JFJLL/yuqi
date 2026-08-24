# 测试报告 (TEST_REPORT)

> 只记录实际执行结果；未执行的项明确标注「未执行」。

## 环境

- 本机: Windows (Git Bash), Node v24.11.1, pnpm 10.33.0, uv Python 3.12.13。
- **PostgreSQL: 本机未安装 → PG 集成测试未执行。**
- **Redis: 本机未安装 → Redis Worker 集成测试未执行。**

## 前端门禁

| 检查 | 基线(main) | 当前(分支) |
|---|---|---|
| pnpm lint | 失败(258, 配置问题) | 通过 (0 error / 0 warning) |
| pnpm typecheck (tsc -b --noEmit) | 无脚本 | 通过 |
| pnpm test | 无脚本 | 阶段一补充 Vitest |
| pnpm build | 通过 | 通过 |

## 后端测试

| 组 | 结果 |
|---|---|
| 单元测试 (pytest, aiosqlite) | 阶段一后逐阶段补充 |
| PostgreSQL 集成测试 (`pytest -m postgresql`) | 未执行（本机无 PostgreSQL，已标记 skip） |
| Redis Worker 集成测试 (`pytest -m redis`) | 未执行（本机无 Redis，已标记 skip） |
| ruff / mypy / alembic check / compileall | 阶段一后逐阶段执行 |
