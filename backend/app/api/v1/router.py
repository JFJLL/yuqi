"""/api/v1 路由聚合."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    analysis,
    audit,
    auth,
    dashboard,
    devices,
    employee,
    imports,
    internal,
    me,
    org,
    recordings,
    reports,
    settings,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(me.router)
api_router.include_router(dashboard.router)
api_router.include_router(users.router)
api_router.include_router(org.router)
api_router.include_router(devices.router)
api_router.include_router(imports.router)
api_router.include_router(recordings.router)
api_router.include_router(analysis.router)
api_router.include_router(employee.router)
api_router.include_router(reports.router)
api_router.include_router(audit.router)
api_router.include_router(settings.router)
api_router.include_router(internal.router)
