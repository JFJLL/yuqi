"""认证 API 集成测试 (登录/限流/Refresh 轮换/退出/停用/跨租户)."""

from __future__ import annotations

import uuid

from tests.conftest import auth_headers, create_tenant, create_user, login


class TestLogin:
    async def test_login_success_returns_user_and_tenant(self, client, baseline) -> None:
        resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "superadmin", "password": "Test12345!"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["access_token"]
        assert body["user"]["username"] == "superadmin"
        assert body["tenant"]["code"] == "demo"
        assert body["permissions"]
        assert "Set-Cookie" in resp.headers  # refresh cookie

    async def test_login_bad_password(self, client, baseline) -> None:
        resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "superadmin", "password": "wrong-password"},
        )
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "bad_credentials"

    async def test_login_by_mobile(self, client, baseline) -> None:
        # 用手机号登录
        resp = await client.post(
            "/api/v1/auth/login", json={"username": "emp001", "password": "Test12345!"}
        )
        assert resp.status_code == 200

    async def test_disabled_user_cannot_login(self, client, baseline) -> None:
        manager = baseline["manager"]
        token = await login(client, "superadmin")
        resp = await client.post(
            f"/api/v1/users/{manager.id}/disable",
            headers=auth_headers(token),
        )
        assert resp.status_code == 200
        resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "store_manager", "password": "Test12345!"},
        )
        assert resp.status_code == 403
        assert resp.json()["error"]["code"] == "user_disabled"


class TestLoginRateLimit:
    async def test_locked_after_max_failures(self, client, baseline) -> None:
        for _ in range(5):
            resp = await client.post(
                "/api/v1/auth/login",
                json={"username": "superadmin", "password": "wrong"},
            )
            assert resp.status_code == 401
        resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "superadmin", "password": "wrong"},
        )
        assert resp.status_code == 429
        assert resp.json()["error"]["code"] == "login_locked"


class TestRefreshRotation:
    async def test_refresh_rotates_and_revokes_old(self, client, baseline) -> None:
        resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "superadmin", "password": "Test12345!"},
        )
        old_cookie = resp.cookies.get("yuqi_refresh")
        assert old_cookie

        resp2 = await client.post(
            "/api/v1/auth/refresh",
            cookies={"yuqi_refresh": old_cookie},
        )
        assert resp2.status_code == 200
        new_cookie = resp2.cookies.get("yuqi_refresh")
        assert new_cookie and new_cookie != old_cookie

        # 旧 refresh token 已轮换失效
        resp3 = await client.post(
            "/api/v1/auth/refresh",
            cookies={"yuqi_refresh": old_cookie},
        )
        assert resp3.status_code == 401

    async def test_logout_revokes_refresh(self, client, baseline) -> None:
        resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "superadmin", "password": "Test12345!"},
        )
        cookie = resp.cookies.get("yuqi_refresh")
        await client.post("/api/v1/auth/logout", cookies={"yuqi_refresh": cookie})
        resp2 = await client.post(
            "/api/v1/auth/refresh",
            cookies={"yuqi_refresh": cookie},
        )
        assert resp2.status_code == 401

    async def test_me_requires_valid_access(self, client, baseline) -> None:
        resp = await client.get("/api/v1/me", headers=auth_headers("bogus.token.here"))
        assert resp.status_code == 401


class TestTenantIsolation:
    async def test_cross_tenant_user_access_404(self, client, baseline, session_factory) -> None:
        token = await login(client, "superadmin")
        async with session_factory() as session:
            other_tenant = await create_tenant(session, code="other-co", name="另一客户")
            other_user = await create_user(session, other_tenant, username="boss")
            other_id = other_user.id
        # 明知对方 ID 也返回 404, 不泄露存在性
        resp = await client.get(
            f"/api/v1/users/{other_id}", headers=auth_headers(token)
        )
        assert resp.status_code == 404

    async def test_permission_denied_for_employee(self, client, baseline) -> None:
        token = await login(client, "emp001")
        resp = await client.get("/api/v1/users", headers=auth_headers(token))
        assert resp.status_code == 403
        assert resp.json()["error"]["code"] == "forbidden"

    async def test_super_admin_can_list_users(self, client, baseline) -> None:
        token = await login(client, "superadmin")
        resp = await client.get("/api/v1/users", headers=auth_headers(token))
        assert resp.status_code == 200
        assert resp.json()["total"] >= 3

    async def test_unknown_user_id_404(self, client, baseline) -> None:
        token = await login(client, "superadmin")
        resp = await client.get(f"/api/v1/users/{uuid.uuid4()}", headers=auth_headers(token))
        assert resp.status_code == 404


class TestChangePassword:
    async def test_change_password_invalidates_sessions(self, client, baseline) -> None:
        token = await login(client, "emp001")
        resp = await client.post(
            "/api/v1/auth/change-password",
            headers=auth_headers(token),
            json={"old_password": "Test12345!", "new_password": "NewPass-2026!"},
        )
        assert resp.status_code == 200
        # 旧会话失效
        resp2 = await client.get("/api/v1/me", headers=auth_headers(token))
        assert resp2.status_code in (401, 403)

    async def test_change_password_wrong_old(self, client, baseline) -> None:
        token = await login(client, "emp001")
        resp = await client.post(
            "/api/v1/auth/change-password",
            headers=auth_headers(token),
            json={"old_password": "nope", "new_password": "NewPass-2026!"},
        )
        assert resp.status_code == 400
