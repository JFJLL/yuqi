"""用户管理端点 (管理端): 列表 / 详情 / 建 / 停用 / 重置密码."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, RequirePermission, SessionDep, SettingsDep
from app.core.errors import AppError
from app.core.pagination import page_meta
from app.core.security import hash_password
from app.models.auth import Role, User
from app.modules.auth.service import AuthService
from app.schemas.auth import AdminResetPasswordRequest, MessageResponse, UserOut
from app.services.security_context import TenantContext

router = APIRouter(prefix="/users", tags=["users"])


class CreateUserRequest(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    display_name: str = Field(min_length=1, max_length=128)
    mobile: str | None = Field(default=None, max_length=32)
    password: str = Field(min_length=8, max_length=128)
    role_ids: list[uuid.UUID] = []


@router.get("", response_model=dict)
async def list_users(
    session: SessionDep,
    ctx: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    keyword: str = Query("", max_length=64),
    status: str = Query(""),
    _: TenantContext = Depends(RequirePermission("users:read")),
) -> dict:
    stmt = select(User).where(User.tenant_id == ctx.tenant_id, User.deleted_at.is_(None))
    if keyword:
        like = f"%{keyword}%"
        stmt = stmt.where((User.username.like(like)) | (User.display_name.like(like)))
    if status:
        stmt = stmt.where(User.status == status)
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    stmt = stmt.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await session.execute(stmt)).scalars().all()
    return {"items": [UserOut.model_validate(u) for u in rows], **page_meta(page, page_size, total)}


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: uuid.UUID,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("users:read")),
) -> UserOut:
    user = await _get_tenant_user(session, ctx, user_id)
    return UserOut.model_validate(user)


@router.post("", response_model=UserOut, status_code=201)
async def create_user(
    body: CreateUserRequest,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("users:manage")),
) -> UserOut:
    dup = await session.scalar(
        select(User).where(
            User.tenant_id == ctx.tenant_id,
            (User.username == body.username) | (User.mobile == body.mobile),
            User.deleted_at.is_(None),
        )
    )
    if dup is not None:
        raise AppError(400, "user_exists", "账号或手机号已存在")
    user = User(
        tenant_id=ctx.tenant_id,
        username=body.username,
        display_name=body.display_name,
        mobile=body.mobile,
        password_hash=hash_password(body.password),
    )
    if body.role_ids:
        roles = (
            (
                await session.execute(
                    select(Role).where(
                        Role.id.in_(body.role_ids),
                        (Role.tenant_id == ctx.tenant_id) | (Role.tenant_id.is_(None)),
                    )
                )
            )
            .scalars()
            .all()
        )
        user.roles = list(roles)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return UserOut.model_validate(user)


@router.post("/{user_id}/disable", response_model=MessageResponse)
async def disable_user(
    user_id: uuid.UUID,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("users:manage")),
) -> MessageResponse:
    user = await _get_tenant_user(session, ctx, user_id)
    if str(user.id) == str(ctx.user.id):
        raise AppError(400, "cannot_disable_self", "不能停用自己")
    user.status = "DISABLED"
    user.token_version += 1  # 已签发 Access Token 立即失效
    session.add(user)
    await session.commit()
    return MessageResponse(message="账号已停用")


@router.post("/{user_id}/enable", response_model=MessageResponse)
async def enable_user(
    user_id: uuid.UUID,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("users:manage")),
) -> MessageResponse:
    user = await _get_tenant_user(session, ctx, user_id)
    user.status = "ACTIVE"
    session.add(user)
    await session.commit()
    return MessageResponse(message="账号已启用")


@router.post("/{user_id}/reset-password", response_model=MessageResponse)
async def reset_password(
    user_id: uuid.UUID,
    body: AdminResetPasswordRequest,
    session: SessionDep,
    settings: SettingsDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("users:manage")),
) -> MessageResponse:
    await AuthService(session, settings).admin_reset_password(ctx, user_id, body.new_password)
    return MessageResponse(message="密码已重置, 该用户所有会话已失效")


async def _get_tenant_user(session, ctx: TenantContext, user_id: uuid.UUID) -> User:
    user = await session.scalar(
        select(User).options(selectinload(User.roles)).where(User.id == user_id)
    )
    if user is None or str(user.tenant_id) != str(ctx.tenant_id) or user.deleted_at is not None:
        raise AppError(404, "not_found", "用户不存在")
    return user
