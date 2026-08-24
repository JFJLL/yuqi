"""批量导入端点: 模板下载 / 上传导入 / 批次列表 / 失败行下载."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response
from sqlalchemy import func, select

from app.api.deps import CurrentUser, RequirePermission, SessionDep
from app.core.errors import AppError
from app.core.pagination import page_meta
from app.models.imports import ImportBatch
from app.modules.imports.service import TEMPLATES, ImportService
from app.schemas.imports import ImportBatchOut
from app.services.security_context import TenantContext

router = APIRouter(prefix="/imports", tags=["imports"])


@router.get("/templates/{import_type}")
async def download_template(
    import_type: str,
    _: TenantContext = Depends(RequirePermission("employee:manage")),
) -> Response:
    if import_type not in TEMPLATES:
        raise AppError(400, "invalid_import_type", "不支持的导入类型")
    content = ImportService.build_template(import_type)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="template-{import_type}.xlsx"'},
    )


@router.post("/{import_type}", response_model=ImportBatchOut, status_code=201)
async def upload_import(
    import_type: str,
    session: SessionDep,
    ctx: CurrentUser,
    file: UploadFile = File(...),
    _: TenantContext = Depends(RequirePermission("employee:manage")),
) -> ImportBatch:
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise AppError(400, "invalid_file_type", "仅支持 .xlsx 文件")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise AppError(400, "file_too_large", "文件超过 10MB 限制")
    service = ImportService(session, ctx)
    return await service.run_import(import_type, file.filename, content)


@router.get("", response_model=dict)
async def list_batches(
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("employee:read")),
    page: int = 1,
    page_size: int = 20,
) -> dict:
    stmt = select(ImportBatch).where(ImportBatch.tenant_id == ctx.tenant_id)
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (
        (
            await session.execute(
                stmt.order_by(ImportBatch.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .scalars()
        .all()
    )
    return {"items": [ImportBatchOut.model_validate(b) for b in rows], **page_meta(page, page_size, total)}


@router.get("/{batch_id}/failures")
async def download_failures(
    batch_id: uuid.UUID,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("employee:manage")),
) -> Response:
    content = await ImportService(session, ctx).failure_workbook(batch_id)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="import-failures-{batch_id}.xlsx"'},
    )
