"""异步任务队列抽象.

生产使用 ARQ (Redis); 测试/开发无 Redis 时使用 InMemoryTaskQueue,
保证业务代码不依赖具体队列实现。
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from app.core.logging import get_logger

logger = get_logger("yuqi.queue")

JobFunc = Callable[..., Awaitable[Any]]


class TaskQueue:
    async def enqueue(self, job_name: str, *, job_id: str | None = None, **kwargs: Any) -> str | None:
        raise NotImplementedError

    async def close(self) -> None:  # pragma: no cover - 默认
        return None


@dataclass
class InMemoryTaskQueue(TaskQueue):
    """同步执行的测试/开发队列: 真实调用 job 函数, 保留入队语义."""

    functions: dict[str, JobFunc]
    _running: list[asyncio.Task] = field(default_factory=list)

    async def enqueue(self, job_name: str, *, job_id: str | None = None, **kwargs: Any) -> str | None:
        fn = self.functions.get(job_name)
        if fn is None:
            logger.warning("queue_unknown_job", job=job_name)
            return None
        # 直接 await 保证测试确定性; 捕获异常避免吞掉任务失败
        try:
            await fn(**kwargs)
        except Exception:  # noqa: BLE001
            logger.exception("queue_job_failed", job=job_name, job_id=job_id)
            raise
        return job_id


class ArqTaskQueue(TaskQueue):
    """ARQ (Redis) 队列."""

    def __init__(self, redis_settings: Any = None, functions: dict[str, JobFunc] | None = None) -> None:
        from arq import create_pool

        self._create_pool: Any = create_pool
        self._redis_settings: Any = redis_settings or {}
        self._functions = functions or {}

    async def enqueue(self, job_name: str, *, job_id: str | None = None, **kwargs: Any) -> str | None:
        pool = await self._create_pool(self._redis_settings)
        try:
            await pool.enqueue_job(job_name, **kwargs)
            return job_id
        finally:
            await pool.aclose()
