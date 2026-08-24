"""站内通知服务: 创建 (员工/管理端) / 列表 / 已读."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.auth import Role, User, user_roles
from app.models.notification import Notification
from app.services.security_context import TenantContext

logger = get_logger("yuqi.notify")


class NotificationService:
    def __init__(self, session: AsyncSession, ctx: TenantContext | None = None) -> None:
        self.session = session
        self.ctx = ctx

    async def create(
        self,
        *,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        title: str,
        body: str = "",
        notif_type: str = "GENERAL",
        ref_type: str | None = None,
        ref_id: str | None = None,
    ) -> Notification:
        n = Notification(
            tenant_id=tenant_id,
            user_id=user_id,
            title=title,
            body=body,
            notif_type=notif_type,
            ref_type=ref_type,
            ref_id=ref_id,
        )
        self.session.add(n)
        await self.session.flush()
        return n

    async def create_for_role(
        self,
        *,
        tenant_id: uuid.UUID,
        role_codes: list[str],
        title: str,
        body: str = "",
        notif_type: str = "GENERAL",
        ref_type: str | None = None,
        ref_id: str | None = None,
    ) -> int:
        """向租户内指定角色的全部用户发送通知 (整改提交/申诉 → 管理端)."""
        stmt = (
            select(User)
            .join(user_roles, user_roles.c.user_id == User.id)
            .join(Role, Role.id == user_roles.c.role_id)
            .where(
                User.tenant_id == tenant_id,
                User.status == "ACTIVE",
                User.deleted_at.is_(None),
                Role.code.in_(role_codes),
            )
        )
        users = (await self.session.execute(stmt)).scalars().all()
        for user in users:
            await self.create(
                tenant_id=tenant_id,
                user_id=user.id,
                title=title,
                body=body,
                notif_type=notif_type,
                ref_type=ref_type,
                ref_id=ref_id,
            )
        return len(users)

    async def list_for_user(
        self, user_id: uuid.UUID, *, page: int, page_size: int, unread_only: bool
    ) -> tuple[list[Notification], int]:
        if self.ctx is None:
            raise RuntimeError("缺少租户上下文")
        stmt = select(Notification).where(
            Notification.tenant_id == self.ctx.tenant_id,
            Notification.user_id == user_id,
        )
        if unread_only:
            stmt = stmt.where(Notification.read_at.is_(None))
        total = await self.session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        rows = (
            (
                await self.session.execute(
                    stmt.order_by(Notification.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
                )
            )
            .scalars()
            .all()
        )
        return list(rows), total

    async def unread_count(self, user_id: uuid.UUID) -> int:
        if self.ctx is None:
            return 0
        return (
            await self.session.scalar(
                select(func.count())
                .select_from(Notification)
                .where(
                    Notification.tenant_id == self.ctx.tenant_id,
                    Notification.user_id == user_id,
                    Notification.read_at.is_(None),
                )
            )
            or 0
        )

    async def mark_read(self, user_id: uuid.UUID, notif_id: uuid.UUID | None = None) -> int:
        """标记单条或全部已读, 返回条数."""
        if self.ctx is None:
            raise RuntimeError("缺少租户上下文")
        stmt = select(Notification).where(
            Notification.tenant_id == self.ctx.tenant_id,
            Notification.user_id == user_id,
        )
        if notif_id is not None:
            stmt = stmt.where(Notification.id == notif_id)
        rows = (await self.session.execute(stmt)).scalars().all()
        now = datetime.now(UTC)
        for row in rows:
            if row.read_at is None:
                row.read_at = now
        await self.session.flush()
        return len(rows)
