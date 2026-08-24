"""审计日志服务: 敏感操作统一留痕."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.services.security_context import TenantContext


class AuditService:
    def __init__(self, session: AsyncSession, ctx: TenantContext | None = None, request=None) -> None:
        self.session = session
        self.ctx = ctx
        self.request = request

    async def record(
        self,
        *,
        action: str,
        resource_type: str,
        resource_id: str | None = None,
        before: dict | None = None,
        after: dict | None = None,
        detail: str | None = None,
    ) -> None:
        tenant_id = self.ctx.tenant_id if self.ctx else None
        actor_id = self.ctx.user.id if self.ctx and self.ctx.user else None
        actor_name = self.ctx.user.display_name if self.ctx and self.ctx.user else None
        request_id = getattr(self.request.state, "request_id", None) if self.request else None
        ip = self.request.client.host if self.request and self.request.client else None
        ua = self.request.headers.get("user-agent") if self.request else None
        self.session.add(
            AuditLog(
                tenant_id=tenant_id,
                actor_id=actor_id,
                actor_name=actor_name,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                request_id=request_id,
                ip_address=ip,
                user_agent=ua,
                before_snapshot=before,
                after_snapshot=after,
                detail=detail,
            )
        )
