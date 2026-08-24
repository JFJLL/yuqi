"""风险分析端点: 规则库 / 疑似问题 / 人工复核 / 推送整改 / 重跑分析."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, or_, select

from app.api.deps import CurrentUser, RequirePermission, SessionDep
from app.core.pagination import page_meta
from app.models.issue import Issue, RiskRule
from app.models.org import Employee, Store
from app.modules.analysis.service import IssueWorkflow, RiskAnalyzer, RuleService
from app.services.security_context import DataScopeService, TenantContext

router = APIRouter(tags=["analysis"])


def rule_out(rule: RiskRule) -> dict[str, Any]:
    return {
        "id": str(rule.id),
        "rule_set": rule.rule_set,
        "code": rule.code,
        "name": rule.name,
        "description": rule.description,
        "category": rule.category,
        "severity": rule.severity,
        "keywords": rule.keywords or [],
        "enabled": rule.enabled,
        "version_no": rule.version_no,
        "sort_order": rule.sort_order,
        "created_at": rule.created_at.isoformat(),
        "updated_at": rule.updated_at.isoformat(),
    }


def issue_display_state(issue: Issue) -> str:
    if issue.review_status == "PENDING":
        return "待复核"
    if issue.review_status == "DISMISSED":
        return "已驳回"
    if issue.appeal_status == "APPEALING":
        return "申诉中"
    if issue.close_status == "CLOSED":
        return "已完成"
    if issue.remediation_status in ("PENDING", "SUBMITTED", "CONFIRMED"):
        return "待整改" if issue.remediation_status != "CONFIRMED" else "已完成"
    return "待整改"


async def _issue_out(session, issue: Issue) -> dict[str, Any]:
    emp = await session.get(Employee, issue.employee_id) if issue.employee_id else None
    store = await session.get(Store, issue.store_id) if issue.store_id else None
    return {
        "id": str(issue.id),
        "issue_no": issue.issue_no,
        "occurred_at": issue.occurred_at.isoformat() if issue.occurred_at else None,
        "employee": str(issue.employee_id) if issue.employee_id else None,
        "store": str(issue.store_id) if issue.store_id else None,
        "employee_name": emp.name if emp else None,
        "store_name": store.name if store else None,
        "issue_type": issue.issue_type,
        "risk": issue.risk,
        "quote": issue.quote,
        "advice": issue.advice,
        "source": issue.source,
        "state": issue_display_state(issue),
        "review_status": issue.review_status,
        "appeal_status": issue.appeal_status,
        "remediation_status": issue.remediation_status,
        "close_status": issue.close_status,
        "employee_view_status": issue.employee_view_status,
        "segment_count": len(issue.segments),
        "due_date": issue.due_date.isoformat() if issue.due_date else None,
    }


async def _visible_issue_stmt(ctx: TenantContext):
    stmt = select(Issue).where(Issue.tenant_id == ctx.tenant_id, Issue.deleted_at.is_(None))
    scope = DataScopeService(ctx)
    if not scope.can_see_all:
        conditions: list[Any] = []
        if ctx.store_ids:
            conditions.append(Issue.store_id.in_(ctx.store_ids))
        if "SELF" in ctx.data_scope_types and ctx.employee_id is not None:
            conditions.append(Issue.employee_id == ctx.employee_id)
        if conditions:
            stmt = stmt.where(or_(*conditions))
        else:
            stmt = stmt.where(Issue.id.in_([]))
    return stmt


# ---------- 规则库 ----------

@router.get("/rules", response_model=dict)
async def list_rules(
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("rules:manage")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    keyword: str = Query("", max_length=64),
    enabled: str = Query(""),
) -> dict:
    rows, total = await RuleService(session, ctx).list_rules(
        page=page, page_size=page_size, keyword=keyword, enabled=enabled
    )
    return {
        "items": [rule_out(r) for r in rows],
        **page_meta(page, page_size, total),
    }


@router.post("/rules", response_model=dict, status_code=201)
async def create_rule(
    body: dict,
    request: Request,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("rules:manage")),
) -> dict:
    service = RuleService(session, ctx)
    rule = await service.create(
        code=str(body.get("code", "")).strip(),
        name=str(body.get("name", "")).strip(),
        category=str(body.get("category") or "general"),
        severity=str(body.get("severity") or "medium"),
        keywords=[str(k).strip() for k in (body.get("keywords") or []) if str(k).strip()],
        description=str(body.get("description") or ""),
        enabled=bool(body.get("enabled", True)),
        change_note=str(body.get("change_note") or ""),
    )
    from app.modules.audit.service import AuditService

    await AuditService(session, ctx, request).record(
        action="rule.create", resource_type="risk_rules", resource_id=str(rule.id), detail=rule.code
    )
    await session.commit()
    await session.refresh(rule)
    return rule_out(rule)


@router.patch("/rules/{rule_id}", response_model=dict)
async def update_rule(
    rule_id: uuid.UUID,
    body: dict,
    request: Request,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("rules:manage")),
) -> dict:
    service = RuleService(session, ctx)
    rule = await service.update(
        rule_id,
        name=body.get("name"),
        description=body.get("description"),
        category=body.get("category"),
        severity=body.get("severity"),
        keywords=body.get("keywords"),
        enabled=body.get("enabled"),
        change_note=body.get("change_note"),
    )
    from app.modules.audit.service import AuditService

    await AuditService(session, ctx, request).record(
        action="rule.update", resource_type="risk_rules", resource_id=str(rule.id),
        after={"version": rule.version_no}, detail=rule.code,
    )
    await session.commit()
    await session.refresh(rule)
    return rule_out(rule)


@router.get("/rules/{rule_id}/versions", response_model=list[dict])
async def rule_versions(
    rule_id: uuid.UUID,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("rules:manage")),
) -> list[dict]:
    rows = await RuleService(session, ctx).list_versions(rule_id)
    return [
        {
            "id": str(v.id),
            "version_no": v.version_no,
            "snapshot": v.snapshot,
            "changed_by": str(v.changed_by) if v.changed_by else None,
            "change_note": v.change_note,
            "created_at": v.created_at.isoformat(),
        }
        for v in rows
    ]


@router.delete("/rules/{rule_id}", response_model=dict)
async def delete_rule(
    rule_id: uuid.UUID,
    request: Request,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("rules:manage")),
) -> dict:
    service = RuleService(session, ctx)
    await service.soft_delete(rule_id)
    from app.modules.audit.service import AuditService

    await AuditService(session, ctx, request).record(
        action="rule.delete", resource_type="risk_rules", resource_id=str(rule_id)
    )
    await session.commit()
    return {"ok": True}


# ---------- 疑似问题 ----------

@router.get("/issues", response_model=dict)
async def list_issues(
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("issue:review")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    keyword: str = Query("", max_length=100),
    risk: str = Query(""),
    state: str = Query(""),
    issue_type: str = Query(""),
    date: str = Query(""),
    store_id: uuid.UUID | None = Query(None),
    employee_id: uuid.UUID | None = Query(None),
) -> dict:
    stmt = await _visible_issue_stmt(ctx)
    if store_id:
        stmt = stmt.where(Issue.store_id == store_id)
    if employee_id:
        stmt = stmt.where(Issue.employee_id == employee_id)
    if risk:
        stmt = stmt.where(Issue.risk == risk)
    if issue_type:
        stmt = stmt.where(Issue.issue_type == issue_type)
    if date:
        stmt = stmt.where(func.date(Issue.occurred_at) == date)
    if state:
        if state == "待复核":
            stmt = stmt.where(Issue.review_status == "PENDING")
        elif state == "已驳回":
            stmt = stmt.where(Issue.review_status == "DISMISSED")
        elif state == "申诉中":
            stmt = stmt.where(Issue.appeal_status == "APPEALING")
        elif state == "待整改":
            stmt = stmt.where(Issue.remediation_status.in_(["PENDING", "SUBMITTED"]))
        elif state == "已完成":
            stmt = stmt.where(
                or_(
                    Issue.close_status == "CLOSED",
                    Issue.remediation_status == "CONFIRMED",
                )
            )
    if keyword:
        like = f"%{keyword}%"
        emp_ids = (
            select(Employee.id).where(Employee.tenant_id == ctx.tenant_id, Employee.name.like(like)).scalar_subquery()
        )
        store_ids = (
            select(Store.id).where(Store.tenant_id == ctx.tenant_id, Store.name.like(like)).scalar_subquery()
        )
        stmt = stmt.where(
            or_(
                Issue.quote.like(like),
                Issue.issue_type.like(like),
                Issue.issue_no.like(like),
                Issue.employee_id.in_(emp_ids),
                Issue.store_id.in_(store_ids),
            )
        )
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (
        (
            await session.execute(
                stmt.order_by(Issue.occurred_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .scalars()
        .all()
    )
    items = [await _issue_out(session, i) for i in rows]
    return {"items": items, **page_meta(page, page_size, total)}


@router.get("/issues/{issue_id}", response_model=dict)
async def issue_detail(
    issue_id: uuid.UUID,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("issue:review")),
) -> dict:
    service = IssueWorkflow(session, ctx)
    issue = await service.get_issue_or_404(issue_id)
    DataScopeService(ctx).assert_visible(
        tenant_id=ctx.tenant_id, store_id=issue.store_id, employee_id=issue.employee_id
    )
    data = await _issue_out(session, issue)
    from app.models.issue import RiskSegment

    segments = (
        (
            await session.execute(
                select(RiskSegment)
                .where(
                    RiskSegment.tenant_id == ctx.tenant_id,
                    RiskSegment.conversation_id == issue.conversation_id,
                )
                .order_by(RiskSegment.start_ms)
            )
        )
        .scalars()
        .all()
    )
    data["segments"] = [
        {
            "id": str(s.id),
            "rule_code": s.rule_code,
            "rule_name": s.rule_name,
            "matched_text": s.matched_text,
            "matched_keywords": s.matched_keywords,
            "speaker": s.speaker,
            "start_ms": s.start_ms,
            "end_ms": s.end_ms,
            "status": s.status,
        }
        for s in segments
    ]
    data["review"] = {
        "reviewed_by": str(issue.reviewed_by) if issue.reviewed_by else None,
        "reviewed_at": issue.reviewed_at.isoformat() if issue.reviewed_at else None,
        "review_comment": issue.review_comment,
        "dismissed_reason": issue.dismissed_reason,
    }
    return data


@router.post("/issues/{issue_id}/review", response_model=dict)
async def review_issue(
    issue_id: uuid.UUID,
    body: dict,
    request: Request,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("issue:review")),
) -> dict:
    approve = bool(body.get("approve", False))
    service = IssueWorkflow(session, ctx)
    issue = await service.review(issue_id, approve=approve, comment=body.get("comment"))
    from app.modules.audit.service import AuditService

    await AuditService(session, ctx, request).record(
        action="issue.review", resource_type="issues", resource_id=str(issue_id),
        after={"approve": approve}, detail=f"{issue.issue_no} approve={approve}",
    )
    await session.commit()
    return {"ok": True, "review_status": issue.review_status}


@router.post("/issues/{issue_id}/close", response_model=dict)
async def close_issue(
    issue_id: uuid.UUID,
    body: dict,
    request: Request,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("issue:close")),
) -> dict:
    service = IssueWorkflow(session, ctx)
    issue = await service.close(issue_id, comment=body.get("comment"))
    from app.modules.audit.service import AuditService

    await AuditService(session, ctx, request).record(
        action="issue.close", resource_type="issues", resource_id=str(issue_id)
    )
    await session.commit()
    return {"ok": True, "close_status": issue.close_status}


@router.post("/issues/{issue_id}/push-rectify", response_model=dict, status_code=201)
async def push_rectify(
    issue_id: uuid.UUID,
    body: dict,
    request: Request,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("rectify:confirm")),
) -> dict:
    service = IssueWorkflow(session, ctx)
    rect = await service.push_rectify(issue_id, due_date=body.get("due_date"))
    from app.modules.audit.service import AuditService

    await AuditService(session, ctx, request).record(
        action="issue.push_rectify", resource_type="rectifications", resource_id=str(rect.id),
        detail=str(issue_id),
    )
    await session.commit()
    return {"ok": True, "rectify_task_id": str(rect.id), "status": rect.status}


# ---------- 分析执行 ----------

@router.post("/analysis/rerun", response_model=dict)
async def rerun_analysis(
    body: dict,
    request: Request,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("analysis:rerun")),
) -> dict:
    from app.models.recording import Conversation

    analyzer = RiskAnalyzer(session, ctx)
    conversation_id = body.get("conversation_id")
    if conversation_id:
        result = await analyzer.analyze_conversation(uuid.UUID(str(conversation_id)))
    else:
        conv_ids = (
            (
                await session.execute(
                    select(Conversation.id).where(
                        Conversation.tenant_id == ctx.tenant_id,
                        Conversation.status == "READY",
                    ).limit(200)
                )
            )
            .scalars()
            .all()
        )
        result = {"issues_created": 0, "segments_created": 0, "rules_matched": 0}
        for conv_id in conv_ids:
            r = await analyzer.analyze_conversation(conv_id)
            result["issues_created"] += r["issues_created"]
            result["segments_created"] += r["segments_created"]
            result["rules_matched"] += r["rules_matched"]
    from app.modules.audit.service import AuditService

    await AuditService(session, ctx, request).record(
        action="analysis.rerun", resource_type="issues", detail=str(result)
    )
    await session.commit()
    return {"ok": True, **result}
