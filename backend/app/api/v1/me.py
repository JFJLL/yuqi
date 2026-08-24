"""当前用户信息端点 (管理端菜单/权限/租户信息)."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep
from app.schemas.auth import RoleOut, TenantOut, UserOut

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=dict)
async def me(session: SessionDep, ctx: CurrentUser) -> dict:
    await session.get(ctx.user.__class__, ctx.user.id)  # 保持会话活跃
    return {
        "user": UserOut.model_validate(ctx.user),
        "tenant": TenantOut.model_validate(ctx.user.tenant),
        "roles": [RoleOut.model_validate(r) for r in ctx.roles],
        "permissions": sorted(ctx.permissions),
        "data_scope_types": ctx.data_scope_types,
        "is_super_admin": ctx.is_super_admin,
    }
