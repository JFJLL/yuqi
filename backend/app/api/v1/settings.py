"""系统设置 API: 保留策略等键值配置 (users:manage)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.api.deps import CurrentUser, RequirePermission, SessionDep
from app.core.errors import AppError
from app.models.setting import AppSetting
from app.services.security_context import TenantContext

router = APIRouter(tags=["settings"])

# 保留策略: 录音文件保留天数 (默认 365 天, 0 表示不自动清理)
RETENTION_DAYS_KEY = "retention_days"

DEFAULT_SETTINGS: dict[str, str] = {
    RETENTION_DAYS_KEY: "365",
}


async def _get_value(session, tenant_id, key: str) -> str:
    row = await session.scalar(
        select(AppSetting).where(AppSetting.tenant_id == tenant_id, AppSetting.key == key)
    )
    return row.value if row else DEFAULT_SETTINGS.get(key, "")


async def _set_value(session, tenant_id, key: str, value: str) -> None:
    row = await session.scalar(
        select(AppSetting).where(AppSetting.tenant_id == tenant_id, AppSetting.key == key)
    )
    if row is None:
        session.add(AppSetting(tenant_id=tenant_id, key=key, value=value))
    else:
        row.value = value


@router.get("/settings", response_model=dict)
async def get_settings(
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("users:manage")),
) -> dict:
    """读取系统设置 (含默认值)."""
    retention = await _get_value(session, ctx.tenant_id, RETENTION_DAYS_KEY)
    return {"retention_days": retention}


@router.put("/settings", response_model=dict)
async def update_settings(
    body: dict,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("users:manage")),
) -> dict:
    """更新系统设置 (当前支持保留天数)."""
    retention_raw = str(body.get("retention_days", "")).strip()
    if not retention_raw:
        raise AppError(400, "invalid_retention", "保留天数不能为空")
    try:
        days = int(retention_raw)
    except ValueError as exc:
        raise AppError(400, "invalid_retention", "保留天数必须为数字") from exc
    if days < 0 or days > 3650:
        raise AppError(400, "invalid_retention", "保留天数须在 0-3650 之间 (0 表示不自动清理)")
    await _set_value(session, ctx.tenant_id, RETENTION_DAYS_KEY, str(days))
    await session.commit()
    return {"ok": True, "retention_days": str(days)}
