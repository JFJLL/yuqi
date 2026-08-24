"""阶段四: 规则库 / RiskAnalyzer / 疑似问题复核 / 整改推送 / 证据锁."""

from __future__ import annotations

import pytest

from tests.conftest import auth_headers, build_org, login


async def _upload(client, token: str) -> str:
    files = {"file": ("rec.wav", b"\x00\x01\x02\x03" * 128, "audio/wav")}
    data = {"device_code": "WF-TEST-001", "language": "zh-CN"}
    resp = await client.post("/api/v1/recordings/upload", files=files, data=data, headers=auth_headers(token))
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _create_rule(client, token: str, *, code: str = "R-OVERPROMISE", category: str = "夸大疗效表达",
                       keywords: list[str] | None = None, severity: str = "high") -> str:
    resp = await client.post(
        "/api/v1/rules",
        json={
            "code": code,
            "name": "夸大疗效",
            "category": category,
            "severity": severity,
            "keywords": keywords or ["重点介绍", "阿莫西林"],
            "description": "夸大疗效风险, 需复核",
        },
        headers=auth_headers(token),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_rule_crud_and_versions(client, session_factory):
    await build_org(session_factory)
    token = await login(client, "superadmin")
    rule_id = await _create_rule(client, token)
    resp = await client.get("/api/v1/rules", headers=auth_headers(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["version_no"] == 1
    # 更新 → 版本递增
    resp = await client.patch(
        f"/api/v1/rules/{rule_id}",
        json={"severity": "medium", "keywords": ["重点介绍"], "change_note": "调整风险等级"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.json()["version_no"] == 2
    assert resp.json()["severity"] == "medium"
    resp = await client.get(f"/api/v1/rules/{rule_id}/versions", headers=auth_headers(token))
    versions = resp.json()
    assert len(versions) == 2
    assert versions[0]["version_no"] == 2
    # 禁用
    resp = await client.patch(f"/api/v1/rules/{rule_id}", json={"enabled": False}, headers=auth_headers(token))
    assert resp.json()["enabled"] is False
    resp = await client.get("/api/v1/rules", params={"enabled": "false"}, headers=auth_headers(token))
    assert resp.json()["total"] == 1
    # 删除 (软删除)
    resp = await client.delete(f"/api/v1/rules/{rule_id}", headers=auth_headers(token))
    assert resp.status_code == 200
    resp = await client.get("/api/v1/rules", headers=auth_headers(token))
    assert resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_analyzer_creates_issues_and_review_flow(client, session_factory):
    await build_org(session_factory)
    token = await login(client, "superadmin")
    await _create_rule(client, token)
    await _upload(client, token)
    # 重跑分析: mock 转写文本含 "重点介绍了 ... 阿莫西林胶囊"
    resp = await client.post("/api/v1/analysis/rerun", json={}, headers=auth_headers(token))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["issues_created"] == 1
    # 列表
    resp = await client.get("/api/v1/issues", headers=auth_headers(token))
    items = resp.json()["items"]
    assert len(items) == 1
    issue = items[0]
    assert issue["issue_type"] == "夸大疗效表达"
    assert issue["risk"] == "高"
    assert issue["state"] == "待复核"
    assert issue["employee_name"] is None
    issue_id = issue["id"]
    # 详情含命中片段
    resp = await client.get(f"/api/v1/issues/{issue_id}", headers=auth_headers(token))
    detail = resp.json()
    assert len(detail["segments"]) == 1
    assert "重点介绍" in detail["segments"][0]["matched_text"]
    # 复核通过 → 待整改
    resp = await client.post(
        f"/api/v1/issues/{issue_id}/review", json={"approve": True, "comment": "确认"}, headers=auth_headers(token)
    )
    assert resp.status_code == 200
    assert resp.json()["review_status"] == "APPROVED"
    resp = await client.get(f"/api/v1/issues/{issue_id}", headers=auth_headers(token))
    assert resp.json()["state"] == "待整改"
    # 推送整改
    resp = await client.post(f"/api/v1/issues/{issue_id}/push-rectify", json={}, headers=auth_headers(token))
    assert resp.status_code == 201
    assert resp.json()["status"] == "PENDING"
    resp = await client.get(f"/api/v1/issues/{issue_id}", headers=auth_headers(token))
    assert resp.json()["remediation_status"] == "PENDING"
    assert resp.json()["due_date"] is not None
    # 关闭
    resp = await client.post(f"/api/v1/issues/{issue_id}/close", json={}, headers=auth_headers(token))
    assert resp.status_code == 200
    resp = await client.get(f"/api/v1/issues/{issue_id}", headers=auth_headers(token))
    assert resp.json()["state"] == "已完成"


@pytest.mark.asyncio
async def test_issue_dismiss_and_evidence_lock(client, session_factory):
    await build_org(session_factory)
    token = await login(client, "superadmin")
    await _create_rule(client, token)
    audio_id = await _upload(client, token)
    await client.post("/api/v1/analysis/rerun", json={}, headers=auth_headers(token))
    resp = await client.get("/api/v1/issues", headers=auth_headers(token))
    issue_id = resp.json()["items"][0]["id"]
    # 驳回 → 已驳回 + 关闭
    resp = await client.post(
        f"/api/v1/issues/{issue_id}/review", json={"approve": False, "comment": "误报"}, headers=auth_headers(token)
    )
    assert resp.json()["review_status"] == "DISMISSED"
    # 证据锁: 被问题引用的录音不可删除
    resp = await client.delete(f"/api/v1/recordings/{audio_id}", headers=auth_headers(token))
    assert resp.status_code == 400
    assert "证据锁" in resp.text


@pytest.mark.asyncio
async def test_rule_requires_manage_permission(client, session_factory):
    from tests.conftest import create_user

    org = await build_org(session_factory)
    async with session_factory() as session:
        await create_user(session, org["tenant"], username="emp_rules", role_codes=["EMPLOYEE"])
    emp_token = await login(client, "emp_rules")
    resp = await client.get("/api/v1/rules", headers=auth_headers(emp_token))
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_issue_scope_for_store_manager(client, session_factory):
    org = await build_org(session_factory)
    admin = await login(client, "superadmin")
    await _create_rule(client, admin)
    # 两个门店各传一条录音
    for emp_key, store_key in (("emp_a1", "store_a"), ("emp_c1", "store_c")):
        files = {"file": ("rec.wav", b"\x00\x01\x02\x03" * 128, "audio/wav")}
        data = {
            "device_code": "WF-TEST-001",
            "employee_id": str(org[emp_key].id),
            "store_id": str(org[store_key].id),
        }
        resp = await client.post(
            "/api/v1/recordings/upload", files=files, data=data, headers=auth_headers(admin)
        )
        assert resp.status_code == 201
    resp = await client.post("/api/v1/analysis/rerun", json={}, headers=auth_headers(admin))
    assert resp.json()["issues_created"] == 2
    manager = await login(client, "store_a_manager")
    resp = await client.get("/api/v1/issues", headers=auth_headers(manager))
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["store_name"] == "A 店"
