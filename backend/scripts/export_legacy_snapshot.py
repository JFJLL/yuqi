"""从 PocketBase 导出 JSON 快照 (迁移备份保障).

用法:
  python scripts/export_legacy_snapshot.py --pb-url http://127.0.0.1:7040 \
      --admin-email admin@x --admin-password '...' --out snapshots/pocketbase-2026-08.json

只读导出, 不修改源数据。导出 collections: regions/stores/employees/devices/device_bindings/transcripts/
inspection_issues/rectify_tasks/appeals/compliance_rules/audio_files/asr_jobs/sync_logs/device_logs
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

import httpx

COLLECTIONS = [
    "regions", "stores", "employees", "devices", "device_bindings",
    "transcripts", "inspection_issues", "rectify_tasks", "appeals",
    "compliance_rules", "audio_files", "asr_jobs", "sync_logs", "device_logs",
]


async def fetch_all(client: httpx.AsyncClient, base: str, collection: str, headers: dict[str, str]) -> list[dict]:
    items: list[dict] = []
    page = 1
    while True:
        resp = await client.get(
            f"{base}/api/collections/{collection}/records",
            params={"page": page, "perPage": 200, "sort": "created"},
            headers=headers,
        )
        resp.raise_for_status()
        body = resp.json()
        items.extend(body.get("items", []))
        if page * 200 >= body.get("totalItems", 0):
            break
        page += 1
    return items


async def run(pb_url: str, admin_email: str, admin_password: str, out: Path, exported_at: float | None) -> None:
    await asyncio.to_thread(out.parent.mkdir, parents=True, exist_ok=True)
    async with httpx.AsyncClient(timeout=60) as client:
        # PocketBase 超级管理员登录 (仅内存持有, 不落盘)
        auth = await client.post(
            f"{pb_url}/api/collections/_superusers/auth-with-password",
            json={"identity": admin_email, "password": admin_password},
        )
        auth.raise_for_status()
        token = auth.json()["token"]
        headers = {"Authorization": token}

        snapshot: dict[str, list[dict]] = {}
        for coll in COLLECTIONS:
            snapshot[coll] = await fetch_all(client, pb_url, coll, headers)
            print(f"  {coll}: {len(snapshot[coll])}")

        snapshot["_meta"] = {
            "exported_at": exported_at,
            "pb_url": pb_url,
            "collections": COLLECTIONS,
        }
        await asyncio.to_thread(
            out.write_text, json.dumps(snapshot, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        print(f"✔ 快照已写入: {out}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pb-url", default="http://127.0.0.1:7040")
    parser.add_argument("--admin-email", required=True)
    parser.add_argument("--admin-password", required=True)
    parser.add_argument("--out", default="snapshots/pocketbase-snapshot.json")
    args = parser.parse_args()
    out = Path(args.out)
    exported_at = out.stat().st_mtime if out.exists() else None
    asyncio.run(run(args.pb_url, args.admin_email, args.admin_password, out, exported_at))


if __name__ == "__main__":
    main()
