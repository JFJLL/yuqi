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


async def login(client: AsyncClient, username: str, password: str = "Test12345!") -> str:
    resp = await client.post(
        "/api/v1/auth/login", json={"username": username, "password": password}
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
