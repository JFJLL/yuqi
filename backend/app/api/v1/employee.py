"""员工自服务端点 (H5): 我的疑似问题 / 发起申诉 / 我的整改 / 提交整改.

数据范围强制 SELF: 员工只能访问 employee_id == 当前登录用户员工档案的数据。
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select

from app.api.deps import CurrentUser, RequirePermission, SessionDep
from app.core.errors import AppError
from app.core.pagination import page_meta
from app.models.issue import Issue, Rectification
from app.models.notification import Notification
from app.modules.notifications.service import NotificationService
from app.services.security_context import TenantContext

router = APIRouter(tags=["employee", "notifications"])


def _require_employee(ctx: TenantContext) -> uuid.UUID:
    if ctx.employee_id is None:
        raise AppError(403, "no_employee_profile", "当前账号未关联员工档案")
    return ctx.employee_id


async def _issue_self_out(issue: Issue) -> dict:
    return {
        "id": str(issue.id),
        "issue_no": issue.issue_no,
        "issue_type": issue.issue_type,
        "risk": issue.risk,
        "quote": issue.quote,
        "advice": issue.advice,
        "state": issue.review_status,  # PENDING/APPROVED/DISMISSED
        "review_status": issue.review_status,
        "appeal_status": issue.appeal_status,
        "remediation_status": issue.remediation_status,
        "close_status": issue.close_status,
        "appeal_reason": issue.appeal_reason,
        "occurred_at": issue.occurred_at.isoformat() if issue.occurred_at else None,
        "due_date": issue.due_date.isoformat() if issue.due_date else None,
    }


async def _rect_out(rect: Rectification, session) -> dict:
    issue = await session.get(Issue, rect.issue_id)
    return {
        "id": str(rect.id),
        "issue_id": str(rect.issue_id),
        "title": rect.title,
        "issue_type": issue.issue_type if issue else "",
        "quote": issue.quote if issue else "",
        "due_date": rect.due_date.isoformat(),
        "status": rect.status,
        "progress": rect.progress,
        "submit_comment": rect.submit_comment,
        "escalation_count": rect.escalation_count,
        "escalated_at": rect.escalated_at.isoformat() if rect.escalated_at else None,
        "created_at": rect.created_at.isoformat(),
    }


@router.get("/me/issues", response_model=dict)
async def my_issues(
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("employee.self:view")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    status: str = Query(""),
) -> dict:
    emp_id = _require_employee(ctx)
    stmt = select(Issue).where(
        Issue.tenant_id == ctx.tenant_id,
        Issue.employee_id == emp_id,
        Issue.deleted_at.is_(None),
    )
    if status:
        if status == "open":
            stmt = stmt.where(Issue.close_status == "OPEN")
        elif status == "appealing":
            stmt = stmt.where(Issue.appeal_status == "APPEALING")
        elif status == "rectifying":
            stmt = stmt.where(Issue.remediation_status.in_(["PENDING", "SUBMITTED"]))
        elif status == "closed":
            stmt = stmt.where(Issue.close_status == "CLOSED")
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (
        (await session.execute(stmt.order_by(Issue.occurred_at.desc()).offset((page - 1) * page_size).limit(page_size)))
        .scalars()
        .all()
    )
    return {"items": [await _issue_self_out(i) for i in rows], **page_meta(page, page_size, total)}


@router.post("/me/issues/{issue_id}/appeal", response_model=dict)
async def appeal_issue(
    issue_id: uuid.UUID,
    body: dict,
    request: Request,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("employee.self:appeal")),
) -> dict:
    emp_id = _require_employee(ctx)
    issue = await session.get(Issue, issue_id)
    if issue is None or str(issue.tenant_id) != str(ctx.tenant_id) or issue.employee_id != emp_id:
        raise AppError(404, "not_found", "问题不存在")
    if issue.appeal_status == "APPEALING":
        raise AppError(400, "already_appealing", "该问题已在申诉中")
    reason = str(body.get("reason") or "").strip()
    if not reason:
        raise AppError(400, "reason_required", "请填写申诉理由")
    issue.appeal_status = "APPEALING"
    issue.appeal_reason = reason[:2000]
    await session.flush()
    notify = NotificationService(session, ctx)
    await notify.create_for_role(
        tenant_id=ctx.tenant_id,
        role_codes=["COMPLIANCE", "STORE_MANAGER"],
        title="收到新的员工申诉",
        body=f"{issue.issue_type}: {reason[:120]}",
        notif_type="APPEAL_NEW",
        ref_type="issues",
        ref_id=str(issue.id),
    )
    from app.modules.audit.service import AuditService

    await AuditService(session, ctx, request).record(
        action="appeal.create",
        resource_type="issues",
        resource_id=str(issue.id),
        after={"appeal_status": "APPEALING"},
        detail=reason[:200],
    )
    await session.commit()
    return {"ok": True, "appeal_status": issue.appeal_status}


@router.get("/me/rectifications", response_model=dict)
async def my_rectifications(
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("employee.self:rectify")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    status: str = Query(""),
) -> dict:
    emp_id = _require_employee(ctx)
    stmt = select(Rectification).where(
        Rectification.tenant_id == ctx.tenant_id,
        Rectification.employee_id == emp_id,
        Rectification.deleted_at.is_(None),
    )
    if status:
        stmt = stmt.where(Rectification.status == status)
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (
        (await session.execute(stmt.order_by(Rectification.due_date).offset((page - 1) * page_size).limit(page_size)))
        .scalars()
        .all()
    )
    return {"items": [await _rect_out(r, session) for r in rows], **page_meta(page, page_size, total)}


@router.post("/me/rectifications/{rect_id}/submit", response_model=dict)
async def submit_rectification(
    rect_id: uuid.UUID,
    body: dict,
    request: Request,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("employee.self:rectify")),
) -> dict:
    emp_id = _require_employee(ctx)
    rect = await session.get(Rectification, rect_id)
    if rect is None or str(rect.tenant_id) != str(ctx.tenant_id) or rect.employee_id != emp_id:
        raise AppError(404, "not_found", "整改任务不存在")
    if rect.status != "PENDING":
        raise AppError(400, "not_pending", "只有待整改的任务可以提交")
    comment = str(body.get("comment") or "").strip()
    if not comment:
        raise AppError(400, "comment_required", "请填写整改说明")
    from datetime import UTC, datetime

    rect.status = "SUBMITTED"
    rect.progress = 100
    rect.submit_comment = comment[:2000]
    issue = await session.get(Issue, rect.issue_id)
    if issue is not None:
        issue.remediation_status = "SUBMITTED"
        issue.submit_comment = comment[:2000]
        issue.submitted_at = datetime.now(UTC)
    await session.flush()
    notify = NotificationService(session, ctx)
    await notify.create_for_role(
        tenant_id=ctx.tenant_id,
        role_codes=["COMPLIANCE", "STORE_MANAGER"],
        title="整改已提交待确认",
        body=rect.title,
        notif_type="RECTIFY_SUBMITTED",
        ref_type="rectifications",
        ref_id=str(rect.id),
    )
    from app.modules.audit.service import AuditService

    await AuditService(session, ctx, request).record(
        action="rectification.submit", resource_type="rectifications", resource_id=str(rect.id)
    )
    await session.commit()
    return {"ok": True, "status": rect.status}


# ---------- 通知 ----------


def _notif_out(n: Notification) -> dict:
    return {
        "id": str(n.id),
        "title": n.title,
        "body": n.body,
        "notif_type": n.notif_type,
        "ref_type": n.ref_type,
        "ref_id": n.ref_id,
        "read": n.read_at is not None,
        "created_at": n.created_at.isoformat(),
    }


@router.get("/notifications", response_model=dict)
async def list_notifications(
    session: SessionDep,
    ctx: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
) -> dict:
    notify = NotificationService(session, ctx)
    rows, total = await notify.list_for_user(ctx.user.id, page=page, page_size=page_size, unread_only=unread_only)
    return {"items": [_notif_out(n) for n in rows], **page_meta(page, page_size, total)}


@router.get("/notifications/unread-count", response_model=dict)
async def unread_count(
    session: SessionDep,
    ctx: CurrentUser,
) -> dict:
    notify = NotificationService(session, ctx)
    return {"count": await notify.unread_count(ctx.user.id)}


@router.post("/notifications/read", response_model=dict)
async def mark_notifications_read(
    body: dict,
    session: SessionDep,
    ctx: CurrentUser,
) -> dict:
    notif_id = body.get("id")
    parsed = uuid.UUID(str(notif_id)) if notif_id else None
    notify = NotificationService(session, ctx)
    count = await notify.mark_read(ctx.user.id, parsed)
    await session.commit()
    return {"ok": True, "marked": count}
