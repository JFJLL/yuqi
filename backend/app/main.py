"""FastAPI 应用入口: 中间件 / 健康检查 / 错误处理 / 路由."""

from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app import __version__
from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.errors import install_error_handlers
from app.core.logging import setup_logging
from app.db.session import get_engine, init_engine

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(logging.INFO)
    init_engine(app.state.settings)
    app.state.logger = logging.getLogger("yuqi.api")
    yield
    await get_engine().dispose()


app = FastAPI(
    title="智能工牌销售合规系统 API",
    version=__version__,
    description="一期: 多租户底座 + 接入/转写/分析/问题闭环 (FastAPI + PostgreSQL).",
    lifespan=lifespan,
)
app.state.settings = settings

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
install_error_handlers(app)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("X-Request-Id") or uuid.uuid4().hex
    request.state.request_id = request_id
    import structlog

    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id)
    response = await call_next(request)
    response.headers["X-Request-Id"] = request_id
    return response


@app.get("/health/live", tags=["health"])
async def health_live() -> dict:
    return {"status": "ok", "app": settings.app_name, "version": __version__}


@app.get("/health/ready", tags=["health"])
async def health_ready() -> dict:
    checks: dict[str, str] = {}
    # PostgreSQL 就绪检查
    try:
        async with get_engine().connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:  # noqa: BLE001
        checks["database"] = f"error: {type(exc).__name__}"
    # Redis 就绪检查 (配置启用时)
    if settings.redis_enabled and not settings.database_url.startswith("sqlite"):
        try:
            import redis.asyncio as aioredis

            r = aioredis.from_url(settings.redis_url, socket_connect_timeout=2)
            await r.ping()
            await r.aclose()
            checks["redis"] = "ok"
        except Exception as exc:  # noqa: BLE001
            checks["redis"] = f"error: {type(exc).__name__}"
    else:
        checks["redis"] = "skipped"
    ready = all(v == "ok" for v in checks.values())
    return {"status": "ok" if ready else "degraded", "checks": checks}


app.include_router(api_router, prefix=settings.api_prefix)
