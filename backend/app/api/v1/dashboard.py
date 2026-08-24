"""工作台聚合 API: 统计卡片 + 重点问题 + 门店排行 (登录即可见, 强制数据范围)."""

from __future__ import annotations

from datetime import date, datetime, time

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.api.deps import CurrentUser, SessionDep
from app.api.v1.analysis import issue_display_state
from app.api.v1.reports import _visible_store_ids
from app.models.issue import Issue, Rectification
from app.models.org import Employee, Store
from app.models.recording import AudioFile
from app.services.security_context import DataScopeService

router = APIRouter(tags=["dashboard"])

TABS = {"all", "high", "appealing"}


@router.get("/dashboard/summary", response_model=dict)
async def dashboard_summary(
    session: SessionDep,
    ctx: CurrentUser,
    tab: str = Query("all"),
) -> dict:
    """工作台总览: stats / key_issues / store_rank, 支持 tab 过滤."""
    if tab not in TABS:
        tab = "all"
    scope = DataScopeService(ctx)
    store_ids = await _visible_store_ids(session, ctx, scope)

    def issue_stmt():
        stmt = select(Issue).where(Issue.tenant_id == ctx.tenant_id, Issue.deleted_at.is_(None))
        if store_ids is not None:
            stmt = stmt.where(Issue.store_id.in_(store_ids))
        return stmt

    today_start = datetime.combine(date.today(), time.min)

    # ---- stats ----
    transcripts_today = (
        await session.scalar(
            select(func.count())
            .select_from(AudioFile)
            .where(
                AudioFile.tenant_id == ctx.tenant_id,
                AudioFile.deleted_at.is_(None),
                AudioFile.occurred_at >= today_start,
            )
        )
        or 0
    )
    stores_total = await session.scalar(
        select(func.count()).select_from(
            select(Store).where(Store.tenant_id == ctx.tenant_id, Store.deleted_at.is_(None)).subquery()
        )
    ) or 0
    stores_covered = (
        await session.scalar(
            select(func.count(AudioFile.store_id.distinct())).where(
                AudioFile.tenant_id == ctx.tenant_id,
                AudioFile.deleted_at.is_(None),
                AudioFile.store_id.isnot(None),
            )
        )
        or 0
    )
    issues_today = (
        await session.scalar(
            select(func.count()).select_from(issue_stmt().where(Issue.occurred_at >= today_start).subquery())
        )
        or 0
    )
    high_risk = (
        await session.scalar(
            select(func.count()).select_from(issue_stmt().where(Issue.risk == "高").subquery())
        )
        or 0
    )
    open_tasks = (
        await session.scalar(
            select(func.count()).select_from(
                select(Rectification)
                .where(
                    Rectification.tenant_id == ctx.tenant_id,
                    Rectification.deleted_at.is_(None),
                    Rectification.status.in_(["PENDING", "SUBMITTED"]),
                )
                .subquery()
            )
        )
        or 0
    )
    overdue_tasks = (
        await session.scalar(
            select(func.count()).select_from(
                select(Rectification)
                .where(
                    Rectification.tenant_id == ctx.tenant_id,
                    Rectification.deleted_at.is_(None),
                    Rectification.status.in_(["PENDING", "SUBMITTED"]),
                    Rectification.due_date < date.today(),
                )
                .subquery()
            )
        )
        or 0
    )
    rect_total = (
        await session.scalar(
            select(func.count()).select_from(
                select(Rectification).where(
                    Rectification.tenant_id == ctx.tenant_id, Rectification.deleted_at.is_(None)
                ).subquery()
            )
        )
        or 0
    )
    rect_done = (
        await session.scalar(
            select(func.count()).select_from(
                select(Rectification).where(
                    Rectification.tenant_id == ctx.tenant_id,
                    Rectification.deleted_at.is_(None),
                    Rectification.status == "CONFIRMED",
                ).subquery()
            )
        )
        or 0
    )
    rectify_rate = round(rect_done * 100 / rect_total, 1) if rect_total else 0.0
    pending_appeals = (
        await session.scalar(
            select(func.count()).select_from(
                issue_stmt().where(Issue.appeal_status == "APPEALING").subquery()
            )
        )
        or 0
    )
    overdue_appeals = (
        await session.scalar(
            select(func.count()).select_from(
                issue_stmt().where(
                    Issue.appeal_status == "APPEALING", Issue.updated_at < today_start
                ).subquery()
            )
        )
        or 0
    )

    stats = {
        "transcripts_today": transcripts_today,
        "stores_covered": stores_covered,
        "stores_total": stores_total,
        "issues_today": issues_today,
        "high_risk": high_risk,
        "rectify_rate": rectify_rate,
        "open_tasks": open_tasks,
        "overdue_tasks": overdue_tasks,
        "pending_appeals": pending_appeals,
        "overdue_appeals": overdue_appeals,
    }

    # ---- key issues (tab 过滤) ----
    base = issue_stmt()
    if tab == "high":
        base = base.where(Issue.risk == "高")
    elif tab == "appealing":
        base = base.where(Issue.appeal_status == "APPEALING")
    issue_rows = (
        (
            await session.execute(
                base.order_by(Issue.occurred_at.desc()).limit(10)
            )
        )
        .scalars()
        .all()
    )
    emp_ids = {i.employee_id for i in issue_rows if i.employee_id}
    issue_store_ids = {i.store_id for i in issue_rows if i.store_id}
    employees = (
        (
            await session.execute(select(Employee).where(Employee.id.in_(emp_ids)))
        )
        .scalars()
        .all()
    ) if emp_ids else []
    stores = (
        (
            await session.execute(select(Store).where(Store.id.in_(issue_store_ids)))
        )
        .scalars()
        .all()
    ) if issue_store_ids else []
    emp_by_id = {e.id: e for e in employees}
    store_by_id = {s.id: s for s in stores}

    key_issues = []
    for issue in issue_rows:
        emp_name = (
            emp_by_id[issue.employee_id].name
            if issue.employee_id and issue.employee_id in emp_by_id
            else None
        )
        store_name = (
            store_by_id[issue.store_id].name
            if issue.store_id and issue.store_id in store_by_id
            else None
        )
        key_issues.append(
            {
                "id": str(issue.id),
                "employee_name": emp_name,
                "store_name": store_name,
                "issue_type": issue.issue_type,
                "risk": issue.risk,
                "state": issue_display_state(issue),
                "quote": issue.quote,
                "advice": issue.advice,
                "occurred_at": issue.occurred_at.isoformat() if issue.occurred_at else None,
            }
        )

    # ---- store rank (问题数降序, 前 5) ----
    rank_rows = (
        (
            await session.execute(
                issue_stmt()
                .with_only_columns(Issue.store_id, func.count(Issue.id).label("cnt"))
                .group_by(Issue.store_id)
                .order_by(func.count(Issue.id).desc())
                .limit(5)
            )
        )
        .all()
    )
    rank_store_ids = {r.store_id for r in rank_rows if r.store_id}
    rank_stores = (
        (
            await session.execute(select(Store).where(Store.id.in_(rank_store_ids)))
        )
        .scalars()
        .all()
    ) if rank_store_ids else []
    rank_store_by_id = {s.id: s for s in rank_stores}
    total_issues = (
        await session.scalar(select(func.count()).select_from(issue_stmt().subquery())) or 0
    )
    store_rank = [
        {
            "store_id": str(r.store_id),
            "store_name": rank_store_by_id[r.store_id].name if r.store_id and r.store_id in rank_store_by_id else "-",
            "issue_count": r.cnt,
            "share": round(r.cnt * 100 / total_issues, 1) if total_issues else 0.0,
        }
        for r in rank_rows
        if r.store_id
    ]

    return {"stats": stats, "key_issues": key_issues, "store_rank": store_rank}
