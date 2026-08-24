"""接入/转写域模型: 音频文件 / 会话 / 文本版本 / 转写片段 / 处理任务.

分层说明 (对应 DATA_MIGRATION 表映射):
- audio_files         物理录音文件 (对象存储登记 + 元数据)
- conversations       一次接待会话 (转写结果聚合: 摘要/全文/标记/别名)
- transcript_segments 当前版本转写片段 (按 version_no 版本化, 可重建任意版本)
- text_versions       文本版本快照 (每次人工编辑/ASR 完成生成一个新版本)
- processing_jobs     ASR/合并/同步等异步任务
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.org import Employee, Store

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class AudioFile(UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin, Base):
    """物理录音文件登记 (对象存储)."""

    __tablename__ = "audio_files"

    file_name: Mapped[str] = mapped_column(String(256), nullable=False)
    object_key: Mapped[str] = mapped_column(String(512), nullable=False)
    storage_provider: Mapped[str] = mapped_column(String(32), nullable=False, default="local")
    content_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    language: Mapped[str] = mapped_column(String(16), nullable=False, default="zh-CN")
    device_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    employee_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True
    )
    store_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("stores.id", ondelete="SET NULL"), nullable=True, index=True
    )
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # manual / oss_auto
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="manual")
    hotwords: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # PENDING / PROCESSING / SUCCEEDED / FAILED / ARCHIVED
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="PENDING")
    qc_result: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True
    )
    legacy_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    employee: Mapped[Employee | None] = relationship(lazy="selectin")
    store: Mapped[Store | None] = relationship(lazy="selectin")

    __table_args__ = (
        Index("ix_audio_tenant_occurred", "tenant_id", "occurred_at"),
        Index("ix_audio_tenant_status", "tenant_id", "status"),
    )


class Conversation(UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin, Base):
    """一次接待会话: 转写结果聚合 (管理端"转写记录"的主对象)."""

    __tablename__ = "conversations"

    audio_file_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("audio_files.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    store_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("stores.id", ondelete="SET NULL"), nullable=True, index=True
    )
    employee_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True
    )
    device_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    full_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    qc_result: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    # TRANSCRIBING / READY / REVIEWED
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="TRANSCRIBING")
    speaker_aliases: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    marks_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    current_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    legacy_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    audio_file: Mapped[AudioFile] = relationship(
        lazy="selectin", foreign_keys=[audio_file_id]
    )
    employee: Mapped[Employee | None] = relationship(lazy="selectin")
    store: Mapped[Store | None] = relationship(lazy="selectin")

    __table_args__ = (
        Index("ix_conv_tenant_occurred", "tenant_id", "started_at"),
    )


class TranscriptSegment(UUIDPrimaryKeyMixin, TenantMixin, Base):
    """转写片段 (按版本号组织, 重建任意文本版本)."""

    __tablename__ = "transcript_segments"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    segment_no: Mapped[int] = mapped_column(Integer, nullable=False)
    speaker: Mapped[str] = mapped_column(String(64), nullable=False, default="unknown")
    start_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False, default="")

    __table_args__ = (
        Index("ix_seg_conv_version", "tenant_id", "conversation_id", "version_no", "segment_no"),
    )


class TextVersion(UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, Base):
    """文本版本快照: ASR 完成或人工编辑时追加, 支持历史回溯."""

    __tablename__ = "text_versions"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    full_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    segments_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    marks_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    speaker_aliases: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    edited_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    edit_reason: Mapped[str | None] = mapped_column(String(256), nullable=True)
    # ASR / MANUAL_EDIT / LEGACY_IMPORT
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="ASR")

    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "conversation_id", "version_no", name="uq_text_version_conv_no"
        ),
    )


class ProcessingJob(UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, Base):
    """异步处理任务: ASR 转写 / 录音合并 / 文本转发 / 对账."""

    __tablename__ = "processing_jobs"

    # ASR / MERGE / SYNC / RECONCILE
    job_type: Mapped[str] = mapped_column(String(32), nullable=False, default="ASR")
    audio_file_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("audio_files.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")  # queued/running/succeeded/failed
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    remote_job_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_polled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    result_imported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    audio_file: Mapped[AudioFile | None] = relationship(lazy="selectin")

    __table_args__ = (
        Index("ix_job_tenant_status", "tenant_id", "status"),
    )
