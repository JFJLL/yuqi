"""批量导入模型: 批次 + 行级结果 (部分成功/失败行下载/幂等)."""

from __future__ import annotations

import uuid

from sqlalchemy import JSON, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class ImportBatch(UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "import_batches"

    import_type: Mapped[str] = mapped_column(String(32), nullable=False)  # EMPLOYEE/DEVICE/ORGANIZATION
    file_name: Mapped[str] = mapped_column(String(256), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="PROCESSING"
    )  # PROCESSING/SUCCEEDED/PARTIAL/FAILED
    total_rows: Mapped[int] = mapped_column(default=0, nullable=False)
    success_rows: Mapped[int] = mapped_column(default=0, nullable=False)
    failed_rows: Mapped[int] = mapped_column(default=0, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    error_summary: Mapped[str | None] = mapped_column(String(1024), nullable=True)


class ImportItem(UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, Base):
    __tablename__ = "import_items"

    batch_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("import_batches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    row_no: Mapped[int] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)  # SUCCESS/FAILED
    raw_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    # 幂等键: 员工号/设备码等, 重复导入返回已有结果
    legacy_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    target_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
