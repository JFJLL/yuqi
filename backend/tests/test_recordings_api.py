"""阶段三: 录音/转写 API 测试 (上传 → mock ASR 完成 → 详情/编辑/版本/删除)."""

from __future__ import annotations

import pytest

from tests.conftest import auth_headers, build_org, login


async def _upload(client, token: str, *, name: str = "rec.wav", extra: dict | None = None) -> dict:
    data = {"device_code": "WF-TEST-001", "language": "zh-CN"}
    if extra:
        data.update(extra)
    files = {"file": (name, b"\x00\x01\x02\x03" * 128, "audio/wav")}
    resp = await client.post(
        "/api/v1/recordings/upload", files=files, data=data, headers=auth_headers(token)
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _build(session_factory):
    org = await build_org(session_factory)
    return org


@pytest.mark.asyncio
async def test_upload_completes_asr_and_detail(client, session_factory):
    await _build(session_factory)
    token = await login(client, "superadmin")
    result = await _upload(client, token)
    audio_id = result["id"]
    # mock ASR 同步完成 → 详情含片段与全文
    resp = await client.get(f"/api/v1/recordings/{audio_id}", headers=auth_headers(token))
    assert resp.status_code == 200, resp.text
    detail = resp.json()
    assert detail["asr_status"] == "succeeded"
    assert detail["segments_json"], "转写片段应为空"
    assert "重点介绍了" in detail["full_text"]
    assert detail["employee_name"] is None  # 未绑定员工
    # 列表
    resp = await client.get("/api/v1/recordings", headers=auth_headers(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["asr_status"] == "succeeded"
    assert body["items"][0]["audio_name"] == "rec.wav"


@pytest.mark.asyncio
async def test_upload_with_employee_binding_and_filters(client, session_factory):
    org = await _build(session_factory)
    token = await login(client, "superadmin")
    await _upload(
        client, token,
        extra={
            "employee_id": str(org["emp_a1"].id),
            "store_id": str(org["store_a"].id),
            "device_code": "WF-TEST-001",
            "occurred_at": "2026-08-01T10:30:00+08:00",
            "hotwords": "头孢 阿莫西林",
        },
    )
    # 关键词过滤 (热词注入转写文本)
    resp = await client.get("/api/v1/recordings", params={"keyword": "头孢"}, headers=auth_headers(token))
    assert resp.json()["total"] == 1
    # 员工过滤
    resp = await client.get(
        "/api/v1/recordings", params={"employee_id": str(org["emp_a1"].id)}, headers=auth_headers(token)
    )
    assert resp.json()["total"] == 1
    # 门店过滤
    resp = await client.get(
        "/api/v1/recordings", params={"store_id": str(org["store_b"].id)}, headers=auth_headers(token)
    )
    assert resp.json()["total"] == 0
    # 详情含员工/门店名
    resp = await client.get("/api/v1/recordings", headers=auth_headers(token))
    item = resp.json()["items"][0]
    assert item["employee_name"] == "店员甲"
    assert item["store_name"] == "A 店"


@pytest.mark.asyncio
async def test_store_manager_scope_limits_list(client, session_factory):
    org = await _build(session_factory)
    admin = await login(client, "superadmin")
    await _upload(
        client, admin,
        extra={"employee_id": str(org["emp_a1"].id), "store_id": str(org["store_a"].id)},
    )
    await _upload(
        client, admin,
        extra={"employee_id": str(org["emp_c1"].id), "store_id": str(org["store_c"].id)},
    )
    manager = await login(client, "store_a_manager")
    resp = await client.get("/api/v1/recordings", headers=auth_headers(manager))
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["store_name"] == "A 店"
    # 店长访问其他门店详情 → 404
    resp = await client.get("/api/v1/recordings", headers=auth_headers(admin))
    c_item = next(i for i in resp.json()["items"] if i["store_name"] == "C 店")
    resp = await client.get(f"/api/v1/recordings/{c_item['id']}", headers=auth_headers(manager))
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_employee_role_cannot_upload(client, session_factory):
    from tests.conftest import create_user

    org = await _build(session_factory)
    async with session_factory() as session:
        await create_user(session, org["tenant"], username="emp_rec", role_codes=["EMPLOYEE"])
    emp_token = await login(client, "emp_rec")
    files = {"file": ("rec.wav", b"data" * 64, "audio/wav")}
    resp = await client.post("/api/v1/recordings/upload", files=files, headers=auth_headers(emp_token))
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_edit_transcript_creates_version(client, session_factory):
    await _build(session_factory)
    token = await login(client, "superadmin")
    audio_id = (await _upload(client, token))["id"]
    resp = await client.get(f"/api/v1/recordings/{audio_id}", headers=auth_headers(token))
    detail = resp.json()
    new_text = "人工修正后的完整转写文本。"
    resp = await client.patch(
        f"/api/v1/recordings/{audio_id}/transcript",
        json={
            "segments": [
                {"text": "人工修正后的完整转写文本。", "start_ms": 0, "end_ms": 1000, "speaker": "staff"}
            ],
            "full_text": new_text,
            "summary": new_text[:50],
            "marks": [{"speaker": "staff", "start_ms": 0, "color": "red", "note": "重点"}],
            "speaker_aliases": {"staff": "店员"},
            "edit_reason": "人工复核修正",
        },
        headers=auth_headers(token),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["version"] == 2
    # 详情反映新版本
    resp = await client.get(f"/api/v1/recordings/{audio_id}", headers=auth_headers(token))
    detail = resp.json()
    assert detail["full_text"] == new_text
    assert detail["current_version"] == 2
    assert detail["speaker_aliases"] == {"staff": "店员"}
    assert detail["marks_json"][0]["note"] == "重点"
    # 版本历史
    resp = await client.get(f"/api/v1/recordings/{audio_id}/versions", headers=auth_headers(token))
    versions = resp.json()
    assert len(versions) == 2
    assert versions[0]["version_no"] == 2
    assert versions[0]["source"] == "MANUAL_EDIT"
    assert versions[1]["version_no"] == 1
    assert versions[1]["source"] == "ASR"


@pytest.mark.asyncio
async def test_retry_failed_and_delete(client, session_factory):
    await _build(session_factory)
    token = await login(client, "superadmin")
    audio_id = (await _upload(client, token))["id"]
    # 重试 (已完成的任务会关闭旧任务并重新入队)
    resp = await client.post(f"/api/v1/recordings/{audio_id}/retry", headers=auth_headers(token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "succeeded"
    # 软删除
    resp = await client.delete(f"/api/v1/recordings/{audio_id}", headers=auth_headers(token))
    assert resp.status_code == 200
    resp = await client.get(f"/api/v1/recordings/{audio_id}", headers=auth_headers(token))
    assert resp.status_code == 404
    # 列表不再出现
    resp = await client.get("/api/v1/recordings", headers=auth_headers(token))
    assert resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_summary_endpoint(client, session_factory):
    await _build(session_factory)
    token = await login(client, "superadmin")
    await _upload(client, token)
    resp = await client.get("/api/v1/recordings/summary", headers=auth_headers(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["done_count"] == 1


@pytest.mark.asyncio
async def test_internal_ingest_requires_token(client, session_factory):
    await _build(session_factory)
    resp = await client.post(
        "/api/v1/internal/ingest/audio",
        json={"tenant_code": "orgco", "object_key": "x/y.wav"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_internal_ingest_idempotent(client, session_factory):
    org = await _build(session_factory)
    headers = {"X-Service-Token": "dev-internal-token"}
    payload = {
        "tenant_code": "orgco",
        "object_key": f"tenant/{org['dev1'].device_code}/2026/08/a.wav",
        "file_name": "a.wav",
        "size_bytes": 1024,
        "device_code": "WF-TEST-001",
        "occurred_at": "2026-08-01T09:00:00+08:00",
    }
    resp = await client.post("/api/v1/internal/ingest/audio", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    assert resp.json()["duplicate"] is False
    # 关联到活跃绑定员工 (WF-TEST-001 未绑定 → employee 为空; 绑定后重测)
    resp2 = await client.post("/api/v1/internal/ingest/audio", json=payload, headers=headers)
    assert resp2.status_code == 201
    assert resp2.json()["duplicate"] is True
    assert resp2.json()["id"] == resp.json()["id"]


@pytest.mark.asyncio
async def test_internal_ingest_resolves_binding(client, session_factory):
    org = await _build(session_factory)
    admin = await login(client, "superadmin")
    # 绑定 dev1 → emp_a1
    resp = await client.post(
        "/api/v1/devices/bind",
        json={"device_id": str(org["dev1"].id), "employee_id": str(org["emp_a1"].id)},
        headers=auth_headers(admin),
    )
    assert resp.status_code == 201, resp.text
    headers = {"X-Service-Token": "dev-internal-token"}
    payload = {
        "tenant_code": "orgco",
        "object_key": "tenant/bound/b.wav",
        "file_name": "b.wav",
        "device_code": "WF-TEST-001",
        "occurred_at": "2026-08-01T09:00:00+08:00",
    }
    resp = await client.post("/api/v1/internal/ingest/audio", json=payload, headers=headers)
    assert resp.status_code == 201
    audio_id = resp.json()["id"]
    resp = await client.get(f"/api/v1/recordings/{audio_id}", headers=auth_headers(admin))
    detail = resp.json()
    assert detail["employee_name"] == "店员甲"
    assert detail["store_name"] == "A 店"
    assert detail["source"] == "oss_auto"


@pytest.mark.asyncio
async def test_internal_asr_callback(client, session_factory):
    await _build(session_factory)
    admin = await login(client, "superadmin")
    audio_id = (await _upload(client, admin))["id"]
    # 直接通过 API 重试后回调: 重试会创建新任务, 用其 job id 回调
    resp = await client.post(f"/api/v1/recordings/{audio_id}/retry", headers=auth_headers(admin))
    job_id = resp.json()["asr_job"]
    headers = {"X-Service-Token": "dev-internal-token"}
    cb = {
        "job_id": job_id,
        "status": "succeeded",
        "segments": [
            {"text": "回调文本", "start_ms": 0, "end_ms": 500, "speaker": "staff"},
            {"text": "顾客回复", "start_ms": 500, "end_ms": 900, "speaker": "customer"},
        ],
        "full_text": "回调文本\n顾客回复",
    }
    resp = await client.post("/api/v1/internal/asr/callback", json=cb, headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "succeeded"
    resp = await client.get(f"/api/v1/recordings/{audio_id}", headers=auth_headers(admin))
    detail = resp.json()
    assert detail["full_text"] == "回调文本\n顾客回复"
    assert len(detail["segments_json"]) == 2
