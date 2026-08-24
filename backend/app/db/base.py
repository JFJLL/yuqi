"""SQLAlchemy Declarative Base 与通用 Mixin."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def gen_uuid() -> uuid.UUID:
    return uuid.uuid4()


class UUIDPrimaryKeyMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=gen_uuid
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    deleted_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, nullable=True, default=None
    )


class TenantMixin:
    """所有核心业务表必须带 tenant_id, 联合索引以 tenant_id 开头."""

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )


def utcnow() -> datetime:
    return datetime.now(UTC)
