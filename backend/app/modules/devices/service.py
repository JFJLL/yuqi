"""设备绑定服务: 动态绑定/解绑/申请审批/冲突校验/历史/知情同意."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.models.device import Device, DeviceBinding, DeviceBindingRequest
from app.models.org import Employee, RecordingConsent
from app.services.security_context import TenantContext


class DeviceService:
    def __init__(self, session: AsyncSession, ctx: TenantContext) -> None:
        self.session = session
        self.ctx = ctx

    async def get_device_or_404(self, device_id: uuid.UUID) -> Device:
        device = await self.session.get(Device, device_id)
        if device is None or str(device.tenant_id) != str(self.ctx.tenant_id) or device.deleted_at is not None:
            raise AppError(404, "not_found", "设备不存在")
        return device

    async def _active_binding(self, device_id: uuid.UUID) -> DeviceBinding | None:
        return await self.session.scalar(
            select(DeviceBinding).where(
                DeviceBinding.tenant_id == self.ctx.tenant_id,
                DeviceBinding.device_id == device_id,
                DeviceBinding.binding_status == "ACTIVE",
            )
        )

    async def has_consent(self, employee_id: uuid.UUID, policy_version: str | None = None) -> bool:
        stmt = select(RecordingConsent).where(
            RecordingConsent.tenant_id == self.ctx.tenant_id,
            RecordingConsent.employee_id == employee_id,
        )
        if policy_version:
            stmt = stmt.where(RecordingConsent.policy_version == policy_version)
        return (await self.session.scalar(stmt)) is not None

    async def bind(
        self,
        *,
        device_id: uuid.UUID,
        employee_id: uuid.UUID,
        start_at: datetime | None = None,
        source: str = "ADMIN",
        require_consent: bool = False,
    ) -> DeviceBinding:
        device = await self.get_device_or_404(device_id)
        if device.status != "ACTIVE":
            raise AppError(400, "device_disabled", "设备已停用, 不能绑定")
        emp = await self.session.get(Employee, employee_id)
        if emp is None or str(emp.tenant_id) != str(self.ctx.tenant_id) or emp.deleted_at is not None:
            raise AppError(404, "not_found", "员工不存在")
        if emp.employment_status != "ACTIVE" or emp.account_status != "ACTIVE":
            raise AppError(400, "employee_inactive", "员工已停职或离职, 不能绑定")

        if require_consent and not await self.has_consent(employee_id):
            raise AppError(400, "consent_required", "员工尚未确认录音知情同意, 不能激活绑定")

        # 应用层冲突校验 (SQLite 测试环境也生效; PG 另有部分唯一索引兜底)
        active = await self._active_binding(device_id)
        if active is not None:
            raise AppError(
                409,
                "binding_conflict",
                f"该设备当前已有生效绑定 (绑定 ID {active.id}), 请先解绑",
            )

        binding = DeviceBinding(
            tenant_id=self.ctx.tenant_id,
            device_id=device_id,
            employee_id=employee_id,
            store_id=emp.store_id,
            start_at=start_at or datetime.now(UTC),
            binding_status="ACTIVE",
            source=source,
            created_by=self.ctx.user.id if self.ctx.user else None,
            approved_by=self.ctx.user.id if self.ctx.user else None,
        )
        self.session.add(binding)
        return binding

    async def unbind(self, device_id: uuid.UUID, end_at: datetime | None = None) -> DeviceBinding:
        active = await self._active_binding(device_id)
        if active is None:
            raise AppError(400, "no_active_binding", "该设备当前没有生效绑定")
        active.end_at = end_at or datetime.now(UTC)
        active.binding_status = "ENDED"
        self.session.add(active)
        return active

    async def history(self, device_id: uuid.UUID, limit: int = 50) -> list[DeviceBinding]:
        rows = (
            (
                await self.session.execute(
                    select(DeviceBinding)
                    .where(
                        DeviceBinding.tenant_id == self.ctx.tenant_id,
                        DeviceBinding.device_id == device_id,
                    )
                    .order_by(DeviceBinding.start_at.desc())
                    .limit(limit)
                )
            )
            .scalars()
            .all()
        )
        return list(rows)

    async def create_request(self, device_id: uuid.UUID, employee_id: uuid.UUID) -> DeviceBindingRequest:
        await self.get_device_or_404(device_id)
        if await self._active_binding(device_id) is not None:
            raise AppError(409, "binding_conflict", "该设备已有生效绑定")
        req = DeviceBindingRequest(
            tenant_id=self.ctx.tenant_id,
            device_id=device_id,
            employee_id=employee_id,
            status="PENDING",
        )
        self.session.add(req)
        return req

    async def review_request(
        self, request_id: uuid.UUID, *, approve: bool, comment: str | None
    ) -> tuple[DeviceBindingRequest, DeviceBinding | None]:
        req = await self.session.get(DeviceBindingRequest, request_id)
        if req is None or str(req.tenant_id) != str(self.ctx.tenant_id):
            raise AppError(404, "not_found", "绑定申请不存在")
        if req.status != "PENDING":
            raise AppError(400, "already_reviewed", "该申请已处理")
        req.status = "APPROVED" if approve else "REJECTED"
        req.reviewed_by = self.ctx.user.id if self.ctx.user else None
        req.reviewed_at = datetime.now(UTC)
        req.review_comment = comment
        binding = None
        if approve:
            binding = await self.bind(
                device_id=req.device_id,
                employee_id=req.employee_id,
                source="EMPLOYEE_REQUEST",
                require_consent=True,
            )
        self.session.add(req)
        return req, binding
