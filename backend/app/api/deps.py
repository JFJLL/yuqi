"""FastAPI 依赖: 数据库会话 / 当前用户 / 权限校验."""

from __future__ import annotations

import uuid
from typing import Annotated

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.core.security import decode_access_token
from app.db.session import session_dependency
from app.models.auth import Role, Tenant, User, user_roles
from app.services.security_context import DataScopeService, PermissionService, TenantContext

SessionDep = Annotated[AsyncSession, Depends(session_dependency)]
SettingsDep = Annotated[Settings, Depends(get_settings)]

_bearer = HTTPBearer(auto_error=False)


async def _build_context(session: AsyncSession, user: User) -> TenantContext:
    result = await session.execute(
        select(Role)
        .join(user_roles, user_roles.c.role_id == Role.id)
        .where(user_roles.c.user_id == user.id)
    )
    roles = list(result.scalars().all())
    permissions: set[str] = set()
    data_scope_types: list[str] = []
    org_node_ids: set[uuid.UUID] = set()
    store_ids: set[uuid.UUID] = set()
    for role in roles:
        permissions.update(p.code for p in role.permissions)
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


async def get_current_user(
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> TenantContext:
    if credentials is None:
        raise AppError(401, "unauthorized", "未认证或登录已过期")
    try:
        payload = decode_access_token(credentials.credentials, settings)
    except jwt.ExpiredSignatureError as exc:
        raise AppError(401, "token_expired", "登录已过期, 请重新登录") from exc
    except jwt.InvalidTokenError as exc:
        raise AppError(401, "invalid_token", "无效的登录凭证") from exc
    if payload.get("type") != "access":
        raise AppError(401, "invalid_token", "无效的登录凭证")

    user = await session.get(User, uuid.UUID(payload["sub"]))
    if user is None or user.deleted_at is not None or user.status != "ACTIVE":
        raise AppError(401, "user_inactive", "账号不可用")
    if payload.get("ver", 0) != user.token_version:
        # 改密/停用/退出后旧 Access Token 立即失效
        raise AppError(401, "token_revoked", "登录已失效, 请重新登录")
    tenant = await session.get(Tenant, user.tenant_id)
    if tenant is None or tenant.status != "ACTIVE":
        raise AppError(403, "tenant_disabled", "租户不可用")
    user.tenant = tenant  # 填充关系, 避免异步懒加载
    return await _build_context(session, user)


CurrentUser = Annotated[TenantContext, Depends(get_current_user)]


class RequirePermission:
    """用法: Depends(RequirePermission("users:manage"))"""

    def __init__(self, *permissions: str) -> None:
        self.permissions = permissions

    def __call__(self, ctx: CurrentUser) -> TenantContext:
        PermissionService(ctx).require(*self.permissions)
        return ctx


def get_scope_service(ctx: CurrentUser) -> DataScopeService:
    return DataScopeService(ctx)


ScopeService = Annotated[DataScopeService, Depends(get_scope_service)]
