"""认证服务: 登录/限流/Refresh 轮换/退出/改密/重置."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import AppError
from app.core.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)
from app.models.auth import LoginLog, Role, Tenant, User, UserSession, user_roles
from app.services.security_context import TenantContext


def _as_utc(dt: datetime) -> datetime:
    """SQLite 返回 naive datetime, PostgreSQL 返回 aware; 统一按 UTC 比较."""

    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


class AuthService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.settings = settings

    async def _load_roles(self, user: User) -> list[Role]:
        result = await self.session.execute(
            select(Role)
            .join(user_roles, user_roles.c.role_id == Role.id)
            .where(user_roles.c.user_id == user.id)
        )
        return list(result.scalars().all())

    async def _build_context(self, user: User) -> TenantContext:
        roles = await self._load_roles(user)
        permissions: set[str] = set()
        data_scope_types: list[str] = []
        org_node_ids: set[uuid.UUID] = set()
        store_ids: set[uuid.UUID] = set()
        for role in roles:
            for perm in role.permissions:
                permissions.add(perm.code)
            for scope in role.data_scopes:
                data_scope_types.append(scope.scope_type)
                if scope.org_node_id:
                    org_node_ids.add(scope.org_node_id)
                if scope.store_id:
                    store_ids.add(scope.store_id)
        if user.is_super_admin:
            from app.modules.rbac.bootstrap import PERMISSIONS

            permissions = set(PERMISSIONS.keys())
            data_scope_types = ["ALL"]
        return TenantContext(
            user=user,
            tenant_id=user.tenant_id,
            is_super_admin=user.is_super_admin,
            roles=roles,
            permissions=permissions,
            data_scope_types=data_scope_types,
            org_node_ids=org_node_ids,
            store_ids=store_ids,
            employee_id=user.employee_id,
        )

    # ---- 登录 ----
    async def login(
        self, *, username: str, password: str, ip: str | None, user_agent: str | None
    ) -> tuple[TenantContext, str, str]:
        await self._check_rate_limit(username, ip)
        user = await self._find_user_by_username_or_mobile(username)
        if user is None or not verify_password(password, user.password_hash):
            await self._record_login(username, False, ip, user_agent, "bad_credentials")
            await self.session.commit()  # 失败日志落库, 限流才生效
            raise AppError(401, "bad_credentials", "账号或密码错误")
        if user.status != "ACTIVE":
            await self._record_login(username, False, ip, user_agent, "user_disabled")
            await self.session.commit()
            raise AppError(403, "user_disabled", "账号已停用")
        tenant = await self.session.get(Tenant, user.tenant_id)
        if tenant is None or tenant.status != "ACTIVE":
            raise AppError(403, "tenant_disabled", "租户不可用")
        user.tenant = tenant  # 填充关系, 避免异步懒加载

        user.last_login_at = datetime.now(UTC)
        self.session.add(user)
        access_token = create_access_token(
            str(user.id), str(user.tenant_id), self.settings, user.token_version
        )
        refresh_token = await self._create_session(user, ip, user_agent)
        await self._record_login(username, True, ip, user_agent, None)
        await self.session.commit()
        ctx = await self._build_context(user)
        return ctx, access_token, refresh_token

    async def _check_rate_limit(self, username: str, ip: str | None) -> None:
        since = datetime.now(UTC) - timedelta(minutes=self.settings.login_lock_minutes)
        stmt = (
            select(func.count())
            .select_from(LoginLog)
            .where(LoginLog.username == username, LoginLog.success.is_(False), LoginLog.created_at >= since)
        )
        fails = await self.session.scalar(stmt) or 0
        if fails >= self.settings.login_max_failures:
            raise AppError(
                429, "login_locked",
                f"登录失败次数过多, 请在 {self.settings.login_lock_minutes} 分钟后再试",
            )

    async def _find_user_by_username_or_mobile(self, username: str) -> User | None:
        stmt = select(User).where(
            (User.username == username) | (User.mobile == username),
            User.deleted_at.is_(None),
        )
        return await self.session.scalar(stmt)

    async def _record_login(
        self, username: str, success: bool, ip: str | None, user_agent: str | None, reason: str | None
    ) -> None:
        self.session.add(
            LoginLog(
                username=username,
                success=success,
                ip_address=ip,
                user_agent=user_agent,
                reason=reason,
            )
        )

    async def _create_session(self, user: User, ip: str | None, user_agent: str | None) -> str:
        raw = new_refresh_token()
        self.session.add(
            UserSession(
                tenant_id=user.tenant_id,
                user_id=user.id,
                refresh_token_hash=hash_refresh_token(raw),
                ip_address=ip,
                user_agent=user_agent,
                expires_at=datetime.now(UTC) + timedelta(days=self.settings.refresh_token_ttl_days),
            )
        )
        return raw

    # ---- Refresh 轮换 ----
    async def refresh(self, raw_token: str, ip: str | None, user_agent: str | None) -> tuple[TenantContext, str, str]:
        token_hash = hash_refresh_token(raw_token)
        stmt = select(UserSession).where(UserSession.refresh_token_hash == token_hash)
        session = await self.session.scalar(stmt)
        if session is None or session.revoked_at is not None:
            raise AppError(401, "invalid_refresh_token", "会话无效或已过期")
        if _as_utc(session.expires_at) < datetime.now(UTC):
            raise AppError(401, "refresh_token_expired", "会话已过期, 请重新登录")
        user = await self.session.get(User, session.user_id)
        if user is None or user.status != "ACTIVE" or user.deleted_at is not None:
            raise AppError(401, "user_inactive", "账号不可用")

        # 轮换: 旧会话撤销, 记录链
        session.revoked_at = datetime.now(UTC)
        session.last_used_at = datetime.now(UTC)
        self.session.add(session)

        access_token = create_access_token(
            str(user.id), str(user.tenant_id), self.settings, user.token_version
        )
        new_raw = await self._create_session(user, ip, user_agent)
        # 关联轮换链 (通过 token hash 匹配不可行, 直接记录 raw 哈希关系)
        new_sess = await self.session.scalar(
            select(UserSession).where(
                UserSession.refresh_token_hash == hash_refresh_token(new_raw)
            )
        )
        if new_sess is not None:
            new_sess.replaced_by = session.id
        await self.session.commit()
        ctx = await self._build_context(user)
        return ctx, access_token, new_raw

    async def logout(self, raw_token: str | None) -> None:
        if not raw_token:
            return
        session = await self.session.scalar(
            select(UserSession).where(
                UserSession.refresh_token_hash == hash_refresh_token(raw_token)
            )
        )
        if session is not None and session.revoked_at is None:
            session.revoked_at = datetime.now(UTC)
            self.session.add(session)
            # 退出后使该用户所有 Access Token 立即失效
            user = await self.session.get(User, session.user_id)
            if user is not None:
                user.token_version += 1
                self.session.add(user)
            await self.session.commit()

    # ---- 改密 / 重置 ----
    async def change_password(self, ctx: TenantContext, old_password: str, new_password: str) -> None:
        if not verify_password(old_password, ctx.user.password_hash):
            raise AppError(400, "wrong_old_password", "原密码错误")
        if len(new_password) < 8:
            raise AppError(400, "weak_password", "新密码至少 8 位")
        ctx.user.password_hash = hash_password(new_password)
        ctx.user.token_version += 1
        await self._revoke_all_sessions(ctx.user.id)
        self.session.add(ctx.user)
        await self.session.commit()

    async def admin_reset_password(self, actor: TenantContext, target_user_id: uuid.UUID, new_password: str) -> None:
        if str(target_user_id) == str(actor.user.id):
            raise AppError(400, "cannot_reset_self", "请使用修改密码功能")
        target = await self.session.get(User, target_user_id)
        if target is None or str(target.tenant_id) != str(actor.tenant_id):
            raise AppError(404, "not_found", "用户不存在")
        if len(new_password) < 8:
            raise AppError(400, "weak_password", "新密码至少 8 位")
        target.password_hash = hash_password(new_password)
        target.token_version += 1
        await self._revoke_all_sessions(target.id)
        self.session.add(target)
        await self.session.commit()

    async def _revoke_all_sessions(self, user_id: uuid.UUID) -> None:
        sessions = await self.session.scalars(
            select(UserSession).where(
                UserSession.user_id == user_id, UserSession.revoked_at.is_(None)
            )
        )
        now = datetime.now(UTC)
        for s in sessions:
            s.revoked_at = now
            self.session.add(s)
