"""设备域模型: 设备档案 / 动态绑定历史 / 绑定申请.

约束: 同一 tenant + device 同一时刻只能存在一个 ACTIVE 绑定。
- 数据库层: PostgreSQL 部分唯一索引 (见 Alembic 迁移 0002)
- 应用层: BindingService 显式校验并返回冲突错误 (SQLite 测试环境同样生效)
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.org import Employee

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Device(UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "devices"

    device_code: Mapped[str] = mapped_column(String(64), nullable=False)
    device_type: Mapped[str] = mapped_column(String(32), nullable=False, default="BADGE")  # BADGE/OTHER
    vendor: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ACTIVE")  # ACTIVE/DISABLED
    online_status: Mapped[str] = mapped_column(String(32), nullable=False, default="OFFLINE")  # ONLINE/OFFLINE
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    battery_level: Mapped[int | None] = mapped_column(nullable=True)
    firmware_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    extra_meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    legacy_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "device_code", name="uq_device_tenant_code"),
    )


class DeviceBinding(UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, Base):
    """设备绑定历史 (不可覆盖, 只追加)."""

    __tablename__ = "device_bindings"

    device_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    store_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("stores.id", ondelete="SET NULL"), nullable=True
    )
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    binding_status: Mapped[str] = mapped_column(String(32), nullable=False, default="ACTIVE")  # ACTIVE/ENDED
    # VENDOR/ADMIN/EMPLOYEE_REQUEST/LEGACY_IMPORT
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="ADMIN")
    approved_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    legacy_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    device: Mapped[Device] = relationship(lazy="selectin")
    employee: Mapped[Employee] = relationship(lazy="selectin")

    # 联合索引以 tenant_id 开头; PG 部分唯一索引 (binding_status='ACTIVE') 在迁移 0002 中创建
    __table_args__ = (
        Index("ix_binding_tenant_device", "tenant_id", "device_id"),
    )


class DeviceBindingRequest(UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, Base):
    """员工发起的绑定申请 (需店长/管理员审批)."""

    __tablename__ = "device_binding_requests"

    device_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="PENDING")  # PENDING/APPROVED/REJECTED
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_comment: Mapped[str | None] = mapped_column(String(512), nullable=True)
