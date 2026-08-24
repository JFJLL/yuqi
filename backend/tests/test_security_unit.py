"""安全单元测试: 密码哈希 / Refresh Token 哈希 / 数据范围逻辑."""

from __future__ import annotations

import uuid

import pytest

from app.core.security import (
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)
from app.services.security_context import DataScopeService, TenantContext


class TestPasswordHashing:
    def test_hash_and_verify(self) -> None:
        h = hash_password("S3cure-Pass!")
        assert h != "S3cure-Pass!"
        assert verify_password("S3cure-Pass!", h)

    def test_wrong_password_fails(self) -> None:
        h = hash_password("correct-horse")
        assert not verify_password("wrong", h)
        assert not verify_password("", h)

    def test_hash_is_salted(self) -> None:
        assert hash_password("same") != hash_password("same")


class TestRefreshTokenHashing:
    def test_hash_is_sha256_hex(self) -> None:
        raw = new_refresh_token()
        assert len(raw) >= 32
        h = hash_refresh_token(raw)
        assert len(h) == 64
        assert h == hash_refresh_token(raw)
        assert h != hash_refresh_token("other")

    def test_raw_token_not_recoverable(self) -> None:
        raw = new_refresh_token()
        assert raw not in hash_refresh_token(raw)


def make_ctx(*, scopes: list[str], org_ids: list[uuid.UUID] | None = None) -> TenantContext:
    return TenantContext(
        user=None,  # type: ignore[arg-type]  # 仅测数据范围
        tenant_id=uuid.uuid4(),
        data_scope_types=scopes,
        org_node_ids=set(org_ids or []),
    )


class TestDataScopeService:
    def test_all_scope_sees_everything(self) -> None:
        svc = DataScopeService(make_ctx(scopes=["ALL"]))
        assert svc.can_see_all
        assert svc.sees_org(uuid.uuid4())
        assert svc.sees_store(uuid.uuid4())
        assert svc.sees_employee(uuid.uuid4())

    def test_org_tree_scope_only_own_node(self) -> None:
        own = uuid.uuid4()
        svc = DataScopeService(make_ctx(scopes=["ORG_TREE"], org_ids=[own]))
        assert svc.sees_org(own)
        assert not svc.sees_org(uuid.uuid4())

    def test_self_scope_only_self_employee(self) -> None:
        me = uuid.uuid4()
        ctx = make_ctx(scopes=["SELF"])
        ctx.employee_id = me
        svc = DataScopeService(ctx)
        assert svc.sees_employee(me)
        assert not svc.sees_employee(uuid.uuid4())

    def test_cross_tenant_always_404(self) -> None:
        ctx = make_ctx(scopes=["ALL"])
        svc = DataScopeService(ctx)
        other = uuid.uuid4()
        with pytest.raises(Exception) as exc:
            svc.assert_visible(tenant_id=other)
        assert getattr(exc.value, "status_code", None) == 404
