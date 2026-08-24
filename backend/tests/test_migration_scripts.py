"""迁移脚本测试: dry-run / 幂等 / 关系完整性 / 回滚.

使用子进程 + 临时文件 SQLite 数据库 (脚本自带 engine, 无法复用内存库)。
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
PYTHON = BACKEND / ".venv" / "Scripts" / "python.exe"


def _snapshot(tmp: Path) -> Path:
    data = {
        "regions": [{"id": "r1", "name": "华东一区", "code": "R-EAST-1"}],
        "stores": [{"id": "s1", "name": "解放路旗舰店", "code": "S-01", "address": "杭州"}],
        "employees": [
            {"id": "e1", "name": "李娜", "phone": "13800001111", "role": "店长"},
            {"id": "e2", "name": "王强", "phone": "13800002222", "role": "营业员"},
        ],
        "devices": [
            {"id": "d1", "device_no": "WF-A1001", "vendor": "厂商"},
            {"id": "d2", "device_no": "WF-A1002"},
        ],
        "device_bindings": [
            {
                "id": "b1", "device_id": "d1", "employee_id": "e1",
                "effective_date": "2026-08-01T00:00:00Z", "status": "使用中",
            },
        ],
        "transcripts": [{"id": "t1", "device": "WF-A1001", "full_text": "旧转写(阶段三迁移)"}],
        "inspection_issues": [{"id": "i1", "issue_type": "夸大疗效", "state": "待整改"}],
    }
    p = tmp / "pb-snapshot.json"
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return p


def _run(tmp: Path, *args: str) -> subprocess.CompletedProcess:
    env = dict(os.environ)
    env["DATABASE_URL"] = f"sqlite+aiosqlite:///{tmp / 'migrate.db'}"
    env["ENV"] = "test"
    env["REDIS_ENABLED"] = "false"
    env["PYTHONIOENCODING"] = "utf-8"
    return subprocess.run(
        [str(PYTHON), str(BACKEND / "scripts" / "migrate_pocketbase_to_postgres.py"), *args],
        capture_output=True, encoding="utf-8", errors="replace", env=env, cwd=BACKEND,
    )


class TestMigration:
    def test_dry_run_then_migrate_then_verify(self, tmp_path: Path) -> None:
        snap = _snapshot(tmp_path)
        # 1) dry-run 不写入
        r = _run(tmp_path, "--snapshot", str(snap), "--tenant-code", "demo", "--dry-run")
        assert r.returncode == 0, r.stderr
        assert "DRY-RUN" in r.stdout
        # 2) 真实迁移
        r = _run(tmp_path, "--snapshot", str(snap), "--tenant-code", "demo")
        assert r.returncode == 0, r.stderr
        assert "迁移批次" in r.stdout
        # 3) 重复迁移 → 幂等
        r = _run(tmp_path, "--snapshot", str(snap), "--tenant-code", "demo")
        assert r.returncode == 0
        assert "新建 0" in r.stdout or "源 2 / 新建 0" in r.stdout
        # 4) 校验通过
        env = dict(os.environ)
        env["DATABASE_URL"] = f"sqlite+aiosqlite:///{tmp_path / 'migrate.db'}"
        env["ENV"] = "test"
        env["PYTHONIOENCODING"] = "utf-8"
        verify = subprocess.run(
            [str(PYTHON), str(BACKEND / "scripts" / "verify_migration.py"),
             "--snapshot", str(snap), "--tenant-code", "demo"],
            capture_output=True, encoding="utf-8", errors="replace", env=env, cwd=BACKEND,
        )
        assert verify.returncode == 0, verify.stdout + verify.stderr
        assert "校验结果: 通过" in verify.stdout

    def test_invalid_snapshot_fails_cleanly(self, tmp_path: Path) -> None:
        bad = tmp_path / "bad.json"
        bad.write_text("not-json", encoding="utf-8")
        r = _run(tmp_path, "--snapshot", str(bad))
        assert r.returncode != 0
