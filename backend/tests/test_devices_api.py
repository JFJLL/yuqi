"""设备/绑定/知情同意 API 测试: 唯一设备码 / 绑定冲突 / 历史 / 审批 / 同意."""

from __future__ import annotations

from tests.conftest import auth_headers, build_org, login


class TestDeviceCreate:
    async def test_create_device_and_unique_code(self, client, session_factory) -> None:
        _ = await build_org(session_factory)
        token = await login(client, "superadmin")
        resp = await client.post(
            "/api/v1/devices",
            headers=auth_headers(token),
            json={"device_code": "WF-NEW-001", "device_type": "BADGE", "vendor": "厂商X"},
        )
        assert resp.status_code == 201
        resp2 = await client.post(
            "/api/v1/devices",
            headers=auth_headers(token),
            json={"device_code": "WF-NEW-001"},
        )
        assert resp2.status_code == 400
        assert resp2.json()["error"]["code"] == "device_code_exists"

    async def test_list_devices_paginated(self, client, session_factory) -> None:
        _ = await build_org(session_factory)
        token = await login(client, "superadmin")
        resp = await client.get("/api/v1/devices", headers=auth_headers(token))
        assert resp.status_code == 200
        assert resp.json()["total"] >= 2


class TestBinding:
    async def test_bind_then_conflict(self, client, session_factory) -> None:
        org = await build_org(session_factory)
        token = await login(client, "superadmin")
        h = auth_headers(token)
        resp = await client.post(
            "/api/v1/devices/bind",
            headers=h,
            json={"device_id": str(org["dev1"].id), "employee_id": str(org["emp_a1"].id)},
        )
        assert resp.status_code == 201
        assert resp.json()["binding_status"] == "ACTIVE"
        # 同一设备二次绑定 → 409 冲突
        resp2 = await client.post(
            "/api/v1/devices/bind",
            headers=h,
            json={"device_id": str(org["dev1"].id), "employee_id": str(org["emp_a2"].id)},
        )
        assert resp2.status_code == 409
        assert resp2.json()["error"]["code"] == "binding_conflict"

    async def test_unbind_then_rebind_history(self, client, session_factory) -> None:
        org = await build_org(session_factory)
        token = await login(client, "superadmin")
        h = auth_headers(token)
        await client.post(
            "/api/v1/devices/bind",
            headers=h,
            json={"device_id": str(org["dev2"].id), "employee_id": str(org["emp_a1"].id)},
        )
        await client.post(
            "/api/v1/devices/unbind", headers=h, json={"device_id": str(org["dev2"].id)}
        )
        resp = await client.post(
            "/api/v1/devices/bind",
            headers=h,
            json={"device_id": str(org["dev2"].id), "employee_id": str(org["emp_a2"].id)},
        )
        assert resp.status_code == 201
        hist = await client.get(
            f"/api/v1/devices/{org['dev2'].id}/bindings", headers=h
        )
        assert hist.status_code == 200
        assert len(hist.json()) == 2  # 绑定历史保留, 不覆盖

    async def test_binding_request_review_requires_consent(self, client, session_factory) -> None:
        """审批通过但员工无知情同意 → 拒绝激活."""

        org = await build_org(session_factory)
        token = await login(client, "superadmin")
        h = auth_headers(token)
        from app.models.device import DeviceBindingRequest

        async with session_factory() as session:
            req = DeviceBindingRequest(
                tenant_id=org["tenant"].id,
                device_id=org["dev1"].id,
                employee_id=org["emp_a1"].id,
                status="PENDING",
            )
            session.add(req)
            await session.commit()
            req_id = req.id
        resp = await client.post(
            f"/api/v1/binding-requests/{req_id}/review",
            headers=h,
            json={"approve": True},
        )
        # 无知情同意 → 400 consent_required
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "consent_required"

    async def test_consent_then_approve_binds(self, client, session_factory) -> None:
        org = await build_org(session_factory)
        token = await login(client, "superadmin")
        h = auth_headers(token)
        # 确认知情同意
        resp = await client.post(
            "/api/v1/consents",
            headers=h,
            json={
                "employee_id": str(org["emp_a1"].id),
                "policy_name": "录音知情同意制度",
                "policy_version": "v1",
                "content_hash": "a" * 64,
            },
        )
        assert resp.status_code == 201
        from app.models.device import DeviceBindingRequest

        async with session_factory() as session:
            req = DeviceBindingRequest(
                tenant_id=org["tenant"].id,
                device_id=org["dev1"].id,
                employee_id=org["emp_a1"].id,
                status="PENDING",
            )
            session.add(req)
            await session.commit()
            req_id = req.id
        resp = await client.post(
            f"/api/v1/binding-requests/{req_id}/review",
            headers=h,
            json={"approve": True, "comment": "同意绑定"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "APPROVED"

    async def test_binding_history_never_overwrites(self, client, session_factory) -> None:
        org = await build_org(session_factory)
        token = await login(client, "superadmin")
        h = auth_headers(token)
        for emp in (org["emp_a1"], org["emp_a2"]):
            await client.post(
                "/api/v1/devices/bind",
                headers=h,
                json={"device_id": str(org["dev2"].id), "employee_id": str(emp.id)},
            )
            await client.post(
                "/api/v1/devices/unbind", headers=h, json={"device_id": str(org["dev2"].id)}
            )
        hist = await client.get(f"/api/v1/devices/{org['dev2'].id}/bindings", headers=h)
        assert len(hist.json()) == 2


class TestDeviceSummaryAndEvents:
    async def test_list_devices_enriches_binding(self, client, session_factory) -> None:
        org = await build_org(session_factory)
        token = await login(client, "superadmin")
        h = auth_headers(token)
        await client.post(
            "/api/v1/devices/bind",
            headers=h,
            json={"device_id": str(org["dev1"].id), "employee_id": str(org["emp_a1"].id)},
        )
        resp = await client.get("/api/v1/devices", headers=h)
        assert resp.status_code == 200
        by_code = {d["device_code"]: d for d in resp.json()["items"]}
        bound = by_code["WF-TEST-001"]
        assert bound["bound"] is True
        assert bound["employee_name"] == "店员甲"
        free = by_code["WF-TEST-002"]
        assert free["bound"] is False
        assert free["employee_name"] is None

    async def test_device_summary_server_computed(self, client, session_factory) -> None:
        org = await build_org(session_factory)
        token = await login(client, "superadmin")
        h = auth_headers(token)
        await client.post(
            "/api/v1/devices/bind",
            headers=h,
            json={"device_id": str(org["dev1"].id), "employee_id": str(org["emp_a1"].id)},
        )
        resp = await client.get("/api/v1/devices/summary", headers=h)
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 2
        assert body["bound"] == 1
        assert body["unbound"] == 1
        assert body["online"] + body["offline"] == 2

    async def test_device_events_from_audit(self, client, session_factory) -> None:
        org = await build_org(session_factory)
        token = await login(client, "superadmin")
        h = auth_headers(token)
        await client.post(
            "/api/v1/devices/bind",
            headers=h,
            json={"device_id": str(org["dev1"].id), "employee_id": str(org["emp_a1"].id)},
        )
        resp = await client.get("/api/v1/device-events", headers=h)
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 1
        event = body["items"][0]
        assert event["type"] == "操控"
        assert event["status"] == "成功"
        assert event["device_code"] == "WF-TEST-001"
        assert event["employee_name"] == "店员甲"
