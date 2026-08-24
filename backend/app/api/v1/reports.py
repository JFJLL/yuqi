"""统计报表 API: 租户总览 + 区域维度聚合 (report:view, 强制数据范围)."""

from __future__ import annotations

import uuid
from datetime import date, datetime, time

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, RequirePermission, SessionDep
from app.models.issue import Issue, Rectification
from app.models.org import Employee, OrganizationNode, Store
from app.models.recording import AudioFile, Conversation
from app.services.security_context import DataScopeService, TenantContext

router = APIRouter(tags=["reports"])


async def _visible_store_ids(
    session: AsyncSession, ctx: TenantContext, scope: DataScopeService
) -> list[uuid.UUID] | None:
    """返回可见门店 ID 列表; None 表示全量可见."""
    if scope.can_see_all:
        return None
    ids = set(ctx.store_ids)
    # SELF 范围: 追加本人所在门店
    if "SELF" in ctx.data_scope_types and ctx.employee_id is not None:
        emp = await session.get(Employee, ctx.employee_id)
        if emp and emp.store_id:
            ids.add(emp.store_id)
    return list(ids)


@router.get("/reports/overview", response_model=dict)
async def report_overview(
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("report:view")),
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
) -> dict:
    """租户级合规总览: 问题/高风险/整改率/录音/转写/申诉/逾期."""
    scope = DataScopeService(ctx)
    store_ids = await _visible_store_ids(session, ctx, scope)

    def issue_stmt():
        stmt = select(Issue).where(Issue.tenant_id == ctx.tenant_id, Issue.deleted_at.is_(None))
        if store_ids is not None:
            stmt = stmt.where(Issue.store_id.in_(store_ids))
        if date_from:
            stmt = stmt.where(Issue.occurred_at >= datetime.combine(date_from, time.min))
        if date_to:
            stmt = stmt.where(Issue.occurred_at <= datetime.combine(date_to, time.max))
        return stmt

    issues_total = await session.scalar(select(func.count()).select_from(issue_stmt().subquery())) or 0
    high_risk = (
        await session.scalar(
            select(func.count()).select_from(issue_stmt().where(Issue.risk == "高").subquery())
        )
        or 0
    )
    issues_today = (
        await session.scalar(
            select(func.count()).select_from(
                issue_stmt().where(Issue.occurred_at >= datetime.combine(date.today(), time.min)).subquery()
            )
        )
        or 0
    )

    def rect_stmt():
        stmt = select(Rectification).where(
            Rectification.tenant_id == ctx.tenant_id, Rectification.deleted_at.is_(None)
        )
        if store_ids is not None:
            stmt = stmt.where(Rectification.store_id.in_(store_ids))
        return stmt

    rect_total = await session.scalar(select(func.count()).select_from(rect_stmt().subquery())) or 0
    rect_done = (
        await session.scalar(
            select(func.count()).select_from(
                rect_stmt().where(Rectification.status == "CONFIRMED").subquery()
            )
        )
        or 0
    )
    overdue_tasks = (
        await session.scalar(
            select(func.count()).select_from(
                rect_stmt().where(
                    Rectification.status.in_(["PENDING", "SUBMITTED"]),
                    Rectification.due_date < date.today(),
                ).subquery()
            )
        )
        or 0
    )
    rectify_rate = round(rect_done * 100 / rect_total, 1) if rect_total else 0.0

    def audio_stmt():
        stmt = select(AudioFile).where(AudioFile.tenant_id == ctx.tenant_id, AudioFile.deleted_at.is_(None))
        if store_ids is not None:
            stmt = stmt.where(AudioFile.store_id.in_(store_ids))
        if date_from:
            stmt = stmt.where(AudioFile.occurred_at >= datetime.combine(date_from, time.min))
        if date_to:
            stmt = stmt.where(AudioFile.occurred_at <= datetime.combine(date_to, time.max))
        return stmt

    recordings_total = await session.scalar(select(func.count()).select_from(audio_stmt().subquery())) or 0
    transcripts_total = (
        await session.scalar(
            select(func.count()).select_from(
                audio_stmt()
                .join(Conversation, Conversation.audio_file_id == AudioFile.id)
                .where(Conversation.status == "READY")
                .subquery()
            )
        )
        or 0
    )
    pending_appeals = (
        await session.scalar(
            select(func.count()).select_from(
                issue_stmt().where(Issue.appeal_status == "APPEALING").subquery()
            )
        )
        or 0
    )
    store_total = (
        await session.scalar(
            select(func.count()).select_from(
                select(Store).where(Store.tenant_id == ctx.tenant_id).subquery()
            )
        )
        or 0
    )

    return {
        "issues_total": issues_total,
        "high_risk": high_risk,
        "issues_today": issues_today,
        "rectify_rate": rectify_rate,
        "rectify_total": rect_total,
        "overdue_tasks": overdue_tasks,
        "recordings_total": recordings_total,
        "transcripts_total": transcripts_total,
        "pending_appeals": pending_appeals,
        "stores_total": store_total,
    }


@router.get("/reports/regions", response_model=dict)
async def report_regions(
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("report:view")),
) -> dict:
    """区域维度聚合: 门店数 / 录音数 / 问题数 / 高风险 / 整改率 / 申诉通过率."""
    scope = DataScopeService(ctx)
    store_ids = await _visible_store_ids(session, ctx, scope)

    stores = (
        (
            await session.execute(
                select(Store).where(Store.tenant_id == ctx.tenant_id, Store.deleted_at.is_(None))
            )
        )
        .scalars()
        .all()
    )
    nodes = (
        (
            await session.execute(
                select(OrganizationNode).where(OrganizationNode.tenant_id == ctx.tenant_id)
            )
        )
        .scalars()
        .all()
    )
    node_by_id = {n.id: n for n in nodes}
    parent_of = {n.id: n.parent_id for n in nodes if n.parent_id is not None}

    def region_of(node_id: uuid.UUID | None) -> OrganizationNode | None:
        cur = node_by_id.get(node_id) if node_id else None
        seen: set[uuid.UUID] = set()
        while cur is not None and cur.id not in seen:
            seen.add(cur.id)
            if cur.node_type == "REGION":
                return cur
            parent = parent_of.get(cur.id)
            cur = node_by_id.get(parent) if parent else None
        return None

    visible = set(store_ids) if store_ids is not None else None
    store_regions: dict[uuid.UUID, list[Store]] = {}
    for store in stores:
        if visible is not None and store.id not in visible:
            continue
        region = region_of(store.node_id)
        if region is None:
            continue
        store_regions.setdefault(region.id, []).append(store)

    def issue_stmt(store_sub: list[uuid.UUID]):
        return select(Issue).where(
            Issue.tenant_id == ctx.tenant_id,
            Issue.deleted_at.is_(None),
            Issue.store_id.in_(store_sub),
        )

    def rect_stmt(store_sub: list[uuid.UUID]):
        return select(Rectification).where(
            Rectification.tenant_id == ctx.tenant_id,
            Rectification.deleted_at.is_(None),
            Rectification.store_id.in_(store_sub),
        )

    def audio_stmt(store_sub: list[uuid.UUID]):
        return select(AudioFile).where(
            AudioFile.tenant_id == ctx.tenant_id,
            AudioFile.deleted_at.is_(None),
            AudioFile.store_id.in_(store_sub),
        )

    items = []
    ordered = sorted(
        store_regions.items(), key=lambda kv: node_by_id[kv[0]].sort_order if kv[0] in node_by_id else 0
    )
    for region_id, region_stores in ordered:
        region = node_by_id[region_id]
        sub = [s.id for s in region_stores]
        issue_total = await session.scalar(select(func.count()).select_from(issue_stmt(sub).subquery())) or 0
        high_risk = (
            await session.scalar(
                select(func.count()).select_from(issue_stmt(sub).where(Issue.risk == "高").subquery())
            )
            or 0
        )
        rect_total = await session.scalar(select(func.count()).select_from(rect_stmt(sub).subquery())) or 0
        rect_done = (
            await session.scalar(
                select(func.count()).select_from(
                    rect_stmt(sub).where(Rectification.status == "CONFIRMED").subquery()
                )
            )
            or 0
        )
        recording_total = await session.scalar(select(func.count()).select_from(audio_stmt(sub).subquery())) or 0
        appealed = (
            await session.scalar(
                select(func.count()).select_from(
                    issue_stmt(sub).where(Issue.appeal_status != "NONE").subquery()
                )
            )
            or 0
        )
        appealed_passed = (
            await session.scalar(
                select(func.count()).select_from(
                    issue_stmt(sub).where(Issue.appeal_status == "APPEAL_APPROVED").subquery()
                )
            )
            or 0
        )
        items.append(
            {
                "region_id": str(region.id),
                "region_name": region.name,
                "store_count": len(region_stores),
                "recording_count": recording_total,
                "issue_count": issue_total,
                "high_risk": high_risk,
                "rectify_rate": round(rect_done * 100 / rect_total, 1) if rect_total else 0.0,
                "appeal_pass_rate": round(appealed_passed * 100 / appealed, 1) if appealed else 0.0,
            }
        )

    return {"items": items}
