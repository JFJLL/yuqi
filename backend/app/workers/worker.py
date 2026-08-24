"""ARQ (Redis) 异步任务 Worker.

启动: arq app.workers.worker.WorkerSettings
任务注册在 WORKER_FUNCTIONS; 后续阶段 (转写/分析/对账/SLA/清理) 在此注册。
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from app.core.config import get_settings
from app.core.logging import setup_logging

# 任务函数注册表: 阶段三/四/六逐步加入
#   - run_asr_job (阶段三)
#   - run_risk_analysis (阶段四)
#   - daily_oss_reconciliation / sla_escalation_scan / retention_cleanup (阶段六)
WORKER_FUNCTIONS: dict[str, Callable[..., Any]] = {}


def _register_builtin_functions() -> None:
    from app.modules.analysis.service import run_risk_analysis
    from app.modules.ingestion.service import run_asr_job

    WORKER_FUNCTIONS["run_asr_job"] = run_asr_job
    WORKER_FUNCTIONS["run_risk_analysis"] = run_risk_analysis


_register_builtin_functions()


async def startup(ctx: dict) -> None:
    setup_logging()
    ctx["settings"] = get_settings()


async def shutdown(ctx: dict) -> None:
    return None


class WorkerSettings:
    functions = list(WORKER_FUNCTIONS.values())
    on_startup = startup
    on_shutdown = shutdown
    max_tries = 3
    job_timeout = 600
    keep_result = 7 * 24 * 3600
    max_jobs = 50

    @property
    def redis_settings(self) -> Any:
        settings = get_settings()
        from arq.connections import RedisSettings

        return RedisSettings.from_dsn(settings.redis_url)
