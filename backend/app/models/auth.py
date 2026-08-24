"""认证与权限模型: 租户/用户/角色/权限/数据范围/会话/登录日志.

约定:
- UUID 主键, 时间统一 UTC
- 业务表带 tenant_id; 联合索引以 tenant_id 开头
- 需要软删除的表带 deleted_at / deleted_by
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    String,
    Table,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Tenant(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tenants"

    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ACTIVE")  # ACTIVE/DISABLED
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    retention_days_audio: Mapped[int] = mapped_column(nullable=False, default=30)
    retention_days_evidence_audio: Mapped[int] = mapped_column(nullable=False, default=180)
    retention_days_transcript: Mapped[int] = mapped_column(nullable=False, default=365)

    users: Mapped[list[User]] = relationship(back_populates="tenant")


class Permission(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "permissions"

    code: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


# 关联表需在 Role/User 之前定义 (relationship secondary 引用)
role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Uuid, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", Uuid, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)

user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", Uuid, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)


class Role(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "roles"

    # None = 平台内置角色模板 (复制给租户)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_builtin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    permissions: Mapped[list[Permission]] = relationship(
        secondary=role_permissions, lazy="selectin"
    )
    data_scopes: Mapped[list[RoleDataScope]] = relationship(
        back_populates="role", lazy="selectin"
    )

    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_roles_tenant_code"),)


class RoleDataScope(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """角色数据范围: 全部组织 / 指定组织及子级 / 本门店 / 仅本人."""

    __tablename__ = "role_data_scopes"

    # None = 平台角色模板自带范围定义
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scope_type: Mapped[str] = mapped_column(String(32), nullable=False)  # ALL / ORG_TREE / STORE / SELF
    org_node_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    store_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)

    role: Mapped[Role] = relationship(back_populates="data_scopes")

    __table_args__ = (UniqueConstraint("role_id", "scope_type", name="uq_role_data_scope"),)


class User(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "users"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    username: Mapped[str] = mapped_column(String(64), nullable=False)
    mobile: Mapped[str | None] = mapped_column(String(32), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ACTIVE")  # ACTIVE/DISABLED
    is_super_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    employee_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)  # 员工档案 (阶段二)
    # 改密/停用/退出后自增, 使旧 Access Token 立即失效
    token_version: Mapped[int] = mapped_column(default=0, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    tenant: Mapped[Tenant] = relationship(back_populates="users")
    roles: Mapped[list[Role]] = relationship(secondary=user_roles, lazy="selectin")

    __table_args__ = (
        UniqueConstraint("tenant_id", "username", name="uq_users_tenant_username"),
        UniqueConstraint("tenant_id", "mobile", name="uq_users_tenant_mobile"),
    )


class UserSession(UUIDPrimaryKeyMixin, Base):
    """Refresh Token 会话: 可撤销、可轮换; 仅存 token 哈希."""

    __tablename__ = "user_sessions"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    refresh_token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    replaced_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)  # 轮换链
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class LoginLog(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "login_logs"

    tenant_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    username: Mapped[str] = mapped_column(String(64), nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    reason: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


def utc_now() -> datetime:
    return datetime.now(UTC)
