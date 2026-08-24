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
    """同步执行的测试/开发队列: 真实调用 job 函数, 保留入队语义.

    约定: `job_id` 作为 kwargs 一并透传给任务函数 (与 ARQ 行为一致),
    保证 Worker 与内存队列对任务函数的签名要求相同。
    """

    functions: dict[str, JobFunc]
    _running: list[asyncio.Task] = field(default_factory=list)

    async def enqueue(self, job_name: str, *, job_id: str | None = None, **kwargs: Any) -> str | None:
        fn = self.functions.get(job_name)
        if fn is None:
            logger.warning("queue_unknown_job", job=job_name)
            return None
        # 直接 await 保证测试确定性; 捕获异常避免吞掉任务失败
        try:
            await fn(**kwargs, job_id=job_id)
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


def default_worker_functions() -> dict[str, JobFunc]:
    """注册业务任务函数 (与 app.workers.worker.WORKER_FUNCTIONS 保持同步)."""
    from app.modules.ingestion.service import run_asr_job

    return {
        "run_asr_job": run_asr_job,
    }


def get_task_queue(settings: Any) -> TaskQueue:
    """按配置返回队列: Redis 启用 → ARQ; 否则内存同步队列 (测试/开发确定性)."""
    functions = default_worker_functions()
    if settings.redis_enabled and not str(settings.database_url).startswith("sqlite"):
        from arq.connections import RedisSettings

        return ArqTaskQueue(RedisSettings.from_dsn(settings.redis_url), functions)
    return InMemoryTaskQueue(functions)
