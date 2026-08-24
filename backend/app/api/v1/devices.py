"""设备端点: 设备建档 / 动态绑定 / 解绑 / 历史 / 申请审批 / 知情同意."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select

from app.api.deps import CurrentUser, RequirePermission, SessionDep
from app.core.errors import AppError
from app.core.pagination import page_meta
from app.models.device import Device, DeviceBinding, DeviceBindingRequest
from app.models.org import Employee, RecordingConsent, Store
from app.modules.audit.service import AuditService
from app.modules.devices.service import DeviceService
from app.schemas.device import (
    BindingOut,
    BindingRequestOut,
    BindRequest,
    ConsentRequest,
    DeviceCreate,
    DeviceOut,
    UnbindRequest,
)
from app.services.security_context import TenantContext

router = APIRouter(tags=["devices"])


@router.get("/devices", response_model=dict)
async def list_devices(
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("device:read")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    keyword: str = Query("", max_length=64),
    status: str = Query(""),
) -> dict:
    stmt = select(Device).where(Device.tenant_id == ctx.tenant_id, Device.deleted_at.is_(None))
    if keyword:
        stmt = stmt.where(Device.device_code.like(f"%{keyword}%"))
    if status:
        stmt = stmt.where(Device.status == status)
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (
        (await session.execute(stmt.order_by(Device.created_at.desc()).offset((page - 1) * page_size).limit(page_size)))
        .scalars()
        .all()
    )
    # 当前生效绑定联查 (一次性取本页设备的 ACTIVE 绑定 + 员工/门店)
    device_ids = [d.id for d in rows]
    bindings: dict[uuid.UUID, DeviceBinding] = {}
    if device_ids:
        bindings = {
            b.device_id: b
            for b in (
            (
                await session.execute(
                    select(DeviceBinding)
                    .where(
                        DeviceBinding.tenant_id == ctx.tenant_id,
                        DeviceBinding.device_id.in_(device_ids),
                        DeviceBinding.binding_status == "ACTIVE",
                    )
                )
            )
                .scalars()
                .all()
            )
        }
    emp_ids = {b.employee_id for b in bindings.values()}
    store_ids = {b.store_id for b in bindings.values() if b.store_id}
    emp_stmt = select(Employee)
    if emp_ids:
        emp_stmt = emp_stmt.where(Employee.id.in_(emp_ids))
    emp_names = {e.id: e.name for e in (await session.execute(emp_stmt)).scalars().all()}
    store_stmt = select(Store)
    if store_ids:
        store_stmt = store_stmt.where(Store.id.in_(store_ids))
    store_names = {s.id: s.name for s in (await session.execute(store_stmt)).scalars().all()}
    items = []
    for d in rows:
        data = DeviceOut.model_validate(d).model_dump()
        b = bindings.get(d.id)
        data["bound"] = b is not None
        data["employee_id"] = str(b.employee_id) if b else None
        data["employee_name"] = emp_names.get(b.employee_id) if b else None
        data["store_id"] = str(b.store_id) if b and b.store_id else None
        data["store_name"] = store_names.get(b.store_id) if b and b.store_id else None
        items.append(data)
    return {"items": items, **page_meta(page, page_size, total)}


@router.get("/devices/summary", response_model=dict)
async def device_summary(
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("device:read")),
) -> dict:
    """设备运行汇总: 全部服务端计算, 前端不拉全量再聚合."""

    from sqlalchemy import func as safunc

    base = select(Device).where(Device.tenant_id == ctx.tenant_id, Device.deleted_at.is_(None))
    total = await session.scalar(safunc.count().select().select_from(base.subquery())) or 0
    online = (
        await session.scalar(
            safunc.count().select().select_from(base.where(Device.online_status == "ONLINE").subquery())
        )
        or 0
    )
    offline = (
        await session.scalar(
            safunc.count().select().select_from(base.where(Device.online_status == "OFFLINE").subquery())
        )
        or 0
    )
    bound = (
        await session.scalar(
            safunc.count()
            .select()
            .select_from(
                select(Device.id)
                .join(DeviceBinding, DeviceBinding.device_id == Device.id)
                .where(
                    Device.tenant_id == ctx.tenant_id,
                    DeviceBinding.tenant_id == ctx.tenant_id,
                    DeviceBinding.binding_status == "ACTIVE",
                )
                .distinct()
                .subquery()
            )
        )
        or 0
    )
    low_power = (
        await session.scalar(
            safunc.count().select().select_from(base.where(Device.battery_level <= 20).subquery())
        )
        or 0
    )
    return {
        "total": total,
        "online": online,
        "offline": offline,
        "bound": bound,
        "unbound": max(total - bound, 0),
        "low_power": low_power,
    }


@router.post("/devices", response_model=DeviceOut, status_code=201)
async def create_device(
    body: DeviceCreate,
    request: Request,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("device:manage")),
) -> Device:
    dup = await session.scalar(
        select(Device).where(Device.tenant_id == ctx.tenant_id, Device.device_code == body.device_code)
    )
    if dup is not None:
        raise AppError(400, "device_code_exists", "设备码已存在")
    device = Device(
        tenant_id=ctx.tenant_id,
        device_code=body.device_code,
        device_type=body.device_type,
        vendor=body.vendor,
        model=body.model,
    )
    session.add(device)
    await AuditService(session, ctx, request).record(
        action="device.create",
        resource_type="devices",
        resource_id=str(device.id),
        after={"device_code": body.device_code, "device_type": body.device_type},
        detail=body.device_code,
    )
    await session.commit()
    await session.refresh(device)
    return device


@router.post("/devices/bind", response_model=BindingOut, status_code=201)
async def bind_device(
    body: BindRequest,
    request: Request,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("binding:manage")),
) -> dict[str, Any]:
    service = DeviceService(session, ctx)
    binding = await service.bind(
        device_id=body.device_id,
        employee_id=body.employee_id,
        start_at=body.start_at,
        source="ADMIN",
    )
    await AuditService(session, ctx, request).record(
        action="binding.create",
        resource_type="device_bindings",
        resource_id=str(body.device_id),
        after={"device_id": str(body.device_id), "employee_id": str(body.employee_id)},
        detail=str(body.device_id),
    )
    await session.commit()
    await session.refresh(binding)
    return await _binding_out(session, binding)


@router.post("/devices/unbind", response_model=BindingOut)
async def unbind_device(
    body: UnbindRequest,
    request: Request,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("binding:manage")),
) -> dict[str, Any]:
    service = DeviceService(session, ctx)
    binding = await service.unbind(body.device_id, body.end_at)
    await AuditService(session, ctx, request).record(
        action="binding.end",
        resource_type="device_bindings",
        resource_id=str(body.device_id),
        after={"device_id": str(body.device_id)},
        detail=str(body.device_id),
    )
    await session.commit()
    await session.refresh(binding)
    return await _binding_out(session, binding)


@router.get("/devices/{device_id}/bindings", response_model=list[BindingOut])
async def binding_history(
    device_id: uuid.UUID,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("device:read")),
) -> list[dict[str, Any]]:
    service = DeviceService(session, ctx)
    rows = await service.history(device_id)
    return [await _binding_out(session, b) for b in rows]


@router.get("/bindings", response_model=dict)
async def list_bindings(
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("device:read")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    status: str = Query(""),
) -> dict:
    stmt = select(DeviceBinding).where(DeviceBinding.tenant_id == ctx.tenant_id)
    if status:
        stmt = stmt.where(DeviceBinding.binding_status == status)
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (
        (
            await session.execute(
                stmt.order_by(DeviceBinding.start_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .scalars()
        .all()
    )
    return {"items": [await _binding_out(session, b) for b in rows], **page_meta(page, page_size, total)}


@router.get("/binding-requests", response_model=dict)
async def list_binding_requests(
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("binding:approve")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    status: str = Query(""),
) -> dict:
    stmt = select(DeviceBindingRequest).where(DeviceBindingRequest.tenant_id == ctx.tenant_id)
    if status:
        stmt = stmt.where(DeviceBindingRequest.status == status)
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (
        (
            await session.execute(
                stmt.order_by(DeviceBindingRequest.requested_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .scalars()
        .all()
    )
    return {"items": [await _request_out(session, r) for r in rows], **page_meta(page, page_size, total)}


@router.post("/binding-requests/{request_id}/review", response_model=BindingRequestOut)
async def review_binding_request(
    request_id: uuid.UUID,
    body: dict,
    request: Request,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("binding:approve")),
) -> dict[str, Any]:
    approve = bool(body.get("approve", False))
    comment = body.get("comment")
    service = DeviceService(session, ctx)
    req, _binding = await service.review_request(request_id, approve=approve, comment=comment)
    await AuditService(session, ctx, request).record(
        action="binding_request.review", resource_type="device_binding_requests",
        detail=f"{str(request_id)} approve={approve}",
    )
    await session.commit()
    await session.refresh(req)
    return await _request_out(session, req)


@router.post("/consents", response_model=dict, status_code=201)
async def confirm_consent(
    body: ConsentRequest,
    request: Request,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("binding:manage")),
) -> dict:
    emp = await session.get(Employee, body.employee_id)
    if emp is None or str(emp.tenant_id) != str(ctx.tenant_id):
        raise AppError(404, "not_found", "员工不存在")
    existing = await session.scalar(
        select(RecordingConsent).where(
            RecordingConsent.tenant_id == ctx.tenant_id,
            RecordingConsent.employee_id == body.employee_id,
            RecordingConsent.policy_version == body.policy_version,
        )
    )
    if existing is not None:
        return {"ok": True, "already_confirmed": True}
    consent = RecordingConsent(
        tenant_id=ctx.tenant_id,
        employee_id=body.employee_id,
        policy_name=body.policy_name,
        policy_version=body.policy_version,
        content_hash=body.content_hash,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        device_info=body.device_info,
    )
    session.add(consent)
    await AuditService(session, ctx, request).record(
        action="consent.confirm", resource_type="recording_consents", detail=str(body.employee_id)
    )
    await session.commit()
    return {"ok": True, "already_confirmed": False}


async def _binding_out(session, binding: DeviceBinding) -> dict[str, Any]:
    device = await session.get(Device, binding.device_id)
    emp = await session.get(Employee, binding.employee_id)
    store = await session.get(Store, binding.store_id) if binding.store_id else None
    data = BindingOut.model_validate(binding).model_dump()
    data["device_code"] = device.device_code if device else None
    data["employee_name"] = emp.name if emp else None
    data["store_name"] = store.name if store else None
    return data


@router.get("/device-events", response_model=dict)
async def list_device_events(
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("device:read")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    event_type: str = Query(""),
) -> dict:
    """设备运行事件流: 来自审计日志 (设备建档/绑定/解绑), 服务端分页+筛选."""

    from app.models.audit import AuditLog

    stmt = select(AuditLog).where(
        AuditLog.tenant_id == ctx.tenant_id,
        AuditLog.resource_type.in_(["devices", "device_bindings"]),
    )
    if event_type:
        action_map = {"心跳": "heartbeat", "上传": "file.upload"}
        stmt = stmt.where(AuditLog.action == action_map.get(event_type, event_type))
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
    # 设备码 / 员工 / 门店 联查 (audit.resource_id = device_id 或 binding id)
    device_ids = [uuid.UUID(r.resource_id) for r in rows if r.resource_id]
    dev_stmt = select(Device)
    if device_ids:
        dev_stmt = dev_stmt.where(Device.id.in_(device_ids))
    devices = {d.id: d for d in (await session.execute(dev_stmt)).scalars().all()}
    emp_ids = {r.after_snapshot.get("employee_id") for r in rows if r.after_snapshot}
    emp_ids = {uuid.UUID(v) for v in emp_ids if v}
    emp_stmt = select(Employee)
    if emp_ids:
        emp_stmt = emp_stmt.where(Employee.id.in_(emp_ids))
    emp_names = {e.id: e.name for e in (await session.execute(emp_stmt)).scalars().all()}
    items = []
    for row in rows:
        action = row.action
        if action == "binding.create":
            event_type_v = "操控"
            content = "设备绑定员工"
        elif action == "binding.end":
            event_type_v = "操控"
            content = "设备解绑"
        else:
            event_type_v = "操控"
            content = row.detail or row.action
        device = devices.get(uuid.UUID(row.resource_id)) if row.resource_id else None
        emp_id = (row.after_snapshot or {}).get("employee_id")
        items.append(
            {
                "id": str(row.id),
                "occurred_at": row.created_at.isoformat(),
                "type": event_type_v,
                "content": content,
                "status": "成功",
                "device_code": device.device_code if device else None,
                "employee_name": emp_names.get(uuid.UUID(emp_id)) if emp_id else None,
                "actor_name": row.actor_name,
            }
        )
    return {"items": items, **page_meta(page, page_size, total)}


async def _request_out(session, req: DeviceBindingRequest) -> dict[str, Any]:
    device = await session.get(Device, req.device_id)
    emp = await session.get(Employee, req.employee_id)
    data = BindingRequestOut.model_validate(req).model_dump()
    data["device_code"] = device.device_code if device else None
    data["employee_name"] = emp.name if emp else None
    return data
