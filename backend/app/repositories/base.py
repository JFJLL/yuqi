"""租户感知 Repository 基类: 统一注入 tenant_id 与软删除过滤."""

from __future__ import annotations

import uuid
from typing import TypeVar

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.base import Base, SoftDeleteMixin

M = TypeVar("M", bound=Base)


class BaseRepository[M]:  # type: ignore[misc]  # SQLAlchemy 模型泛型在 PEP695 下与旧接口兼容性差
    model: type[M]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ---- 租户注入 ----
    def _tenant_cond(self, tenant_id: uuid.UUID):
        col = getattr(self.model, "tenant_id", None)
        if col is None:
            raise RuntimeError(f"{self.model.__name__} 缺少 tenant_id, 不得直接访问")
        return col == tenant_id

    def _live_cond(self):
        if issubclass(self.model, SoftDeleteMixin):
            return self.model.deleted_at.is_(None)
        return None

    def list_stmt(self, tenant_id: uuid.UUID) -> Select:
        stmt = select(self.model).where(self._tenant_cond(tenant_id))
        live = self._live_cond()
        if live is not None:
            stmt = stmt.where(live)
        return stmt

    async def get_or_404(self, tenant_id: uuid.UUID, obj_id: uuid.UUID) -> M:
        table = self.model.__table__  # type: ignore[attr-defined]
        stmt = self.list_stmt(tenant_id).where(table.c["id"] == obj_id)
        result = await self.session.execute(stmt)
        obj = result.scalar_one_or_none()
        if obj is None:
            # 跨租户或不存在一律 404
            raise AppError(404, "not_found", "资源不存在")
        return obj

    async def count(self, tenant_id: uuid.UUID, stmt: Select | None = None) -> int:
        s = stmt if stmt is not None else self.list_stmt(tenant_id)
        sub = s.subquery()
        return await self.session.scalar(select(func.count()).select_from(sub)) or 0
