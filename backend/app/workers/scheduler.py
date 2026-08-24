"""ARQ Scheduler: 每日定时任务 (OSS 对账 / SLA 扫描 / 保留期清理)."""

from __future__ import annotations

from typing import Any

from app.workers.worker import WorkerSettings


async def cron_daily_reconciliation(ctx: dict) -> None:
    """每日 OSS 全量对账 (阶段六实现具体逻辑)."""

    from app.core.logging import get_logger

    get_logger("yuqi.scheduler").info("daily_reconciliation_tick")
    # TODO(phase6): 调用对账服务
    return None


async def run_sla_scan(session_factory=None) -> int:
    """SLA 扫描: 到期未整改任务升级通知 (员工 + 店长/合规). 返回升级条数."""

    from datetime import UTC, date, datetime

    from sqlalchemy import select

    from app.core.logging import get_logger
    from app.db.session import get_session_factory
    from app.models.auth import User
    from app.models.issue import Rectification
    from app.modules.notifications.service import NotificationService

    logger = get_logger("yuqi.scheduler")
    factory = session_factory or get_session_factory()
    async with factory() as session:
        overdue = (
            (
                await session.execute(
                    select(Rectification).where(
                        Rectification.deleted_at.is_(None),
                        Rectification.status.in_(["PENDING", "SUBMITTED"]),
                        Rectification.due_date < date.today(),
                    )
                )
            )
            .scalars()
            .all()
        )
        escalated = 0
        for rect in overdue:
            rect.escalation_count += 1
            rect.escalated_at = datetime.now(UTC)
            notify = NotificationService(session)
            if rect.employee_id:
                emp_user = await session.scalar(
                    select(User).where(User.tenant_id == rect.tenant_id, User.employee_id == rect.employee_id)
                )
                if emp_user is not None:
                    await notify.create(
                        tenant_id=rect.tenant_id,
                        user_id=emp_user.id,
                        title="整改任务已逾期",
                        body=rect.title,
                        notif_type="RECTIFY_DUE",
                        ref_type="rectifications",
                        ref_id=str(rect.id),
                    )
            await notify.create_for_role(
                tenant_id=rect.tenant_id,
                role_codes=["COMPLIANCE", "STORE_MANAGER"],
                title="整改逾期升级",
                body=rect.title,
                notif_type="SLA_ESCALATED",
                ref_type="rectifications",
                ref_id=str(rect.id),
            )
            escalated += 1
        await session.commit()
        logger.info("sla_scan_done", escalated=escalated)
    return escalated


async def cron_sla_scan(ctx: dict) -> None:
    """ARQ 定时任务入口."""

    await run_sla_scan()


async def cron_retention_cleanup(ctx: dict) -> None:
    return None


class SchedulerSettings(WorkerSettings):
    cron_jobs: list[dict[str, Any]] = [
        {"cron": {"hour": 3, "minute": 0}, "func": cron_daily_reconciliation, "unique": True},
        {"cron": {"hour": 8, "minute": 30}, "func": cron_sla_scan, "unique": True},
        {"cron": {"hour": 4, "minute": 0}, "func": cron_retention_cleanup, "unique": True},
    ]
