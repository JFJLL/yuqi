"""迁移校验: 对比快照源数量与 PostgreSQL 目标数量 + 关系完整性.

用法: python scripts/verify_migration.py --snapshot snapshots/pb.json [--tenant-code demo]
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, select  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.db.session import get_session_factory, init_engine  # noqa: E402
from app.models.auth import Tenant  # noqa: E402
from app.models.device import Device, DeviceBinding  # noqa: E402
from app.models.org import Employee, OrganizationNode, Store  # noqa: E402


async def run(snapshot: dict, tenant_code: str) -> int:
    settings = get_settings()
    init_engine(settings)
    factory = get_session_factory()
    failures = 0

    async with factory() as session:
        tenant = await session.scalar(select(Tenant).where(Tenant.code == tenant_code))
        if tenant is None:
            print("✖ 租户不存在")
            return 1

        async def check(name: str, model, expected: int, legacy_prefix: str) -> None:
            nonlocal failures
            total = (
                await session.scalar(
                    select(func.count())
                    .select_from(model)
                    .where(model.tenant_id == tenant.id, model.legacy_id.like(f"{legacy_prefix}%"))
                )
                or 0
            )
            status = "✔" if total >= expected else "✖"
            if total < expected:
                failures += 1
            print(f"  {status} {name}: 源 {expected} / 目标 {total}")

        await check("regions", OrganizationNode, len(snapshot.get("regions", [])), "legacy:regions:")
        await check("stores", Store, len(snapshot.get("stores", [])), "legacy:stores:")
        await check("employees", Employee, len(snapshot.get("employees", [])), "legacy:employees:")
        await check("devices", Device, len(snapshot.get("devices", [])), "legacy:devices:")

        # 关系完整性: 绑定指向的设备/员工必须存在
        bindings = (
            (
                await session.execute(
                    select(DeviceBinding).where(DeviceBinding.tenant_id == tenant.id)
                )
            )
            .scalars()
            .all()
        )
        orphans = 0
        for b in bindings:
            device = await session.get(Device, b.device_id)
            emp = await session.get(Employee, b.employee_id)
            if device is None or emp is None:
                orphans += 1
                failures += 1
        status = "✔" if orphans == 0 else "✖"
        print(f"  {status} 绑定关系完整性: {len(bindings)} 条绑定, 孤儿 {orphans}")

    print(f"\n校验结果: {'通过' if failures == 0 else f'失败 ({failures} 项)'}")
    return 0 if failures == 0 else 1


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", required=True)
    parser.add_argument("--tenant-code", default="demo")
    args = parser.parse_args()
    snapshot = json.loads(Path(args.snapshot).read_text(encoding="utf-8"))
    sys.exit(asyncio.run(run(snapshot, args.tenant_code)))


if __name__ == "__main__":
    main()
