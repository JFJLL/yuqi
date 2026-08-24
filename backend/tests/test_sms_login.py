"""阶段五补充: 员工短信验证码登录 (手机号 → 验证码 → 令牌, 仅本人数据)."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.models.issue import Issue
from tests.conftest import auth_headers, build_org


async def _add_issue(session_factory, org, *, emp, store, issue_no: str) -> None:
    async with session_factory() as session:
        session.add(
            Issue(
                tenant_id=org["tenant"].id,
                issue_no=issue_no,
                store_id=store.id,
                employee_id=emp.id,
                issue_type="夸大疗效表达",
                risk="高",
                quote="重点介绍 阿莫西林胶囊",
                advice="需复核",
                occurred_at=datetime.now(UTC),
            )
        )
        await session.commit()


@pytest.mark.asyncio
async def test_sms_send_and_login(client, session_factory):
    org = await build_org(session_factory)
    await _add_issue(session_factory, org, emp=org["emp_a1"], store=org["store_a"], issue_no="ISS-SMS-001")
    await _add_issue(session_factory, org, emp=org["emp_b1"], store=org["store_b"], issue_no="ISS-SMS-002")

    # 1) 下发验证码 (测试环境固定 123456, 响应带 debug_code)
    resp = await client.post("/api/v1/auth/sms/send", json={"mobile": "13800000001"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["ok"] is True
    assert resp.json()["debug_code"] == "123456"

    # 2) 验证码登录
    resp = await client.post("/api/v1/auth/sms/login", json={"mobile": "13800000001", "code": "123456"})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    assert token

    # 3) 员工仅见本人问题
    mine = await client.get("/api/v1/me/issues", headers=auth_headers(token))
    assert mine.status_code == 200, mine.text
    items = mine.json()["items"]
    assert len(items) == 1
    assert items[0]["issue_no"] == "ISS-SMS-001"


@pytest.mark.asyncio
async def test_sms_wrong_code_and_unknown_mobile(client, session_factory):
    await build_org(session_factory)
    await client.post("/api/v1/auth/sms/send", json={"mobile": "13800000001"})
    resp = await client.post("/api/v1/auth/sms/login", json={"mobile": "13800000001", "code": "000000"})
    assert resp.status_code == 400

    # 未注册手机号: 下发不泄露存在性 (200), 登录失败 (404)
    resp = await client.post("/api/v1/auth/sms/send", json={"mobile": "13999999999"})
    assert resp.status_code == 200
    resp = await client.post("/api/v1/auth/sms/login", json={"mobile": "13999999999", "code": "123456"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_sms_code_rate_limit(client, session_factory):
    await build_org(session_factory)
    await client.post("/api/v1/auth/sms/send", json={"mobile": "13800000001"})
    for _ in range(5):
        resp = await client.post("/api/v1/auth/sms/login", json={"mobile": "13800000001", "code": "000000"})
        assert resp.status_code == 400
    # 尝试次数耗尽后, 即使正确验证码也拒绝
    resp = await client.post("/api/v1/auth/sms/login", json={"mobile": "13800000001", "code": "123456"})
    assert resp.status_code == 400
