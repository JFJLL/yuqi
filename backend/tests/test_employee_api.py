"""阶段五: 员工自服务 (我的问题/申诉/整改) + 通知 + SLA 升级."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from tests.conftest import auth_headers, build_org, create_user, login


async def _setup_employee(session_factory, org) -> str:
    """创建关联 emp_a1 的员工账号, 返回用户名."""
    async with session_factory() as session:
        emp_user = await create_user(session, org["tenant"], username="emp_a1_user", role_codes=["EMPLOYEE"])
        emp_user.employee_id = org["emp_a1"].id
        await session.commit()
    return "emp_a1_user"


async def _upload_and_analyze(client, token: str, employee_id: str | None = None, store_id: str | None = None) -> str:
    files = {"file": ("rec.wav", b"\x00\x01\x02\x03" * 128, "audio/wav")}
    data = {"device_code": "WF-TEST-001"}
    if employee_id:
        data["employee_id"] = employee_id
    if store_id:
        data["store_id"] = store_id
    resp = await client.post("/api/v1/recordings/upload", files=files, data=data, headers=auth_headers(token))
    assert resp.status_code == 201, resp.text
    audio_id = resp.json()["id"]
    resp = await client.post("/api/v1/analysis/rerun", json={}, headers=auth_headers(token))
    assert resp.status_code == 200
    assert resp.json()["issues_created"] >= 1
    return audio_id


async def _create_rule(client, token: str) -> None:
    resp = await client.post(
        "/api/v1/rules",
        json={
            "code": "R-TEST",
            "name": "测试规则",
            "category": "夸大疗效表达",
            "severity": "high",
            "keywords": ["重点介绍", "阿莫西林"],
        },
        headers=auth_headers(token),
    )
    assert resp.status_code == 201, resp.text


@pytest.mark.asyncio
async def test_employee_self_service_flow(client, session_factory):
    org = await build_org(session_factory)
    admin = await login(client, "superadmin")
    emp_username = await _setup_employee(session_factory, org)
    await _create_rule(client, admin)
    await _upload_and_analyze(client, admin, str(org["emp_a1"].id), str(org["store_a"].id))

    emp_token = await login(client, emp_username)
    # 我的问题
    resp = await client.get("/api/v1/me/issues", headers=auth_headers(emp_token))
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    issue_id = items[0]["id"]
    assert items[0]["appeal_status"] == "NONE"
    # 越权: 员工访问他人问题详情 → 404
    resp = await client.get(f"/api/v1/issues/{issue_id}", headers=auth_headers(emp_token))
    assert resp.status_code == 403
    # 发起申诉
    resp = await client.post(
        f"/api/v1/me/issues/{issue_id}/appeal",
        json={"reason": "该片段为顾客复述，并非我承诺疗效"},
        headers=auth_headers(emp_token),
    )
    assert resp.status_code == 200
    assert resp.json()["appeal_status"] == "APPEALING"
    # 管理端申诉队列
    resp = await client.get("/api/v1/appeals", headers=auth_headers(admin))
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 1
    assert resp.json()["items"][0]["appeal_reason"].startswith("该片段")
    # 申诉通过 → 问题关闭
    resp = await client.post(
        f"/api/v1/issues/{issue_id}/appeal-review",
        json={"approve": True, "comment": "申诉成立"},
        headers=auth_headers(admin),
    )
    assert resp.status_code == 200
    assert resp.json()["appeal_status"] == "APPEAL_APPROVED"
    resp = await client.get(f"/api/v1/issues/{issue_id}", headers=auth_headers(admin))
    assert resp.json()["close_status"] == "CLOSED"
    assert resp.json()["state"] == "已完成"


@pytest.mark.asyncio
async def test_rectification_submit_confirm_flow(client, session_factory):
    org = await build_org(session_factory)
    admin = await login(client, "superadmin")
    emp_username = await _setup_employee(session_factory, org)
    await _create_rule(client, admin)
    await _upload_and_analyze(client, admin, str(org["emp_a1"].id), str(org["store_a"].id))
    resp = await client.get("/api/v1/issues", headers=auth_headers(admin))
    issue_id = resp.json()["items"][0]["id"]
    # 管理端复核通过后推送整改
    await client.post(f"/api/v1/issues/{issue_id}/review", json={"approve": True}, headers=auth_headers(admin))
    resp = await client.post(f"/api/v1/issues/{issue_id}/push-rectify", json={}, headers=auth_headers(admin))
    assert resp.status_code == 201
    rect_id = resp.json()["rectify_task_id"]

    emp_token = await login(client, emp_username)
    resp = await client.get("/api/v1/me/rectifications", headers=auth_headers(emp_token))
    assert resp.json()["total"] == 1
    # 员工提交整改
    resp = await client.post(
        f"/api/v1/me/rectifications/{rect_id}/submit",
        json={"comment": "已加强用药提醒培训"},
        headers=auth_headers(emp_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "SUBMITTED"
    # 管理端确认
    resp = await client.post(
        f"/api/v1/rectifications/{rect_id}/confirm",
        json={"approve": True, "comment": "确认完成"},
        headers=auth_headers(admin),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "CONFIRMED"
    resp = await client.get(f"/api/v1/issues/{issue_id}", headers=auth_headers(admin))
    assert resp.json()["remediation_status"] == "CONFIRMED"
    assert resp.json()["state"] == "已完成"
    # 列表页统计
    resp = await client.get("/api/v1/rectifications/summary", headers=auth_headers(admin))
    assert resp.json()["confirmed"] == 1
    assert resp.json()["completion_rate"] == 100


@pytest.mark.asyncio
async def test_notifications_and_read(client, session_factory):
    org = await build_org(session_factory)
    emp_username = await _setup_employee(session_factory, org)
    # 建一个合规专员账号并给该角色发通知
    async with session_factory() as session:
        await create_user(session, org["tenant"], username="compliance1", role_codes=["COMPLIANCE"])
        from app.modules.notifications.service import NotificationService

        notify = NotificationService(session)
        await notify.create_for_role(
            tenant_id=org["tenant"].id,
            role_codes=["COMPLIANCE"],
            title="测试通知",
            body="内容",
            notif_type="TEST",
        )
        await session.commit()
    compliance_token = await login(client, "compliance1")
    resp = await client.get("/api/v1/notifications/unread-count", headers=auth_headers(compliance_token))
    assert resp.json()["count"] == 1
    resp = await client.get("/api/v1/notifications", headers=auth_headers(compliance_token))
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["read"] is False
    notif_id = items[0]["id"]
    resp = await client.post(
        "/api/v1/notifications/read", json={"id": notif_id}, headers=auth_headers(compliance_token)
    )
    assert resp.json()["marked"] == 1
    resp = await client.get("/api/v1/notifications/unread-count", headers=auth_headers(compliance_token))
    assert resp.json()["count"] == 0
    # 员工看不到管理端通知
    emp_token = await login(client, emp_username)
    resp = await client.get("/api/v1/notifications", headers=auth_headers(emp_token))
    assert resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_sla_scan_escalates_overdue(client, session_factory):
    org = await build_org(session_factory)
    admin = await login(client, "superadmin")
    emp_username = await _setup_employee(session_factory, org)
    await _create_rule(client, admin)
    await _upload_and_analyze(client, admin, str(org["emp_a1"].id), str(org["store_a"].id))
    resp = await client.get("/api/v1/issues", headers=auth_headers(admin))
    issue_id = resp.json()["items"][0]["id"]
    await client.post(f"/api/v1/issues/{issue_id}/review", json={"approve": True}, headers=auth_headers(admin))
    resp = await client.post(
        f"/api/v1/issues/{issue_id}/push-rectify",
        json={"due_date": (date.today() - timedelta(days=1)).isoformat()},
        headers=auth_headers(admin),
    )
    rect_id = resp.json()["rectify_task_id"]
    # 执行 SLA 扫描
    from app.workers.scheduler import run_sla_scan

    await run_sla_scan(session_factory)
    async with session_factory() as session:
        from app.models.issue import Rectification

        rect = await session.get(Rectification, __import__("uuid").UUID(rect_id))  # noqa: PLC0415
        assert rect is not None
        assert rect.escalation_count == 1
        assert rect.escalated_at is not None
    resp = await client.get("/api/v1/rectifications/summary", headers=auth_headers(admin))
    assert resp.json()["overdue"] == 1
    assert resp.json()["escalated"] == 1
    # 员工收到逾期通知
    emp_token = await login(client, emp_username)
    resp = await client.get("/api/v1/notifications", headers=auth_headers(emp_token))
    assert any(n["notif_type"] == "RECTIFY_DUE" for n in resp.json()["items"])
