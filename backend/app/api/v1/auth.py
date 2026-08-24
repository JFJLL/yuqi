"""认证端点: 登录 / 刷新 / 退出 / 修改密码.

- Refresh Token 通过 HttpOnly Cookie 传递, 支持轮换与撤销
- 生产环境 Secure Cookie; 开发环境允许 http
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Cookie, Request, Response

from app.api.deps import CurrentUser, SessionDep, SettingsDep
from app.core.config import Settings
from app.core.errors import AppError
from app.modules.auth.service import AuthService
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RefreshResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "yuqi_refresh"


def _set_refresh_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        max_age=settings.refresh_token_ttl_days * 24 * 3600,
        httponly=True,
        secure=settings.secure_cookies or settings.is_prod,
        samesite="lax",
        path="/api/v1/auth",
    )


def _client_info(request: Request) -> tuple[str | None, str | None]:
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    return ip, ua


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    session: SessionDep,
    settings: SettingsDep,
) -> LoginResponse:
    ip, ua = _client_info(request)
    service = AuthService(session, settings)
    ctx, access_token, refresh_token = await service.login(
        username=body.username, password=body.password, ip=ip, user_agent=ua
    )
    _set_refresh_cookie(response, refresh_token, settings)
    return LoginResponse(
        access_token=access_token,
        expires_in=settings.jwt_access_ttl_minutes * 60,
        user=ctx.user,
        tenant=ctx.user.tenant,
        permissions=sorted(ctx.permissions),
        data_scope_types=ctx.data_scope_types,
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    request: Request,
    response: Response,
    session: SessionDep,
    settings: SettingsDep,
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> RefreshResponse:
    ip, ua = _client_info(request)
    if not refresh_token:
        raise AppError(401, "invalid_refresh_token", "缺少会话凭证")
    service = AuthService(session, settings)
    _, access_token, new_refresh = await service.refresh(refresh_token, ip, ua)
    _set_refresh_cookie(response, new_refresh, settings)
    return RefreshResponse(
        access_token=access_token, expires_in=settings.jwt_access_ttl_minutes * 60
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    response: Response,
    session: SessionDep,
    settings: SettingsDep,
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> MessageResponse:
    await AuthService(session, settings).logout(refresh_token)
    response.delete_cookie(REFRESH_COOKIE, path="/api/v1/auth")
    return MessageResponse(message="已退出登录")


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    body: ChangePasswordRequest,
    session: SessionDep,
    settings: SettingsDep,
    ctx: CurrentUser,
) -> MessageResponse:
    await AuthService(session, settings).change_password(ctx, body.old_password, body.new_password)
    return MessageResponse(message="密码已修改, 所有旧会话已失效")
