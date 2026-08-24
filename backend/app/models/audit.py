"""审计日志模型: 播放/下载/导出/修改/删除等敏感操作全量留痕."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Index, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin


class AuditLog(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "audit_logs"

    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    actor_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    resource_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    before_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    after_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )

    __table_args__ = (
        # 联合索引以 tenant_id 开头
        Index("ix_audit_tenant_action", "tenant_id", "action"),
        Index("ix_audit_tenant_resource", "tenant_id", "resource_type", "resource_id"),
    )
