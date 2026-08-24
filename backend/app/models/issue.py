"""风险分析域模型: 规则库(版本化) / 风险片段 / 疑似问题(多状态) / 整改任务.

对应 DATA_MIGRATION 映射:
- compliance_rules → risk_rules (rule_set 默认) + risk_rule_versions (版本表)
- inspection_issues → issues (source=LEGACY_IMPORT) + risk_segments
- rectify_tasks → rectifications
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class RiskRule(UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin, Base):
    """合规风险规则 (按租户隔离, code 唯一, 修改生成新版本)."""

    __tablename__ = "risk_rules"

    rule_set: Mapped[str] = mapped_column(String(32), nullable=False, default="DEFAULT")
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # 夸大疗效表达 / 处方药提醒缺失 / 联合用药风险 / 基础疾病询问缺失 / 服务态度问题 / general
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="general")
    severity: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")  # high/medium/low
    keywords: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    version_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    effective_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    legacy_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_risk_rule_tenant_code"),)


class RiskRuleVersion(UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, Base):
    """规则版本快照 (每次修改追加)."""

    __tablename__ = "risk_rule_versions"

    rule_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("risk_rules.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    changed_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    change_note: Mapped[str | None] = mapped_column(String(256), nullable=True)

    __table_args__ = (UniqueConstraint("tenant_id", "rule_id", "version_no", name="uq_rule_version_tenant"),)


class RiskSegment(UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, Base):
    """风险片段: 命中规则的转写句段."""

    __tablename__ = "risk_segments"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    audio_file_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("audio_files.id", ondelete="SET NULL"), nullable=True
    )
    rule_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("risk_rules.id", ondelete="SET NULL"), nullable=True
    )
    issue_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("issues.id", ondelete="SET NULL"), nullable=True
    )
    rule_code: Mapped[str] = mapped_column(String(64), nullable=False)
    rule_name: Mapped[str] = mapped_column(String(128), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")
    matched_text: Mapped[str] = mapped_column(Text, nullable=False)
    matched_keywords: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    speaker: Mapped[str] = mapped_column(String(64), nullable=False, default="unknown")
    start_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="PENDING")  # PENDING/ACCEPTED/DISMISSED

    __table_args__ = (Index("ix_risk_seg_conv", "tenant_id", "conversation_id"),)


class Issue(UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin, Base):
    """疑似问题: 多状态模型 (人工复核 / 员工可见 / 申诉 / 整改 / 关闭)."""

    __tablename__ = "issues"

    issue_no: Mapped[str] = mapped_column(String(64), nullable=False)
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    audio_file_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("audio_files.id", ondelete="SET NULL"), nullable=True, index=True
    )
    employee_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True
    )
    store_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("stores.id", ondelete="SET NULL"), nullable=True, index=True
    )
    issue_type: Mapped[str] = mapped_column(String(64), nullable=False)
    risk: Mapped[str] = mapped_column(String(16), nullable=False, default="中")  # 高/中/低
    quote: Mapped[str] = mapped_column(Text, nullable=False)
    advice: Mapped[str] = mapped_column(Text, nullable=False, default="")
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="ANALYZER")  # ANALYZER/LEGACY_IMPORT/MANUAL
    legacy_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    legacy_state: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # 多状态 (DATA_MIGRATION 展开)
    # review: PENDING/APPROVED/DISMISSED; employee_view: UNSEEN/SEEN/ACKNOWLEDGED
    review_status: Mapped[str] = mapped_column(String(32), nullable=False, default="PENDING")
    employee_view_status: Mapped[str] = mapped_column(String(32), nullable=False, default="UNSEEN")
    # appeal: NONE/APPEALING/APPEAL_APPROVED/APPEAL_REJECTED
    appeal_status: Mapped[str] = mapped_column(String(32), nullable=False, default="NONE")
    # remediation: NONE/PENDING/SUBMITTED/CONFIRMED/REJECTED
    remediation_status: Mapped[str] = mapped_column(String(32), nullable=False, default="NONE")
    # close: OPEN/CLOSED
    close_status: Mapped[str] = mapped_column(String(32), nullable=False, default="OPEN")

    # 复核
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_comment: Mapped[str | None] = mapped_column(String(512), nullable=True)
    dismissed_reason: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # 整改
    rectify_task_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("rectifications.id", ondelete="SET NULL"), nullable=True
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    submit_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    confirmed_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # 申诉
    appeal_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    appeal_reviewed_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    appeal_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    appeal_review_comment: Mapped[str | None] = mapped_column(String(512), nullable=True)

    occurred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    employee: Mapped[object | None] = relationship("Employee", lazy="selectin")
    store: Mapped[object | None] = relationship("Store", lazy="selectin")
    segments: Mapped[list[RiskSegment]] = relationship(lazy="selectin", foreign_keys=[RiskSegment.issue_id])

    __table_args__ = (
        Index("ix_issue_tenant_occurred", "tenant_id", "occurred_at"),
        Index("ix_issue_tenant_review", "tenant_id", "review_status"),
        Index("ix_issue_tenant_store", "tenant_id", "store_id"),
    )


class Rectification(UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin, Base):
    """整改任务 (员工端提交 → 管理端确认)."""

    __tablename__ = "rectifications"

    issue_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("issues.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True
    )
    store_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("stores.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    # PENDING/SUBMITTED/CONFIRMED/REJECTED
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="PENDING")
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    submit_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    confirmed_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    escalated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    escalation_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    legacy_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    issue: Mapped[Issue] = relationship(lazy="selectin", foreign_keys=[issue_id])
