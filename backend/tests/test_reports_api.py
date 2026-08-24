"""阶段六: 报表 / 审计日志 / 设置与保留策略."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import pytest

from app.models.issue import Issue, Rectification
from app.models.recording import AudioFile, Conversation
from tests.conftest import auth_headers, build_org, login


async def _add_issue(session_factory, org, *, store, emp, risk="高", occurred=None, appeal="NONE") -> Issue:
    async with session_factory() as session:
        issue = Issue(
            tenant_id=org["tenant"].id,
            issue_no=f"ISS-{risk}-{appeal}-{store.code}",
            store_id=store.id,
            employee_id=emp.id,
            issue_type="夸大疗效表达",
            risk=risk,
            quote="重点介绍 阿莫西林胶囊",
            advice="需复核",
            appeal_status=appeal,
            occurred_at=occurred or datetime.now(UTC),
        )
        session.add(issue)
        await session.commit()
        await session.refresh(issue)
        return issue


async def _add_rect(session_factory, org, *, store, emp, status="CONFIRMED", due=None) -> Rectification:
    async with session_factory() as session:
        issue = Issue(
            tenant_id=org["tenant"].id,
            issue_no=f"ISS-R-{store.code}",
            store_id=store.id,
            employee_id=emp.id,
            issue_type="夸大疗效表达",
            risk="中",
            quote="q",
            advice="a",
            occurred_at=datetime.now(UTC),
        )
        session.add(issue)
        await session.flush()
        rect = Rectification(
            tenant_id=org["tenant"].id,
            issue_id=issue.id,
            store_id=store.id,
            employee_id=emp.id,
            title=f"整改-{store.code}",
            due_date=due or date.today() + timedelta(days=3),
            status=status,
            progress=100 if status == "CONFIRMED" else 0,
        )
        session.add(rect)
        await session.commit()
        await session.refresh(rect)
        return rect


async def _add_audio(session_factory, org, *, store, emp, occurred=None) -> AudioFile:
    async with session_factory() as session:
        audio = AudioFile(
            tenant_id=org["tenant"].id,
            file_name="rec.wav",
            object_key=f"t/{store.code}/rec.wav",
            store_id=store.id,
            employee_id=emp.id,
            occurred_at=occurred or datetime.now(UTC),
        )
        session.add(audio)
        await session.commit()
        await session.refresh(audio)
        return audio


@pytest.mark.asyncio
async def test_overview_counts(client, session_factory):
    org = await build_org(session_factory)
    await _add_issue(session_factory, org, store=org["store_a"], emp=org["emp_a1"], risk="高")
    await _add_issue(session_factory, org, store=org["store_c"], emp=org["emp_c1"], risk="低")
    await _add_rect(session_factory, org, store=org["store_a"], emp=org["emp_a1"], status="CONFIRMED")
    await _add_rect(session_factory, org, store=org["store_c"], emp=org["emp_c1"], status="PENDING")
    await _add_audio(session_factory, org, store=org["store_a"], emp=org["emp_a1"])

    token = await login(client, "superadmin")
    resp = await client.get("/api/v1/reports/overview", headers=auth_headers(token))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["issues_total"] == 4  # 2 直接 + 2 整改自带
    assert data["high_risk"] == 1
    assert data["rectify_rate"] == 50.0
    assert data["rectify_total"] == 2
    assert data["recordings_total"] == 1
    assert data["stores_total"] == 3


@pytest.mark.asyncio
async def test_regions_aggregation(client, session_factory):
    org = await build_org(session_factory)
    await _add_issue(session_factory, org, store=org["store_a"], emp=org["emp_a1"], risk="高")
    await _add_issue(session_factory, org, store=org["store_a"], emp=org["emp_a2"], risk="中", appeal="APPEALING")
    await _add_issue(session_factory, org, store=org["store_c"], emp=org["emp_c1"], risk="高", appeal="APPEAL_APPROVED")
    await _add_rect(session_factory, org, store=org["store_a"], emp=org["emp_a1"], status="CONFIRMED")
    await _add_rect(session_factory, org, store=org["store_c"], emp=org["emp_c1"], status="PENDING")

    token = await login(client, "superadmin")
    resp = await client.get("/api/v1/reports/regions", headers=auth_headers(token))
    assert resp.status_code == 200, resp.text
    rows = {r["region_name"]: r for r in resp.json()["items"]}
    assert set(rows) == {"华东", "华南"}
    east = rows["华东"]
    assert east["store_count"] == 2
    assert east["issue_count"] == 3  # 2 直接 + 1 整改自带
    assert east["high_risk"] == 1
    assert east["rectify_rate"] == 100.0
    assert east["appeal_pass_rate"] == 0.0
    south = rows["华南"]
    assert south["issue_count"] == 2  # 1 直接 + 1 整改自带
    assert south["appeal_pass_rate"] == 100.0
    assert south["rectify_rate"] == 0.0


@pytest.mark.asyncio
async def test_store_scope_limits_data(client, session_factory):
    org = await build_org(session_factory)
    await _add_issue(session_factory, org, store=org["store_a"], emp=org["emp_a1"], risk="高")
    await _add_issue(session_factory, org, store=org["store_c"], emp=org["emp_c1"], risk="高")
    await _add_rect(session_factory, org, store=org["store_a"], emp=org["emp_a1"], status="CONFIRMED")
    await _add_rect(session_factory, org, store=org["store_c"], emp=org["emp_c1"], status="CONFIRMED")

    token = await login(client, "store_a_manager")
    resp = await client.get("/api/v1/reports/overview", headers=auth_headers(token))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["issues_total"] == 2  # 仅 store_a (1 直接 + 1 整改自带)
    assert data["rectify_total"] == 1

    regions = await client.get("/api/v1/reports/regions", headers=auth_headers(token))
    rows = {r["region_name"]: r for r in regions.json()["items"]}
    assert rows["华东"]["store_count"] == 1  # 范围过滤后仅 A 店
    assert "华南" not in rows


@pytest.mark.asyncio
async def test_audit_logs_list_and_filter(client, session_factory):
    await build_org(session_factory)
    token = await login(client, "superadmin")
    # 触发一条审计: 创建设备 (devices 模块会记录审计)
    resp = await client.post(
        "/api/v1/devices",
        json={"device_code": "WF-AUDIT-1", "name": "审计测试设备"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 201, resp.text

    listed = await client.get("/api/v1/audit-logs", headers=auth_headers(token))
    assert listed.status_code == 200, listed.text
    data = listed.json()
    assert data["total"] >= 1
    assert any("devices" in (item.get("resource_type") or "") for item in data["items"])

    filtered = await client.get(
        "/api/v1/audit-logs?keyword=WF-AUDIT-1", headers=auth_headers(token)
    )
    assert filtered.status_code == 200
    assert filtered.json()["total"] >= 1


@pytest.mark.asyncio
async def test_audit_logs_permission(client, session_factory):
    org = await build_org(session_factory)
    from tests.conftest import create_user

    async with session_factory() as session:
        await create_user(session, org["tenant"], username="emp_no_audit", role_codes=["EMPLOYEE"])
    token = await login(client, "emp_no_audit")  # EMPLOYEE 无 audit:view
    resp = await client.get("/api/v1/audit-logs", headers=auth_headers(token))
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_settings_get_and_update(client, session_factory):
    await build_org(session_factory)
    token = await login(client, "superadmin")
    got = await client.get("/api/v1/settings", headers=auth_headers(token))
    assert got.status_code == 200, got.text
    assert got.json()["retention_days"] == "365"

    updated = await client.put(
        "/api/v1/settings", json={"retention_days": 180}, headers=auth_headers(token)
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["retention_days"] == "180"

    got_again = await client.get("/api/v1/settings", headers=auth_headers(token))
    assert got_again.json()["retention_days"] == "180"

    bad = await client.put(
        "/api/v1/settings", json={"retention_days": -1}, headers=auth_headers(token)
    )
    assert bad.status_code == 400


@pytest.mark.asyncio
async def test_report_export_watermark_and_audit(client, session_factory):
    org = await build_org(session_factory)
    await _add_issue(session_factory, org, store=org["store_a"], emp=org["emp_a1"], risk="高")
    token = await login(client, "superadmin")
    resp = await client.get("/api/v1/reports/export", headers=auth_headers(token))
    assert resp.status_code == 200, resp.text
    text = resp.text
    assert "水印" in text or "内部数据" in text
    assert "问题总数" in text
    assert "华东" in text
    assert resp.headers["content-type"].startswith("text/csv")

    # 导出已留审计
    logs = await client.get("/api/v1/audit-logs?keyword=report.export", headers=auth_headers(token))
    assert logs.status_code == 200
    assert logs.json()["total"] >= 1

    # 无 report:export 权限的员工拒绝
    from tests.conftest import create_user

    async with session_factory() as session:
        await create_user(session, org["tenant"], username="emp_no_export", role_codes=["EMPLOYEE"])
    emp_token = await login(client, "emp_no_export")
    denied = await client.get("/api/v1/reports/export", headers=auth_headers(emp_token))
    assert denied.status_code == 403


@pytest.mark.asyncio
async def test_dashboard_summary(client, session_factory):
    org = await build_org(session_factory)
    await _add_issue(session_factory, org, store=org["store_a"], emp=org["emp_a1"], risk="高")
    await _add_issue(session_factory, org, store=org["store_b"], emp=org["emp_b1"], risk="中", appeal="APPEALING")
    await _add_audio(session_factory, org, store=org["store_a"], emp=org["emp_a1"])

    token = await login(client, "superadmin")
    resp = await client.get("/api/v1/dashboard/summary", headers=auth_headers(token))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["stats"]["issues_today"] == 2
    assert data["stats"]["high_risk"] == 1
    assert data["stats"]["pending_appeals"] == 1
    assert data["stats"]["transcripts_today"] == 1
    assert len(data["key_issues"]) == 2
    assert {i["employee_name"] for i in data["key_issues"]} == {"店员甲", "店员丙"}
    assert len(data["store_rank"]) == 2

    high = await client.get(
        "/api/v1/dashboard/summary?tab=high", headers=auth_headers(token)
    )
    assert high.status_code == 200
    assert len(high.json()["key_issues"]) == 1
    assert high.json()["key_issues"][0]["risk"] == "高"


@pytest.mark.asyncio
async def test_retention_cleanup(session_factory):
    org = await build_org(session_factory)
    old = await _add_audio(
        session_factory, org, store=org["store_a"], emp=org["emp_a1"],
        occurred=datetime.now(UTC) - timedelta(days=400),
    )
    recent = await _add_audio(
        session_factory, org, store=org["store_a"], emp=org["emp_a1"],
        occurred=datetime.now(UTC) - timedelta(days=10),
    )
    # 被疑似问题引用的旧录音: 证据锁保留
    async with session_factory() as session:
        conv = Conversation(
            tenant_id=org["tenant"].id,
            audio_file_id=old.id,
            store_id=org["store_a"].id,
            employee_id=org["emp_a1"].id,
            full_text="t",
            status="READY",
        )
        session.add(conv)
        await session.flush()
        issue = Issue(
            tenant_id=org["tenant"].id,
            issue_no="ISS-EVIDENCE",
            conversation_id=conv.id,
            audio_file_id=old.id,
            store_id=org["store_a"].id,
            employee_id=org["emp_a1"].id,
            issue_type="夸大疗效表达",
            risk="高",
            quote="q",
            advice="a",
            occurred_at=datetime.now(UTC),
        )
        session.add(issue)
        await session.commit()

    # 再放一个"旧且未引用"的录音
    orphan_old = await _add_audio(
        session_factory, org, store=org["store_c"], emp=org["emp_c1"],
        occurred=datetime.now(UTC) - timedelta(days=500),
    )

    from app.workers.scheduler import run_retention_cleanup

    async with session_factory() as session:
        from app.models.setting import AppSetting

        session.add(AppSetting(tenant_id=org["tenant"].id, key="retention_days", value="365"))
        await session.commit()

    removed = await run_retention_cleanup(session_factory)
    assert removed == 1  # 仅 orphan_old

    async with session_factory() as session:
        old_row = await session.get(AudioFile, old.id)
        assert old_row.deleted_at is None  # 证据锁保留
        recent_row = await session.get(AudioFile, recent.id)
        assert recent_row.deleted_at is None
        orphan_row = await session.get(AudioFile, orphan_old.id)
        assert orphan_row.deleted_at is not None
