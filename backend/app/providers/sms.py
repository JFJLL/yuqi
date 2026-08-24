"""短信验证码 Provider 抽象.

生产接入真实短信网关 (阿里云/腾讯云等) 时实现 SmsProvider;
开发/测试用 MockSmsProvider: 验证码写入日志, 并在非生产环境由端点返回 debug_code。
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger("yuqi.sms")


class SmsProvider:
    async def send_code(self, mobile: str, code: str, *, tenant_id: str | None = None) -> None:
        raise NotImplementedError


class MockSmsProvider(SmsProvider):
    """开发/测试: 验证码打到日志; 调用方可自行选择是否在响应中附带 debug_code."""

    async def send_code(self, mobile: str, code: str, *, tenant_id: str | None = None) -> None:
        logger.info("sms_mock_send mobile=%s code=%s tenant=%s", mobile, code, tenant_id)
        # 模拟网络延迟, 贴近真实调用
        await asyncio.sleep(0)


def get_sms_provider(settings: Any) -> SmsProvider:
    """按配置返回短信 Provider: SMS_PROVIDER=mock (默认, 日志+debug_code)."""
    provider_name = getattr(settings, "sms_provider", "mock")
    if provider_name in ("mock", "log"):
        return MockSmsProvider()
    # 预留: 真实网关实现接入点
    raise NotImplementedError(f"未实现的短信 Provider: {provider_name}")


# ---- 验证码存储 (内存, 仅开发/测试; 生产应改用 Redis 或真实网关回执) ----
_SMS_STORE: dict[str, tuple[str, float, int]] = {}  # mobile -> (code, expires_at_ts, failed_attempts)


def store_sms_code(mobile: str, code: str, ttl_seconds: int) -> None:
    import time

    _SMS_STORE[mobile] = (code, time.time() + ttl_seconds, 0)


def verify_sms_code(mobile: str, code: str, *, max_attempts: int = 5) -> bool:
    import time

    entry = _SMS_STORE.get(mobile)
    if entry is None:
        return False
    stored_code, expires_at, failed = entry
    if time.time() > expires_at:
        _SMS_STORE.pop(mobile, None)
        return False
    if failed >= max_attempts:
        return False
    if stored_code == code:
        _SMS_STORE.pop(mobile, None)
        return True
    _SMS_STORE[mobile] = (stored_code, expires_at, failed + 1)
    return False



