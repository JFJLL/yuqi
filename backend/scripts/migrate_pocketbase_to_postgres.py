"""PocketBase 快照 → PostgreSQL 迁移 (幂等, 可 dry-run, 不删除源数据).

用法:
  python scripts/migrate_pocketbase_to_postgres.py --snapshot snapshots/pb.json [--dry-run]
  python scripts/migrate_pocketbase_to_postgres.py --snapshot snapshots/pb.json --tenant-code demo
  python scripts/migrate_pocketbase_to_postgres.py --rollback-batch <batch_id>

说明:
- 只读源快照, 不删除 PocketBase 任何数据
- legacy_id 固定为 legacy:{collection}:{source_id}, 重复运行不产生重复数据
- 写入迁移批次 (migration_batches / migration_items), 失败可整体回滚
- dry-run 模式在事务内完整执行, 结束回滚, 不持久化任何写入
- 本地无真实 PocketBase 数据时可用 seed 生成的快照验证流程
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from datetime import UTC, date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

import app.models  # noqa: F401, E402  # 注册全部表
from app.core.config import get_settings  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_engine, get_session_factory, init_engine  # noqa: E402
from app.models.auth import Tenant  # noqa: E402
from app.models.device import Device, DeviceBinding  # noqa: E402
from app.models.migration import MigrationBatch, MigrationItem  # noqa: E402
from app.models.org import Employee, OrganizationNode, Store  # noqa: E402

MAPPING = {
    "regions": "organization_nodes",
    "stores": "stores",
    "employees": "employees",
    "devices": "devices",
    "device_bindings": "device_bindings",
    "transcripts": "audio_files(部分) + conversations + text_versions",
    "inspection_issues": "issues(LEGACY_IMPORT)",
    "rectify_tasks": "rectifications",
    "appeals": "appeals",
    "compliance_rules": "risk_rules",
    "audio_files": "audio_files",
    "asr_jobs": "processing_jobs",
    "sync_logs": "audit_logs / integration_request_logs",
    "device_logs": "audit_logs / integration_request_logs",
}

TARGET_MODELS = {
    "organization_nodes": OrganizationNode,
    "stores": Store,
    "employees": Employee,
    "devices": Device,
    "device_bindings": DeviceBinding,
}


def _legacy(collection: str, source_id: str, suffix: str = "") -> str:
    return f"legacy:{collection}:{source_id}{suffix}"


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


async def _record_item(
    session,
    batch_id: str,
    target_table: str,
    target_id: str,
    source_collection: str,
    source_id: str,
) -> None:
    session.add(
        MigrationItem(
            batch_id=batch_id,
            target_table=target_table,
            target_id=str(target_id),
            source_collection=source_collection,
            source_id=str(source_id),
        )
    )


async def _rollback_batch(session, rollback_batch: str) -> None:
    batch = await session.get(MigrationBatch, rollback_batch)
    if batch is None:
        print(f"✖ 批次不存在: {rollback_batch}")
        return
    items = (
        (await session.execute(select(MigrationItem).where(MigrationItem.batch_id == rollback_batch)))
        .scalars()
        .all()
    )
    by_table: dict[str, list[str]] = {}
    for it in items:
        by_table.setdefault(it.target_table, []).append(it.target_id)
    for table, ids in by_table.items():
        model = TARGET_MODELS.get(table)
        if model is None:
            print(f"  ⚠ 未知目标表 {table}, 跳过 {len(ids)} 条")
            continue
        deleted = 0
        for tid in ids:
            try:
                key: str | uuid.UUID = uuid.UUID(tid)
            except ValueError:
                key = tid
            row = await session.get(model, key)
            if row is not None:
                await session.delete(row)
                deleted += 1
        print(f"  {table}: 删除 {deleted}/{len(ids)}")
    await session.delete(batch)
    await session.commit()
    print(f"✔ 回滚完成: 批次 {rollback_batch}")


async def run(
    snapshot: dict,
    tenant_code: str,
    dry_run: bool,
    rollback_batch: str | None,
) -> None:
    settings = get_settings()
    init_engine(settings)
    # 目标库为空时自动建表 (正式环境应先执行 alembic upgrade head)
    async with get_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = get_session_factory()
    async with factory() as session:
        if rollback_batch:
            await _rollback_batch(session, rollback_batch)
            return

        batch_id = uuid.uuid4().hex[:12]
        tenant = await session.scalar(select(Tenant).where(Tenant.code == tenant_code))
        if tenant is None:
            tenant = Tenant(code=tenant_code, name=f"迁移租户 {tenant_code}", is_demo=False)
            session.add(tenant)
            await session.flush()
            print(f"+ 创建租户 {tenant_code}")

        if dry_run:
            print("DRY-RUN 模式: 只统计, 不写入")

        session.add(MigrationBatch(id=batch_id, tenant_id=tenant.id, status="SUCCEEDED"))

        stats: dict[str, tuple[int, int]] = {}
        # --- regions → organization_nodes (REGION) ---
        created = 0
        for rec in snapshot.get("regions", []):
            legacy = _legacy("regions", rec.get("id") or "")
            exists = await session.scalar(
                select(OrganizationNode).where(
                    OrganizationNode.tenant_id == tenant.id,
                    OrganizationNode.legacy_id == legacy,
                )
            )
            if exists:
                continue
            node = OrganizationNode(
                tenant_id=tenant.id,
                node_type="REGION",
                name=rec.get("name") or "区域",
                code=rec.get("code") or f"R-{rec.get('id', '')[:8]}",
                legacy_id=legacy,
            )
            session.add(node)
            await session.flush()
            await _record_item(session, batch_id, "organization_nodes", node.id, "regions", rec.get("id") or "")
            created += 1
        stats["regions"] = (len(snapshot.get("regions", [])), created)

        # --- stores → organization_nodes(STORE) + stores ---
        created = 0
        for rec in snapshot.get("stores", []):
            legacy = _legacy("stores", rec.get("id") or "")
            exists = await session.scalar(
                select(Store).where(Store.tenant_id == tenant.id, Store.legacy_id == legacy)
            )
            if exists:
                continue
            node = OrganizationNode(
                tenant_id=tenant.id,
                node_type="STORE",
                name=rec.get("name") or "门店",
                code=rec.get("code") or f"S-{rec.get('id', '')[:8]}",
                legacy_id=f"{legacy}:node",
            )
            session.add(node)
            await session.flush()
            store = Store(
                tenant_id=tenant.id,
                node_id=node.id,
                name=rec.get("name") or "门店",
                code=rec.get("code") or f"S-{rec.get('id', '')[:8]}",
                address=rec.get("address") or None,
                legacy_id=legacy,
            )
            session.add(store)
            await session.flush()
            await _record_item(session, batch_id, "stores", store.id, "stores", rec.get("id") or "")
            created += 1
        stats["stores"] = (len(snapshot.get("stores", [])), created)

        # --- employees ---
        created = 0
        for rec in snapshot.get("employees", []):
            legacy = _legacy("employees", rec.get("id") or "")
            exists = await session.scalar(
                select(Employee).where(Employee.tenant_id == tenant.id, Employee.legacy_id == legacy)
            )
            if exists:
                continue
            emp = Employee(
                tenant_id=tenant.id,
                employee_no=rec.get("employee_no") or rec.get("id", "")[:12],
                name=rec.get("name") or "员工",
                mobile=rec.get("phone") or rec.get("mobile") or "00000000000",
                job_title=rec.get("role") or None,
                legacy_id=legacy,
            )
            session.add(emp)
            await session.flush()
            await _record_item(session, batch_id, "employees", emp.id, "employees", rec.get("id") or "")
            created += 1
        stats["employees"] = (len(snapshot.get("employees", [])), created)

        # --- devices ---
        created = 0
        for rec in snapshot.get("devices", []):
            legacy = _legacy("devices", rec.get("id") or "")
            exists = await session.scalar(
                select(Device).where(Device.tenant_id == tenant.id, Device.legacy_id == legacy)
            )
            if exists:
                continue
            dev = Device(
                tenant_id=tenant.id,
                device_code=rec.get("device_no") or rec.get("device_code") or rec.get("id", "")[:12],
                device_type="BADGE",
                vendor=rec.get("vendor") or None,
                model=rec.get("model") or None,
                legacy_id=legacy,
            )
            session.add(dev)
            await session.flush()
            await _record_item(session, batch_id, "devices", dev.id, "devices", rec.get("id") or "")
            created += 1
        stats["devices"] = (len(snapshot.get("devices", [])), created)

        # --- device_bindings (仅迁移有效绑定关系, legacy 映射: 设备号/员工名 → ID) ---
        created = 0
        await session.flush()  # 确保设备/员工已落库 (dry-run 也会在事务内 flush)
        devices = {
            d.legacy_id: d
            for d in (await session.execute(select(Device).where(Device.tenant_id == tenant.id))).scalars()
            if d.legacy_id
        }
        employees = {
            e.legacy_id: e
            for e in (await session.execute(select(Employee).where(Employee.tenant_id == tenant.id))).scalars()
            if e.legacy_id
        }
        for rec in snapshot.get("device_bindings", []):
            legacy = _legacy("device_bindings", rec.get("id") or "")
            exists = await session.scalar(
                select(DeviceBinding).where(
                    DeviceBinding.tenant_id == tenant.id, DeviceBinding.legacy_id == legacy
                )
            )
            if exists:
                continue
            # 旧表以设备码/员工名关联, 简化映射: 按字段名兼容
            device = devices.get(_legacy("devices", rec.get("device_id") or rec.get("device") or ""))
            employee = employees.get(_legacy("employees", rec.get("employee_id") or rec.get("employee") or ""))
            if device is None or employee is None:
                print(f"  ⚠ 绑定关系缺失: {rec.get('id')} (设备/员工未匹配)")
                continue
            binding = DeviceBinding(
                tenant_id=tenant.id,
                device_id=device.id,
                employee_id=employee.id,
                start_at=_parse_dt(rec.get("effective_date")) or datetime.now(UTC),
                binding_status="ACTIVE" if rec.get("status") in (None, "使用中", "已绑定", "ACTIVE") else "ENDED",
                source="LEGACY_IMPORT",
                legacy_id=legacy,
            )
            session.add(binding)
            await session.flush()
            await _record_item(
                session, batch_id, "device_bindings", binding.id, "device_bindings", rec.get("id") or ""
            )
            created += 1
        stats["device_bindings"] = (len(snapshot.get("device_bindings", [])), created)

        # --- 其余 collection: 一期记录 "未迁移" (会话/问题/整改/申诉在阶段三/四/五映射) ---
        pending = [c for c in MAPPING if c not in stats and snapshot.get(c)]
        for c in pending:
            print(f"  ⚠ {c}: {len(snapshot.get(c, []))} 条 → 由后续阶段脚本迁移")

        if dry_run:
            await session.rollback()
            print("\n✔ DRY-RUN 完成: 未写入任何数据")
        else:
            await session.commit()
            print(f"\n✔ 迁移批次: {batch_id} (dry_run={dry_run})")
            for src, (total, created_n) in stats.items():
                print(f"  {src}: 源 {total} / 新建 {created_n}")
            print(f"  批次号请记录, 回滚用 --rollback-batch {batch_id}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", default=None)
    parser.add_argument("--tenant-code", default="demo")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--rollback-batch", default=None)
    args = parser.parse_args()
    if args.rollback_batch is None and args.snapshot is None:
        parser.error("--snapshot 必填 (或使用 --rollback-batch)")
    if args.rollback_batch is not None and args.snapshot is not None:
        parser.error("--rollback-batch 与 --snapshot 不能同时使用")
    snapshot = {}
    if args.snapshot:
        snapshot = json.loads(Path(args.snapshot).read_text(encoding="utf-8"))
    asyncio.run(
        run(snapshot, args.tenant_code, args.dry_run, args.rollback_batch)
    )


if __name__ == "__main__":
    main()
