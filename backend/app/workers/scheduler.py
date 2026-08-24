"""ARQ Scheduler: 每日定时任务 (OSS 对账 / SLA 扫描 / 保留期清理)."""

from __future__ import annotations

from typing import Any

from app.workers.worker import WorkerSettings


async def cron_daily_reconciliation(ctx: dict) -> None:
    """每日 OSS 全量对账 + SLA 扫描 + 保留期清理 (阶段六实现具体逻辑)."""

    from app.core.logging import get_logger

    get_logger("yuqi.scheduler").info("daily_reconciliation_tick")
    # TODO(phase6): 调用对应服务
    return None


async def cron_sla_scan(ctx: dict) -> None:
    return None


async def cron_retention_cleanup(ctx: dict) -> None:
    return None


class SchedulerSettings(WorkerSettings):
    cron_jobs: list[dict[str, Any]] = [
        {"cron": {"hour": 3, "minute": 0}, "func": cron_daily_reconciliation, "unique": True},
        {"cron": {"hour": 8, "minute": 30}, "func": cron_sla_scan, "unique": True},
        {"cron": {"hour": 4, "minute": 0}, "func": cron_retention_cleanup, "unique": True},
    ]
