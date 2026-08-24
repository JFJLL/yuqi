"""幂等演示数据 seed (开发/测试环境专用).

用法:
  python scripts/seed_demo.py            # 默认数据库 (见 .env)
  python scripts/seed_demo.py --tenant demo --admin-username admin --admin-password 'ChangeMe-2026!'

安全规则:
- 生产 (ENV=prod) 或未显式 ALLOW_DEMO_SEED=true 时拒绝执行
- 不绕过真实数据库/API/权限: 直接写库, 但账号密码走真实 Argon2id 哈希
- 可重复执行, 不产生重复数据 (按 code/username 幂等)

后续阶段在本脚本扩展: 组织树/员工/设备/音频/转写/问题/申诉/整改/通知/报表数据。
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.session import get_session_factory, init_engine  # noqa: E402
from app.models.auth import Tenant, User  # noqa: E402
from app.modules.rbac.bootstrap import materialize_tenant_roles  # noqa: E402


async def seed(tenant_code: str, admin_username: str, admin_password: str) -> None:
    settings = get_settings()
    if settings.is_prod:
        raise SystemExit("✖ 生产环境禁止执行 seed (ENV=prod)")
    if not settings.allow_demo_seed and settings.database_url.startswith("postgresql"):
        raise SystemExit("✖ ALLOW_DEMO_SEED 未开启, 拒绝执行 (演示数据仅限开发/测试)")

    init_engine(settings)
    factory = get_session_factory()
    async with factory() as session:
        tenant = await session.scalar(select(Tenant).where(Tenant.code == tenant_code))
        if tenant is None:
            tenant = Tenant(code=tenant_code, name="演示租户(测试数据)", is_demo=True)
            session.add(tenant)
            await session.flush()
            print(f"+ tenant {tenant_code}")
        await materialize_tenant_roles(session, tenant)

        user = await session.scalar(
            select(User).where(User.tenant_id == tenant.id, User.username == admin_username)
        )
        if user is None:
            user = User(
                tenant_id=tenant.id,
                username=admin_username,
                display_name="平台管理员",
                password_hash=hash_password(admin_password),
                is_super_admin=True,
            )
            session.add(user)
            print(f"+ admin {admin_username} (演示账号)")
        await session.commit()
        print(f"✔ seed 完成: tenant={tenant.code}, admin={admin_username}, env={settings.env}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tenant", default="demo")
    parser.add_argument("--admin-username", default="admin")
    parser.add_argument("--admin-password", default=os.environ.get("SEED_ADMIN_PASSWORD", "Admin-2026!"))
    args = parser.parse_args()
    asyncio.run(seed(args.tenant, args.admin_username, args.admin_password))


if __name__ == "__main__":
    main()
