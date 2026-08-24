"""Async engine 与 Session 工厂."""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import Settings


def make_engine(settings: Settings) -> AsyncEngine:
    kwargs: dict = {"echo": False, "pool_pre_ping": True}
    if settings.database_url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs["pool_size"] = 10
        kwargs["max_overflow"] = 20
    return create_async_engine(settings.database_url, **kwargs)


def make_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def init_engine(settings: Settings) -> None:
    global _engine, _session_factory
    _engine = make_engine(settings)
    _session_factory = make_session_factory(_engine)


def get_engine() -> AsyncEngine:
    assert _engine is not None, "init_engine() 未调用"
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    assert _session_factory is not None, "init_engine() 未调用"
    return _session_factory


async def session_dependency() -> AsyncIterator[AsyncSession]:
    async with get_session_factory()() as session:
        yield session
