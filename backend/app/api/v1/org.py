"""组织与员工端点: 组织树 / 员工列表(服务端分页+脱敏) / 建档."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select

from app.api.deps import CurrentUser, RequirePermission, SessionDep
from app.core.errors import AppError
from app.core.pagination import page_meta
from app.models.org import Employee, OrganizationNode, Store
from app.modules.audit.service import AuditService
from app.modules.org.service import OrgService
from app.schemas.org import (
    EmployeeCreate,
    EmployeeOut,
    OrgNodeCreate,
    OrgNodeTreeItem,
    StoreOut,
    mask_mobile,
)
from app.services.security_context import TenantContext

router = APIRouter(tags=["org"])


@router.get("/org/tree", response_model=list[OrgNodeTreeItem])
async def org_tree(
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("org:read")),
) -> list[dict]:
    return await OrgService(session, ctx).build_tree()


@router.post("/org/nodes", response_model=OrgNodeTreeItem, status_code=201)
async def create_org_node(
    body: OrgNodeCreate,
    request: Request,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("org:manage")),
) -> OrganizationNode:
    dup = await session.scalar(
        select(OrganizationNode).where(
            OrganizationNode.tenant_id == ctx.tenant_id, OrganizationNode.code == body.code
        )
    )
    if dup is not None:
        raise AppError(400, "org_code_exists", "组织编码已存在")
    node = OrganizationNode(
        tenant_id=ctx.tenant_id,
        parent_id=body.parent_id,
        node_type=body.node_type,
        name=body.name,
        code=body.code,
        sort_order=body.sort_order,
    )
    session.add(node)
    await AuditService(session, ctx, request).record(
        action="org.create", resource_type="organization_nodes", detail=body.name
    )
    await session.commit()
    await session.refresh(node)
    return node


@router.get("/stores", response_model=dict)
async def list_stores(
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("org:read")),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=200),
    keyword: str = Query("", max_length=64),
) -> dict:
    from sqlalchemy import func

    stmt = select(Store).where(Store.tenant_id == ctx.tenant_id, Store.deleted_at.is_(None))
    if keyword:
        stmt = stmt.where(Store.name.like(f"%{keyword}%"))
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (
        (await session.execute(stmt.order_by(Store.created_at.desc()).limit(page_size).offset((page - 1) * page_size)))
        .scalars()
        .all()
    )
    return {"items": [StoreOut.model_validate(s) for s in rows], **page_meta(page, page_size, total)}


@router.get("/employees", response_model=dict)
async def list_employees(
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("employee:read")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    keyword: str = Query("", max_length=64),
    store_id: uuid.UUID | None = Query(None),
    region_id: uuid.UUID | None = Query(None),
    job_title: str = Query(""),
    status: str = Query(""),
) -> dict:
    service = OrgService(session, ctx)
    rows, total = await service.list_employees(
        page=page,
        page_size=page_size,
        keyword=keyword,
        store_id=store_id,
        region_id=region_id,
        job_title=job_title,
        status=status,
    )
    store_names = {
        s.id: s.name
        for s in (
            (
                await session.execute(
                    select(Store).where(
                        Store.tenant_id == ctx.tenant_id,
                        Store.id.in_({r.store_id for r in rows if r.store_id}),
                    )
                )
            )
            .scalars()
            .all()
        )
    }
    items = [
        {
            **EmployeeOut.model_validate(e).model_dump(),
            "mobile_masked": mask_mobile(e.mobile),
            "mobile": None,  # 列表默认不返回完整手机号
            "store_name": store_names.get(e.store_id) if e.store_id else None,
        }
        for e in rows
    ]
    return {"items": items, **page_meta(page, page_size, total)}


@router.post("/employees", response_model=EmployeeOut, status_code=201)
async def create_employee(
    body: EmployeeCreate,
    request: Request,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("employee:manage")),
) -> Employee:
    service = OrgService(session, ctx)
    dup = await session.scalar(
        select(Employee).where(
            Employee.tenant_id == ctx.tenant_id,
            (Employee.employee_no == body.employee_no) | (Employee.mobile == body.mobile),
        )
    )
    if dup is not None:
        raise AppError(400, "employee_exists", "员工号或手机号已存在")
    if body.store_id:
        await service.get_store_or_404(body.store_id)
    emp = Employee(
        tenant_id=ctx.tenant_id,
        employee_no=body.employee_no,
        name=body.name,
        mobile=body.mobile,
        job_title=body.job_title,
        organization_node_id=body.organization_node_id,
        store_id=body.store_id,
        manager_id=body.manager_id,
        joined_at=body.joined_at,
    )
    session.add(emp)
    await AuditService(session, ctx, request).record(
        action="employee.create", resource_type="employees", detail=body.employee_no
    )
    await session.commit()
    await session.refresh(emp)
    return emp
