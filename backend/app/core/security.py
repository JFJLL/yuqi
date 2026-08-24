"""密码哈希 (Argon2id)、JWT Access Token、Refresh Token 工具."""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import Settings

_ph = PasswordHasher()


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _ph.verify(password_hash, password)
    except (VerifyMismatchError, ValueError):
        return False


def hash_refresh_token(token: str) -> str:
    """Refresh Token 只以哈希形式入库, 数据库泄露不直接可复用."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def create_access_token(user_id: str, tenant_id: str, settings: Settings, token_version: int = 0) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "tenant_id": str(tenant_id),
        "type": "access",
        "ver": token_version,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_access_ttl_minutes),
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.access_token_algorithm)


def decode_access_token(token: str, settings: Settings) -> dict:
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.access_token_algorithm],
    )
