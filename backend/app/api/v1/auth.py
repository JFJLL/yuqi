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
    SmsLoginRequest,
    SmsSendRequest,
    SmsSendResponse,
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


async def _find_employee_by_mobile(session, mobile: str):
    """按手机号定位员工; 跨租户重复时不泄露存在性, 返回 None."""
    from sqlalchemy import select

    from app.models.org import Employee

    rows = (
        (
            await session.execute(
                select(Employee).where(
                    Employee.mobile == mobile, Employee.deleted_at.is_(None)
                )
            )
        )
        .scalars()
        .all()
    )
    # 手机号必须在全租户唯一 (允许同一员工多条档案也按唯一处理)
    return rows[0] if len(rows) == 1 else None


@router.post("/sms/send", response_model=SmsSendResponse)
async def sms_send(
    body: SmsSendRequest,
    session: SessionDep,
    settings: SettingsDep,
) -> SmsSendResponse:
    """下发短信验证码 (员工 H5 登录第一步).

    - 手机号不存在/跨租户重复: 仍返回 200 (不泄露账号存在性), 登录时校验失败
    - mock provider: 验证码写入日志; 非生产环境在响应中附带 debug_code 便于开发
    """
    import secrets

    from app.providers.sms import get_sms_provider, store_sms_code

    employee = await _find_employee_by_mobile(session, body.mobile)
    if settings.sms_provider == "mock" and settings.sms_mock_fixed_code and settings.env != "prod":
        code = settings.sms_mock_fixed_code
    else:
        code = f"{secrets.randbelow(1_000_000):06d}"
    provider = get_sms_provider(settings)
    await provider.send_code(body.mobile, code, tenant_id=str(employee.tenant_id) if employee else None)
    store_sms_code(body.mobile, code, settings.sms_code_ttl_seconds)
    return SmsSendResponse(
        ok=True,
        expires_in=settings.sms_code_ttl_seconds,
        debug_code=code if settings.env != "prod" else None,
    )


@router.post("/sms/login", response_model=LoginResponse)
async def sms_login(
    body: SmsLoginRequest,
    request: Request,
    response: Response,
    session: SessionDep,
    settings: SettingsDep,
) -> LoginResponse:
    """验证码登录: 校验验证码 → 定位员工 → 签发令牌 (仅限在职员工)."""
    from app.providers.sms import verify_sms_code

    if not verify_sms_code(body.mobile, body.code, max_attempts=settings.sms_max_attempts):
        raise AppError(400, "bad_sms_code", "验证码错误或已过期")
    employee = await _find_employee_by_mobile(session, body.mobile)
    if employee is None:
        raise AppError(404, "employee_not_found", "未找到该手机号对应的员工")
    ip, ua = _client_info(request)
    service = AuthService(session, settings)
    ctx, access_token, refresh_token = await service.login_by_employee(
        employee, ip=ip, user_agent=ua, mobile=body.mobile
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
