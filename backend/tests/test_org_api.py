"""组织/员工 API 测试: 组织树 / 手机号脱敏 / 数据范围."""

from __future__ import annotations

from app.models.org import Employee
from tests.conftest import auth_headers, build_org, create_tenant, create_user, login


class TestOrgTree:
    async def test_tree_structure(self, client, session_factory) -> None:
        _ = await build_org(session_factory)
        token = await login(client, "superadmin")
        resp = await client.get("/api/v1/org/tree", headers=auth_headers(token))
        assert resp.status_code == 200
        tree = resp.json()
        assert len(tree) == 1  # 总部
        assert tree[0]["code"] == "HQ1"
        assert {r["code"] for r in tree[0]["children"]} == {"R-E", "R-S"}

    async def test_create_org_node(self, client, session_factory) -> None:
        org = await build_org(session_factory)
        token = await login(client, "superadmin")
        resp = await client.post(
            "/api/v1/org/nodes",
            headers=auth_headers(token),
            json={"parent_id": str(org["east"].id), "node_type": "STORE", "name": "新店", "code": "S-NEW"},
        )
        assert resp.status_code == 201
        assert resp.json()["code"] == "S-NEW"

    async def test_duplicate_org_code_400(self, client, session_factory) -> None:
        _ = await build_org(session_factory)
        token = await login(client, "superadmin")
        resp = await client.post(
            "/api/v1/org/nodes",
            headers=auth_headers(token),
            json={"node_type": "REGION", "name": "重复", "code": "R-E"},
        )
        assert resp.status_code == 400


class TestEmployeeList:
    async def test_mobile_is_masked(self, client, session_factory) -> None:
        _ = await build_org(session_factory)
        token = await login(client, "superadmin")
        resp = await client.get("/api/v1/employees", headers=auth_headers(token))
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 4
        item = body["items"][0]
        # 列表默认不返回完整手机号
        assert item["mobile"] is None
        assert item["mobile_masked"] and "*" in item["mobile_masked"]
        assert item["mobile_masked"] == "138****0001"

    async def test_keyword_filter(self, client, session_factory) -> None:
        _ = await build_org(session_factory)
        token = await login(client, "superadmin")
        resp = await client.get("/api/v1/employees?keyword=店员甲", headers=auth_headers(token))
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["name"] == "店员甲"

    async def test_region_and_job_title_filter(self, client, session_factory) -> None:
        org = await build_org(session_factory)
        token = await login(client, "superadmin")
        # 给店员甲设置岗位
        async with session_factory() as session:
            emp = await session.get(Employee, org["emp_a1"].id)
            emp.job_title = "店长"
            await session.commit()
        # 华东区域 (east) 下有 A/B 店 → 店员甲/乙/丙
        resp = await client.get(
            f"/api/v1/employees?region_id={org['east'].id}", headers=auth_headers(token)
        )
        assert resp.status_code == 200
        names = {i["name"] for i in resp.json()["items"]}
        assert names == {"店员甲", "店员乙", "店员丙"}
        # 岗位过滤
        resp2 = await client.get("/api/v1/employees?job_title=店长", headers=auth_headers(token))
        assert resp2.status_code == 200
        assert [i["name"] for i in resp2.json()["items"]] == ["店员甲"]


class TestDataScope:
    async def test_store_manager_sees_only_own_store(self, client, session_factory) -> None:
        _ = await build_org(session_factory)
        token = await login(client, "store_a_manager")
        resp = await client.get("/api/v1/employees", headers=auth_headers(token))
        assert resp.status_code == 200
        body = resp.json()
        names = {i["name"] for i in body["items"]}
        assert names == {"店员甲", "店员乙"}  # 仅 A 店

    async def test_store_manager_cannot_create_employee(self, client, session_factory) -> None:
        _ = await build_org(session_factory)
        token = await login(client, "store_a_manager")
        resp = await client.post(
            "/api/v1/employees",
            headers=auth_headers(token),
            json={"employee_no": "X01", "name": "越权", "mobile": "13900000000"},
        )
        assert resp.status_code == 403

    async def test_employee_self_scope(self, client, session_factory) -> None:
        """普通员工无 employee:read 权限 → 403 (前端菜单隐藏不替代后端校验)."""

        org = await build_org(session_factory)
        # 为员工 A001 建用户并授予 EMPLOYEE 角色
        async with session_factory() as session:
            emp = await session.get(Employee, org["emp_a1"].id)
            employee_user = await create_user(
                session, org["tenant"], username="emp_a1_user", role_codes=["EMPLOYEE"]
            )
            employee_user.employee_id = emp.id
            await session.commit()
        token = await login(client, "emp_a1_user")
        resp = await client.get("/api/v1/employees", headers=auth_headers(token))
        assert resp.status_code == 403

    async def test_cross_tenant_employee_404(self, client, session_factory) -> None:
        _ = await build_org(session_factory)
        token = await login(client, "superadmin")
        # 另一租户员工
        async with session_factory() as session:
            other = await create_tenant(session, code="other-org", name="另一组织")
            other_emp = Employee(
                tenant_id=other.id, employee_no="O1", name="他人", mobile="13700000000"
            )
            session.add(other_emp)
            await session.commit()
            other_id = other_emp.id
        resp = await client.get("/api/v1/employees?keyword=他人", headers=auth_headers(token))
        assert resp.status_code == 200
        assert resp.json()["total"] == 0  # 另一租户数据不可见
        assert other_id is not None
