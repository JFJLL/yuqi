"""统一安全上下文: TenantContext + PermissionService + DataScopeService.

规则:
- 客户端不得自行指定有效 tenant_id; tenant_id 必须来自已认证会话
- repository/service 层统一注入租户条件与数据范围
- 即使知道其他租户对象 ID, 也必须返回 404 或无权限
- 前端菜单隐藏不能替代后端权限
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from app.core.errors import AppError
from app.models.auth import Role, User


@dataclass
class TenantContext:
    user: User
    tenant_id: uuid.UUID
    is_super_admin: bool = False
    roles: list[Role] = field(default_factory=list)
    permissions: set[str] = field(default_factory=set)
    data_scope_types: list[str] = field(default_factory=list)  # ALL/ORG_TREE/STORE/SELF
    org_node_ids: set[uuid.UUID] = field(default_factory=set)
    store_ids: set[uuid.UUID] = field(default_factory=set)
    employee_id: uuid.UUID | None = None


class PermissionService:
    def __init__(self, ctx: TenantContext) -> None:
        self.ctx = ctx

    def require(self, *permissions: str) -> None:
        if self.ctx.is_super_admin:
            return
        if not self.ctx.permissions.intersection(permissions):
            raise AppError(403, "forbidden", "没有权限执行该操作")

    def has(self, permission: str) -> bool:
        if self.ctx.is_super_admin:
            return True
        return permission in self.ctx.permissions


class DataScopeService:
    """数据范围判定 (服务端强制).

    业务 repository 查询时调用 `apply_tenant_and_scope` 拼接条件;
    详情访问用 `assert_visible(tenant_id, org_node_id=None, store_id=None, employee_id=None)`.
    """

    def __init__(self, ctx: TenantContext) -> None:
        self.ctx = ctx

    @property
    def can_see_all(self) -> bool:
        return self.ctx.is_super_admin or "ALL" in self.ctx.data_scope_types

    def sees_org(self, org_node_id: uuid.UUID | None) -> bool:
        if self.can_see_all:
            return True
        if "SELF" in self.ctx.data_scope_types and org_node_id is None:
            return True
        return org_node_id in self.ctx.org_node_ids

    def sees_store(self, store_id: uuid.UUID | None) -> bool:
        if self.can_see_all:
            return True
        if "SELF" in self.ctx.data_scope_types and store_id is None:
            return True
        return store_id in self.ctx.store_ids

    def sees_employee(self, employee_id: uuid.UUID | None) -> bool:
        if self.can_see_all:
            return True
        if "SELF" in self.ctx.data_scope_types:
            return employee_id == self.ctx.employee_id
        return True  # 组织/门店范围由上级维度过滤

    def assert_tenant(self, tenant_id: uuid.UUID) -> None:
        """跨租户一律 404, 不泄露存在性."""
        if str(tenant_id) != str(self.ctx.tenant_id):
            raise AppError(404, "not_found", "资源不存在")

    def assert_visible(
        self,
        *,
        tenant_id: uuid.UUID,
        org_node_id: uuid.UUID | None = None,
        store_id: uuid.UUID | None = None,
        employee_id: uuid.UUID | None = None,
    ) -> None:
        self.assert_tenant(tenant_id)
        if not self.can_see_all:
            if employee_id is not None and not self.sees_employee(employee_id):
                raise AppError(404, "not_found", "资源不存在")
            if store_id is not None and not self.sees_store(store_id):
                raise AppError(404, "not_found", "资源不存在")
            if org_node_id is not None and not self.sees_org(org_node_id):
                raise AppError(404, "not_found", "资源不存在")
