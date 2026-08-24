"""组织域模型: 组织树 / 门店 / 岗位 / 员工."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Date,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class OrganizationNode(UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin, Base):
    """通用组织树: 总部 → 区域 → 门店 (支持任意层级)."""

    __tablename__ = "organization_nodes"

    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("organization_nodes.id", ondelete="CASCADE"), nullable=True
    )
    node_type: Mapped[str] = mapped_column(String(32), nullable=False)  # HQ / REGION / STORE / GROUP
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ACTIVE")
    legacy_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    children: Mapped[list[OrganizationNode]] = relationship(
        back_populates="parent", lazy="selectin"
    )
    parent: Mapped[OrganizationNode | None] = relationship(
        back_populates="children", remote_side="OrganizationNode.id", lazy="selectin"
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_org_node_tenant_code"),
    )

    def descendant_ids(self, acc: set[uuid.UUID] | None = None) -> set[uuid.UUID]:
        acc = acc if acc is not None else set()
        acc.add(self.id)
        for child in self.children:
            child.descendant_ids(acc)
        return acc


class Store(UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin, Base):
    """门店档案 (组织树节点 + 门店详情)."""

    __tablename__ = "stores"

    node_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organization_nodes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    address: Mapped[str | None] = mapped_column(String(256), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ACTIVE")
    legacy_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_store_tenant_code"),
    )


class Position(UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "positions"

    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_position_tenant_code"),
    )


class Employee(UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "employees"

    employee_no: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    mobile: Mapped[str] = mapped_column(String(32), nullable=False)
    job_title: Mapped[str | None] = mapped_column(String(128), nullable=True)
    organization_node_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("organization_nodes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    store_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("stores.id", ondelete="SET NULL"), nullable=True, index=True
    )
    manager_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    employment_status: Mapped[str] = mapped_column(String(32), nullable=False, default="ACTIVE")  # ACTIVE/LEAVING/LEFT
    account_status: Mapped[str] = mapped_column(String(32), nullable=False, default="ACTIVE")  # ACTIVE/DISABLED
    joined_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    left_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    extra_meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    legacy_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "employee_no", name="uq_employee_tenant_no"),
        UniqueConstraint("tenant_id", "mobile", name="uq_employee_tenant_mobile"),
    )


class RecordingConsent(UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, Base):
    """录音知情同意: 员工首次激活设备绑定前必须确认."""

    __tablename__ = "recording_consents"

    employee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True
    )
    policy_name: Mapped[str] = mapped_column(String(128), nullable=False)
    policy_version: Mapped[str] = mapped_column(String(64), nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    confirmed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    device_info: Mapped[str | None] = mapped_column(String(256), nullable=True)

    __table_args__ = (
        UniqueConstraint("employee_id", "policy_version", name="uq_consent_employee_version"),
    )
