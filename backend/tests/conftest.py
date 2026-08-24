"""测试夹具: 内存 SQLite + ASGI 客户端 + RBAC/租户种子.

说明: 单元/API 测试使用 aiosqlite 内存库 (逻辑等价, 速度快);
PostgreSQL 专用行为 (部分唯一索引/分区/JSONB/事务) 由 pytest.mark.postgresql 标记的真实 PG 测试覆盖,
本机无 PG 时自动 skip (见 tests/test_postgresql_features.py)。
"""

from __future__ import annotations

import os

os.environ.setdefault("ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite://")
os.environ.setdefault("REDIS_ENABLED", "false")
os.environ.setdefault("ALLOW_DEMO_SEED", "false")
os.environ.setdefault("SMS_MOCK_FIXED_CODE", "123456")


import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import select as sa_select  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import session_dependency  # noqa: E402
from app.main import app  # noqa: E402
from app.models.auth import Role, Tenant, User  # noqa: E402
from app.models.device import Device  # noqa: E402
from app.models.org import Employee, OrganizationNode, Store  # noqa: E402
from app.modules.rbac.bootstrap import (  # noqa: E402
    ensure_platform_role_templates,
    materialize_tenant_roles,
)


@pytest_asyncio.fixture
async def engine():
    eng = create_async_engine(
        "sqlite+aiosqlite://",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def session_factory(engine) -> async_sessionmaker[AsyncSession]:
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    yield factory


@pytest_asyncio.fixture
async def db(session_factory) -> AsyncSession:
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(session_factory):
    async def override_session():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[session_dependency] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def _bootstrap_roles(session: AsyncSession) -> None:
    await ensure_platform_role_templates(session)
    await session.commit()


async def create_tenant(
    session: AsyncSession,
    *,
    code: str = "demo",
    name: str = "演示租户",
    is_demo: bool = True,
) -> Tenant:
    await _bootstrap_roles(session)
    tenant = Tenant(code=code, name=name, is_demo=is_demo)
    session.add(tenant)
    await session.flush()
    await materialize_tenant_roles(session, tenant)
    await session.commit()
    await session.refresh(tenant)
    return tenant


async def create_user(
    session: AsyncSession,
    tenant: Tenant,
    *,
    username: str,
    password: str = "Test12345!",
    display_name: str | None = None,
    role_codes: list[str] | None = None,
    is_super_admin: bool = False,
) -> User:
    user = User(
        tenant_id=tenant.id,
        username=username,
        display_name=display_name or username,
        password_hash=hash_password(password),
        is_super_admin=is_super_admin,
    )
    if role_codes:
        from sqlalchemy import select as sa_select

        roles = (
            (await session.execute(sa_select(Role).where(Role.tenant_id == tenant.id, Role.code.in_(role_codes))))
            .scalars()
            .all()
        )
        user.roles = list(roles)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@pytest_asyncio.fixture
async def baseline(session_factory):
    """演示租户 + 平台超级管理员 + 店长 + 普通员工."""

    async with session_factory() as session:
        tenant = await create_tenant(session, code="demo", name="演示租户")
        admin = await create_user(
            session, tenant, username="superadmin", is_super_admin=True
        )
        manager = await create_user(
            session, tenant, username="store_manager", role_codes=["STORE_MANAGER"]
        )
        employee = await create_user(
            session, tenant, username="emp001", role_codes=["EMPLOYEE"]
        )
    return {"tenant": tenant, "admin": admin, "manager": manager, "employee": employee}


async def build_org(session_factory) -> dict:
    """组织数据: 总部 → 2 区域 → 3 门店, 员工, 设备, 店长用户绑定本店."""

    async with session_factory() as session:
        tenant = await create_tenant(session, code="orgco", name="组织演示租户")
        admin = await create_user(session, tenant, username="superadmin", is_super_admin=True)
        hq = OrganizationNode(tenant_id=tenant.id, node_type="HQ", name="总部", code="HQ1")
        session.add(hq)
        await session.flush()
        east = OrganizationNode(tenant_id=tenant.id, parent_id=hq.id, node_type="REGION", name="华东", code="R-E")
        south = OrganizationNode(tenant_id=tenant.id, parent_id=hq.id, node_type="REGION", name="华南", code="R-S")
        session.add_all([east, south])
        await session.flush()
        store_a = Store(tenant_id=tenant.id, node_id=east.id, name="A 店", code="S-A")
        store_b = Store(tenant_id=tenant.id, node_id=east.id, name="B 店", code="S-B")
        store_c = Store(tenant_id=tenant.id, node_id=south.id, name="C 店", code="S-C")
        session.add_all([store_a, store_b, store_c])
        await session.flush()

        emp_a1 = Employee(tenant_id=tenant.id, employee_no="A001", name="店员甲", mobile="13800000001",
                          store_id=store_a.id, organization_node_id=store_a.node_id)
        emp_a2 = Employee(tenant_id=tenant.id, employee_no="A002", name="店员乙", mobile="13800000002",
                          store_id=store_a.id, organization_node_id=store_a.node_id)
        emp_b1 = Employee(tenant_id=tenant.id, employee_no="B001", name="店员丙", mobile="13800000003",
                          store_id=store_b.id, organization_node_id=store_b.node_id)
        emp_c1 = Employee(tenant_id=tenant.id, employee_no="C001", name="店员丁", mobile="13800000004",
                          store_id=store_c.id, organization_node_id=store_c.node_id)
        session.add_all([emp_a1, emp_a2, emp_b1, emp_c1])
        await session.flush()

        dev1 = Device(tenant_id=tenant.id, device_code="WF-TEST-001")
        dev2 = Device(tenant_id=tenant.id, device_code="WF-TEST-002")
        session.add_all([dev1, dev2])
        await session.flush()

        # 店长用户: 绑定 store_a, 数据范围 STORE (角色模板已含 STORE 范围, 补充门店归属)
        manager = await create_user(session, tenant, username="store_a_manager", role_codes=["STORE_MANAGER"])
        from app.models.auth import RoleDataScope

        role = await session.scalar(
            sa_select(Role).where(Role.tenant_id == tenant.id, Role.code == "STORE_MANAGER")
        )
        scope = await session.scalar(
            sa_select(RoleDataScope).where(
                RoleDataScope.role_id == role.id, RoleDataScope.scope_type == "STORE"
            )
        )
        scope.store_id = store_a.id
        session.add(scope)
        await session.commit()

    return {
        "tenant": tenant,
        "admin": admin,
        "hq": hq,
        "east": east,
        "south": south,
        "store_a": store_a,
        "store_b": store_b,
        "store_c": store_c,
        "emp_a1": emp_a1,
        "emp_a2": emp_a2,
        "emp_b1": emp_b1,
        "emp_c1": emp_c1,
        "dev1": dev1,
        "dev2": dev2,
        "manager": manager,
    }


async def login(client: AsyncClient, username: str, password: str = "Test12345!") -> str:
    resp = await client.post(
        "/api/v1/auth/login", json={"username": username, "password": password}
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
