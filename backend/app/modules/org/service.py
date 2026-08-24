"""组织服务: 组织树 / 员工查询与数据范围过滤 / 手机号脱敏."""

from __future__ import annotations

import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.models.org import Employee, OrganizationNode, Store
from app.schemas.org import mask_mobile
from app.services.security_context import TenantContext


class OrgService:
    def __init__(self, session: AsyncSession, ctx: TenantContext) -> None:
        self.session = session
        self.ctx = ctx

    # ---- 组织树 ----
    async def get_all_nodes(self) -> list[OrganizationNode]:
        rows = (
            (
                await self.session.execute(
                    select(OrganizationNode).where(
                        OrganizationNode.tenant_id == self.ctx.tenant_id,
                        OrganizationNode.deleted_at.is_(None),
                    )
                )
            )
            .scalars()
            .all()
        )
        return list(rows)

    async def get_node_or_404(self, node_id: uuid.UUID) -> OrganizationNode:
        node = await self.session.get(OrganizationNode, node_id)
        if node is None or str(node.tenant_id) != str(self.ctx.tenant_id) or node.deleted_at is not None:
            raise AppError(404, "not_found", "组织节点不存在")
        return node

    async def get_store_or_404(self, store_id: uuid.UUID) -> Store:
        store = await self.session.get(Store, store_id)
        if store is None or str(store.tenant_id) != str(self.ctx.tenant_id) or store.deleted_at is not None:
            raise AppError(404, "not_found", "门店不存在")
        return store

    async def get_employee_or_404(self, employee_id: uuid.UUID) -> Employee:
        emp = await self.session.get(Employee, employee_id)
        if emp is None or str(emp.tenant_id) != str(self.ctx.tenant_id) or emp.deleted_at is not None:
            raise AppError(404, "not_found", "员工不存在")
        return emp

    # ---- 数据范围 ----
    async def visible_employee_ids(self) -> set[uuid.UUID]:
        """按数据范围返回当前用户可见的员工 ID 集合 (SELF 返回本人)."""

        from app.services.security_context import DataScopeService

        scope = DataScopeService(self.ctx)
        stmt = select(Employee.id).where(
            Employee.tenant_id == self.ctx.tenant_id, Employee.deleted_at.is_(None)
        )
        if scope.can_see_all:
            return set((await self.session.execute(stmt)).scalars().all())
        if "SELF" in self.ctx.data_scope_types:
            if self.ctx.employee_id:
                return {self.ctx.employee_id}
            return set()
        conditions = []
        if self.ctx.store_ids:
            conditions.append(Employee.store_id.in_(self.ctx.store_ids))
        if self.ctx.org_node_ids:
            conditions.append(Employee.organization_node_id.in_(self.ctx.org_node_ids))
        if not conditions:
            return set()
        stmt = stmt.where(or_(*conditions))
        return set((await self.session.execute(stmt)).scalars().all())

    async def build_tree(self) -> list[dict]:
        nodes = await self.get_all_nodes()
        by_parent: dict[uuid.UUID | None, list[OrganizationNode]] = {}
        for node in nodes:
            by_parent.setdefault(node.parent_id, []).append(node)

        def build(parent_id: uuid.UUID | None) -> list[dict]:
            items: list[dict] = []
            for node in sorted(by_parent.get(parent_id, []), key=lambda n: (n.sort_order, n.code)):
                items.append(
                    {
                        "id": str(node.id),
                        "parent_id": str(node.parent_id) if node.parent_id else None,
                        "node_type": node.node_type,
                        "name": node.name,
                        "code": node.code,
                        "sort_order": node.sort_order,
                        "status": node.status,
                        "children": build(node.id),
                    }
                )
            return items

        return build(None)

    # ---- 员工 ----
    async def list_employees(
        self,
        *,
        page: int,
        page_size: int,
        keyword: str,
        store_id: uuid.UUID | None,
        region_id: uuid.UUID | None,
        job_title: str,
        status: str,
    ) -> tuple[list[Employee], int]:
        from sqlalchemy import func, or_

        visible = await self.visible_employee_ids()
        stmt = select(Employee).where(
            Employee.tenant_id == self.ctx.tenant_id,
            Employee.deleted_at.is_(None),
            Employee.id.in_(visible) if visible else Employee.id.in_([]),
        )
        if keyword:
            like = f"%{keyword}%"
            stmt = stmt.where(
                or_(
                    Employee.name.like(like),
                    Employee.employee_no.like(like),
                    Employee.mobile.like(like),
                )
            )
        if store_id:
            stmt = stmt.where(Employee.store_id == store_id)
        if region_id:
            # 门店节点挂在区域节点下 (organization_nodes.parent_id = 区域);
            # 兼容门店节点直接指向区域节点的情况
            stmt = stmt.join(Store, Store.id == Employee.store_id).join(
                OrganizationNode, OrganizationNode.id == Store.node_id
            ).where(
                or_(
                    OrganizationNode.parent_id == region_id,
                    OrganizationNode.id == region_id,
                )
            )
        if job_title:
            stmt = stmt.where(Employee.job_title == job_title)
        if status:
            stmt = stmt.where(Employee.employment_status == status)
        total = await self.session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        stmt = stmt.order_by(Employee.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows), total

    def mask(self, emp: Employee) -> str | None:
        return mask_mobile(emp.mobile)
