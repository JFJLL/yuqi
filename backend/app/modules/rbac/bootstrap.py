"""默认权限与角色模板 (平台内置, 复制给租户).

默认角色:
  平台超级管理员 / 客户管理员 / 总部合规专员 / 区域经理 / 店长 / 复核人员 / 普通员工 / 只读审计人员
数据范围: 全部组织 / 指定组织及子级 / 本门店 / 仅本人
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auth import Permission, Role, RoleDataScope, Tenant

# ---- 权限定义 ----
PERMISSIONS: dict[str, str] = {
    # 组织/员工/设备
    "org:read": "查看组织",
    "org:manage": "维护组织",
    "employee:read": "查看员工",
    "employee:manage": "维护员工",
    "device:read": "查看设备",
    "device:manage": "维护设备",
    "binding:manage": "管理设备绑定",
    "binding:approve": "审批绑定申请",
    # 用户/角色
    "users:read": "查看用户",
    "users:manage": "管理用户与角色",
    "rules:manage": "维护风险规则",
    # 文件/转写
    "records:read": "查看录音转写",
    "records:upload": "上传音频",
    "records:retry": "重试转写",
    "records:edit": "编辑转写文本",
    "records:export": "导出记录",
    "records:delete": "删除记录",
    # 分析/问题
    "analysis:rerun": "重跑分析",
    "issue:review": "复核疑似问题",
    "issue:close": "关闭问题",
    "appeal:review": "复核申诉",
    "rectify:confirm": "确认整改",
    # 报表/审计
    "report:view": "查看报表",
    "report:export": "导出报表",
    "audit:view": "查看审计日志",
    # 员工端
    "employee.self:view": "员工查看本人数据",
    "employee.self:appeal": "员工发起申诉",
    "employee.self:rectify": "员工提交整改",
    "employee.self:bind": "员工发起绑定",
}

# ---- 角色模板: code -> (名称, 权限列表, 数据范围) ----
ROLE_TEMPLATES: dict[str, tuple[str, list[str], list[tuple[str, str | None]]]] = {
    "SUPER_ADMIN": ("平台超级管理员", list(PERMISSIONS.keys()), [("ALL", None)]),
    "CUSTOMER_ADMIN": ("客户管理员", list(PERMISSIONS.keys()), [("ALL", None)]),
    "COMPLIANCE": (
        "总部合规专员",
        [
            "org:read", "employee:read", "device:read", "records:read", "records:export",
            "records:edit", "issue:review", "issue:close", "appeal:review", "rectify:confirm",
            "report:view", "report:export", "audit:view", "rules:manage", "analysis:rerun",
        ],
        [("ALL", None)],
    ),
    "REGION_MANAGER": (
        "区域经理",
        ["org:read", "employee:read", "device:read", "records:read", "issue:review", "rectify:confirm", "report:view"],
        [("ORG_TREE", None)],
    ),
    "STORE_MANAGER": (
        "店长",
        [
            "employee:read", "device:read", "records:read", "issue:review",
            "appeal:review", "rectify:confirm", "binding:approve", "report:view",
        ],
        [("STORE", None)],
    ),
    "REVIEWER": ("复核人员", ["records:read", "issue:review", "appeal:review", "report:view"], [("ALL", None)]),
    "EMPLOYEE": (
        "普通员工",
        ["employee.self:view", "employee.self:appeal", "employee.self:rectify", "employee.self:bind"],
        [("SELF", None)],
    ),
    "AUDITOR": ("只读审计人员", ["report:view", "report:export", "audit:view", "records:read"], [("ALL", None)]),
}


async def ensure_platform_permissions(session: AsyncSession) -> dict[str, Permission]:
    """幂等创建全部权限."""

    existing = (await session.execute(select(Permission))).scalars().all()
    by_code = {p.code: p for p in existing}
    for code, name in PERMISSIONS.items():
        if code not in by_code:
            p = Permission(code=code, name=name)
            session.add(p)
            by_code[code] = p
    await session.flush()
    return by_code


async def ensure_platform_role_templates(session: AsyncSession) -> dict[str, Role]:
    """幂等创建平台内置角色模板 (tenant_id=None)."""

    perms = await ensure_platform_permissions(session)
    existing = (
        (
            await session.execute(
                select(Role)
                .options(selectinload(Role.permissions), selectinload(Role.data_scopes))
                .where(Role.tenant_id.is_(None))
            )
        )
        .scalars()
        .all()
    )
    by_code = {r.code: r for r in existing}
    for code, (name, perm_codes, scopes) in ROLE_TEMPLATES.items():
        if code in by_code:
            continue
        role = Role(tenant_id=None, code=code, name=name, is_builtin=True)
        role.permissions = [perms[c] for c in perm_codes]
        session.add(role)
        await session.flush()
        for scope_type, _org_id in scopes:
            session.add(
                RoleDataScope(
                    tenant_id=None,  # 平台模板, 复制给租户时按租户重建
                    role_id=role.id,
                    scope_type=scope_type,
                    org_node_id=None,
                )
            )
        by_code[code] = role
    await session.flush()
    return by_code


async def materialize_tenant_roles(session: AsyncSession, tenant: Tenant) -> dict[str, Role]:
    """为租户复制角色模板 (含数据范围), 幂等."""

    templates = await ensure_platform_role_templates(session)
    existing = (
        (
            await session.execute(
                select(Role).where(
                    Role.tenant_id == tenant.id,
                    Role.code.in_(list(ROLE_TEMPLATES.keys())),
                )
            )
        )
        .scalars()
        .all()
    )
    by_code = {r.code: r for r in existing}
    # 直接按规格表迭代, 避免触发平台模板对象的关系懒加载 (async 下会 MissingGreenlet)
    for code, (_name, _perm_codes, scopes) in ROLE_TEMPLATES.items():
        if code in by_code:
            continue
        template = templates[code]
        role = Role(
            tenant_id=tenant.id,
            code=template.code,
            name=template.name,
            description=template.description,
            is_builtin=True,
            permissions=list(template.permissions),
        )
        session.add(role)
        await session.flush()
        for scope_type, _org_id in scopes:
            session.add(
                RoleDataScope(
                    tenant_id=tenant.id,
                    role_id=role.id,
                    scope_type=scope_type,
                    org_node_id=None,
                    store_id=None,
                )
            )
        by_code[code] = role
    await session.flush()
    return by_code
