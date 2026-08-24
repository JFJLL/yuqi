"""审计日志 API: 服务端分页 + 筛选 (audit:view)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from app.api.deps import CurrentUser, RequirePermission, SessionDep
from app.core.pagination import page_meta
from app.models.audit import AuditLog
from app.services.security_context import TenantContext

router = APIRouter(tags=["audit"])


@router.get("/audit-logs", response_model=dict)
async def list_audit_logs(
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("audit:view")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    keyword: str = Query("", max_length=100),
    action: str = Query("", max_length=100),
    date: str = Query("", max_length=20),
) -> dict:
    """审计日志列表: 操作/资源/行为关键字/日期筛选."""
    stmt = select(AuditLog).where(AuditLog.tenant_id == ctx.tenant_id)
    if keyword:
        like = f"%{keyword}%"
        stmt = stmt.where(
            AuditLog.action.like(like)
            | AuditLog.resource_type.like(like)
            | AuditLog.detail.like(like)
            | AuditLog.actor_name.like(like)
        )
    if action:
        stmt = stmt.where(AuditLog.action.like(f"%{action}%"))
    if date:
        stmt = stmt.where(AuditLog.created_at.cast(str).like(f"{date}%"))

    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (
        (
            await session.execute(
                stmt.order_by(AuditLog.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .scalars()
        .all()
    )
    items = [
        {
            "id": str(log.id),
            "actor_id": str(log.actor_id) if log.actor_id else None,
            "actor_name": log.actor_name,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "detail": log.detail,
            "before": log.before_snapshot,
            "after": log.after_snapshot,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in rows
    ]
    return {"items": items, **page_meta(page, page_size, total)}
