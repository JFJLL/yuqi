"""录音转写端点: 列表/详情/上传/重试/文本版本/删除 + 汇总.

录音记录的主键统一使用 audio_files.id (一条音频 → 至多一个会话)。
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from sqlalchemy import func, or_, select

from app.api.deps import CurrentUser, RequirePermission, SessionDep
from app.core.errors import AppError
from app.core.pagination import page_meta
from app.models.org import Employee, Store
from app.models.recording import (
    AudioFile,
    Conversation,
    ProcessingJob,
    TextVersion,
    TranscriptSegment,
)
from app.modules.audit.service import AuditService
from app.modules.ingestion.service import IngestionService, UploadMeta
from app.schemas.recording import TranscriptUpdate, VersionOut
from app.services.security_context import DataScopeService, TenantContext

router = APIRouter(tags=["recordings"])

MAX_UPLOAD_BYTES = 200 * 1024 * 1024
ACCEPTED_CONTENT_TYPES = {
    "audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3", "audio/mp4",
    "audio/x-m4a", "audio/flac", "audio/ogg", "audio/aac", "audio/webm",
    "application/octet-stream",  # 网关/扫描器可能不填 content-type
}
ACCEPTED_EXTENSIONS = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".aac", ".webm", ".amr"}


async def _visible_audio_stmt(ctx: TenantContext) -> Any:
    """基础查询 + 数据范围过滤 (门店/本人)."""
    stmt = select(AudioFile).where(
        AudioFile.tenant_id == ctx.tenant_id, AudioFile.deleted_at.is_(None)
    )
    scope = DataScopeService(ctx)
    if not scope.can_see_all:
        conditions: list[Any] = []
        if ctx.store_ids:
            conditions.append(AudioFile.store_id.in_(ctx.store_ids))
        if "SELF" in ctx.data_scope_types and ctx.employee_id is not None:
            conditions.append(AudioFile.employee_id == ctx.employee_id)
        if conditions:
            stmt = stmt.where(or_(*conditions))
        else:
            stmt = stmt.where(AudioFile.id.in_([]))
    return stmt


def _segments_json(rows: list[TranscriptSegment]) -> list[dict[str, Any]]:
    return [
        {"text": s.text, "start_ms": s.start_ms, "end_ms": s.end_ms, "speaker": s.speaker}
        for s in rows
    ]


@router.get("/recordings", response_model=dict)
async def list_recordings(
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("records:read")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    keyword: str = Query("", max_length=100),
    date: str = Query(""),
    store_id: uuid.UUID | None = Query(None),
    employee_id: uuid.UUID | None = Query(None),
    qc_result: str = Query(""),
    asr_status: str = Query(""),
) -> dict:
    stmt = await _visible_audio_stmt(ctx)
    if store_id:
        stmt = stmt.where(AudioFile.store_id == store_id)
    if employee_id:
        stmt = stmt.where(AudioFile.employee_id == employee_id)
    if date:
        stmt = stmt.where(func.date(AudioFile.occurred_at) == date)
    if qc_result:
        # 质检结果在会话层 (转写完成前无质检)
        conv_qc = (
            select(Conversation.audio_file_id)
            .where(Conversation.qc_result == qc_result)
            .scalar_subquery()
        )
        stmt = stmt.where(AudioFile.id.in_(conv_qc))
    if asr_status:
        # 会话存在且转写完成视为 succeeded, 其余按任务状态过滤
        sub = (
            select(ProcessingJob.audio_file_id)
            .where(ProcessingJob.status == asr_status)
            .distinct()
            .scalar_subquery()
        )
        if asr_status == "succeeded":
            stmt = stmt.where(AudioFile.conversation_id.isnot(None))
        else:
            stmt = stmt.where(AudioFile.id.in_(sub))
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (
        (
            await session.execute(
                stmt.order_by(AudioFile.occurred_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .scalars()
        .all()
    )

    audio_ids = [a.id for a in rows]
    conversations: dict[uuid.UUID, Conversation] = {}
    if audio_ids:
        conversations = {
            c.audio_file_id: c
            for c in (
                (
                    await session.execute(
                        select(Conversation).where(Conversation.audio_file_id.in_(audio_ids))
                    )
                )
                .scalars()
                .all()
            )
        }
    emp_ids = {a.employee_id for a in rows if a.employee_id}
    store_ids = {a.store_id for a in rows if a.store_id}
    emp_stmt = select(Employee)
    if emp_ids:
        emp_stmt = emp_stmt.where(Employee.id.in_(emp_ids))
    emp_names = {e.id: e.name for e in (await session.execute(emp_stmt)).scalars().all()}
    store_stmt = select(Store)
    if store_ids:
        store_stmt = store_stmt.where(Store.id.in_(store_ids))
    store_names = {s.id: s.name for s in (await session.execute(store_stmt)).scalars().all()}
    # 最新 ASR 任务状态
    job_rows = (
        (
            await session.execute(
                select(ProcessingJob).where(
                    ProcessingJob.audio_file_id.in_(audio_ids),
                    ProcessingJob.job_type == "ASR",
                )
            )
        )
        .scalars()
        .all()
    )
    latest_job: dict[uuid.UUID, ProcessingJob] = {}
    for j in job_rows:
        if j.audio_file_id is None:
            continue
        prev = latest_job.get(j.audio_file_id)
        if prev is None or j.created_at > prev.created_at:
            latest_job[j.audio_file_id] = j

    items = []
    for a in rows:
        conv = conversations.get(a.id)
        job = latest_job.get(a.id)
        if conv is not None and conv.status == "READY" and job and job.status == "succeeded":
            asr_status_v = "succeeded"
        elif job is not None:
            asr_status_v = job.status
        else:
            asr_status_v = "queued"
        items.append(
            {
                "id": str(a.id),
                "occurred_at": a.occurred_at.isoformat(),
                "employee": str(a.employee_id) if a.employee_id else None,
                "store": str(a.store_id) if a.store_id else None,
                "employee_name": emp_names.get(a.employee_id) if a.employee_id else None,
                "store_name": store_names.get(a.store_id) if a.store_id else None,
                "device": a.device_code,
                "source": a.source,
                "audio_name": a.file_name,
                "summary": (conv.summary if conv else "") or a.file_name,
                "qc_result": (conv.qc_result if conv else a.qc_result) or "",
                "asr_status": asr_status_v,
                "asr_job": str(job.id) if job else None,
                "file_size": a.size_bytes,
            }
        )
    return {"items": items, **page_meta(page, page_size, total)}


@router.get("/recordings/summary", response_model=dict)
async def recordings_summary(
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("records:read")),
) -> dict:
    """任务队列卡片数据: 全部服务端聚合."""
    stmt = await _visible_audio_stmt(ctx)
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    done = (
        await session.scalar(
            select(func.count()).select_from(stmt.where(AudioFile.status == "SUCCEEDED").subquery())
        )
        or 0
    )
    failed = (
        await session.scalar(
            select(func.count()).select_from(stmt.where(AudioFile.status == "FAILED").subquery())
        )
        or 0
    )
    pending = max(total - done - failed, 0)
    failed_jobs = (
        (
            await session.execute(
                select(ProcessingJob).where(
                    ProcessingJob.tenant_id == ctx.tenant_id,
                    ProcessingJob.status == "failed",
                )
            )
        )
        .scalars()
        .all()
    )
    return {
        "total": total,
        "done_count": done,
        "pending_count": pending,
        "failed_count": failed,
        "retryable_count": len(failed_jobs),
        "merge_count": 0,  # 阶段三无合并任务
        "resend_count": 0,  # 阶段三无文本转发
    }


@router.post("/recordings/upload", response_model=dict, status_code=201)
async def upload_recording(
    request: Request,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("records:upload")),
    file: UploadFile = File(...),
    device_code: str = Form("", max_length=64),
    employee_id: uuid.UUID | None = Form(None),
    store_id: uuid.UUID | None = Form(None),
    occurred_at: str = Form(""),
    language: str = Form("zh-CN", max_length=16),
    hotwords: str = Form("", max_length=500),
) -> dict:
    data = await file.read()
    if len(data) == 0:
        raise AppError(400, "empty_file", "音频文件为空")
    if len(data) > MAX_UPLOAD_BYTES:
        raise AppError(400, "file_too_large", "音频文件不能超过 200 MB")
    ext = ("." + file.filename.rsplit(".", 1)[-1].lower()) if file.filename and "." in file.filename else ""
    if ext and ext not in ACCEPTED_EXTENSIONS:
        raise AppError(400, "unsupported_type", f"不支持的音频格式: {ext}")
    if employee_id:
        emp = await session.get(Employee, employee_id)
        if emp is None or str(emp.tenant_id) != str(ctx.tenant_id):
            raise AppError(400, "invalid_employee", "员工不存在")
        store_id = store_id or emp.store_id
    if store_id:
        store = await session.get(Store, store_id)
        if store is None or str(store.tenant_id) != str(ctx.tenant_id):
            raise AppError(400, "invalid_store", "门店不存在")
    try:
        occurred = datetime.fromisoformat(occurred_at) if occurred_at else datetime.now(UTC)
    except ValueError as exc:
        raise AppError(400, "invalid_occurred_at", "录音时间格式不正确") from exc
    if occurred.tzinfo is None:
        occurred = occurred.replace(tzinfo=UTC)

    meta = UploadMeta(
        file_name=file.filename or "recording.bin",
        content_type=file.content_type,
        size_bytes=len(data),
        language=language or "zh-CN",
        device_code=device_code or None,
        employee_id=employee_id,
        store_id=store_id,
        occurred_at=occurred,
        source="manual",
        hotwords=hotwords or None,
    )
    service = IngestionService(session, ctx=ctx)
    audio = await service.register_upload(ctx.tenant_id, meta, data)
    job = await service.submit_asr(audio.id)
    await AuditService(session, ctx, request).record(
        action="recording.upload",
        resource_type="audio_files",
        resource_id=str(audio.id),
        after={"file_name": audio.file_name, "size_bytes": audio.size_bytes},
        detail=audio.file_name,
    )
    await session.commit()
    return {"id": str(audio.id), "asr_job": str(job.id), "status": job.status}


@router.get("/recordings/{audio_id}", response_model=dict)
async def recording_detail(
    audio_id: uuid.UUID,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("records:read")),
) -> dict:
    audio = await session.get(AudioFile, audio_id)
    if audio is None or str(audio.tenant_id) != str(ctx.tenant_id) or audio.deleted_at is not None:
        raise AppError(404, "not_found", "录音不存在")
    DataScopeService(ctx).assert_visible(
        tenant_id=ctx.tenant_id, store_id=audio.store_id, employee_id=audio.employee_id
    )
    conv = (
        await session.scalar(select(Conversation).where(Conversation.audio_file_id == audio.id))
        if audio.conversation_id
        else None
    )
    job = (
        await session.scalar(
            select(ProcessingJob)
            .where(
                ProcessingJob.audio_file_id == audio.id,
                ProcessingJob.job_type == "ASR",
            )
            .order_by(ProcessingJob.created_at.desc())
        )
        if audio.id
        else None
    )
    segments: list[TranscriptSegment] = []
    if conv:
        segments = list(
            (
                await session.execute(
                    select(TranscriptSegment).where(
                        TranscriptSegment.conversation_id == conv.id,
                        TranscriptSegment.version_no == conv.current_version,
                    ).order_by(TranscriptSegment.segment_no)
                )
            )
            .scalars()
            .all()
        )
    emp = await session.get(Employee, audio.employee_id) if audio.employee_id else None
    store = await session.get(Store, audio.store_id) if audio.store_id else None
    if conv is not None and conv.status == "READY" and job and job.status == "succeeded":
        asr_status = "succeeded"
    elif job is not None:
        asr_status = job.status
    else:
        asr_status = "queued"
    return {
        "id": str(audio.id),
        "audio_file_id": str(audio.id),
        "device": audio.device_code,
        "employee": str(audio.employee_id) if audio.employee_id else None,
        "store": str(audio.store_id) if audio.store_id else None,
        "employee_name": emp.name if emp else None,
        "store_name": store.name if store else None,
        "summary": (conv.summary if conv else "") or audio.file_name,
        "full_text": conv.full_text if conv else "",
        "segments_json": _segments_json(segments) if conv else None,
        "asr_job": str(job.id) if job else None,
        "asr_status": asr_status,
        "model": None,
        "audio_name": audio.file_name,
        "source": audio.source,
        "qc_result": (conv.qc_result if conv else audio.qc_result) or "",
        "occurred_at": audio.occurred_at.isoformat(),
        "speaker_aliases": (conv.speaker_aliases if conv else None) or {},
        "marks_json": (conv.marks_json if conv else None) or [],
        "current_version": conv.current_version if conv else 0,
        "file_size": audio.size_bytes,
    }


@router.post("/recordings/{audio_id}/retry", response_model=dict)
async def retry_recording(
    audio_id: uuid.UUID,
    request: Request,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("records:retry")),
) -> dict:
    service = IngestionService(session, ctx=ctx)
    job = await service.retry(audio_id)
    await AuditService(session, ctx, request).record(
        action="recording.retry", resource_type="audio_files", resource_id=str(audio_id)
    )
    await session.commit()
    return {"id": str(audio_id), "asr_job": str(job.id), "status": job.status}


@router.patch("/recordings/{audio_id}/transcript", response_model=dict)
async def update_transcript(
    audio_id: uuid.UUID,
    body: TranscriptUpdate,
    request: Request,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("records:edit")),
) -> dict:
    audio = await session.get(AudioFile, audio_id)
    if audio is None or str(audio.tenant_id) != str(ctx.tenant_id) or audio.deleted_at is not None:
        raise AppError(404, "not_found", "录音不存在")
    conv = await session.scalar(select(Conversation).where(Conversation.audio_file_id == audio.id))
    if conv is None:
        raise AppError(400, "no_transcript", "转写结果尚未生成, 无法编辑")
    DataScopeService(ctx).assert_visible(
        tenant_id=ctx.tenant_id, store_id=audio.store_id, employee_id=audio.employee_id
    )
    next_version = conv.current_version + 1
    conv.full_text = body.full_text or conv.full_text
    conv.summary = body.summary or body.full_text[:200] or conv.summary
    conv.marks_json = [m.model_dump() for m in body.marks]
    conv.speaker_aliases = body.speaker_aliases
    conv.current_version = next_version
    conv.status = "REVIEWED"
    segments_json = [s.model_dump() for s in body.segments]
    for idx, seg in enumerate(body.segments, start=1):
        session.add(
            TranscriptSegment(
                tenant_id=ctx.tenant_id,
                conversation_id=conv.id,
                version_no=next_version,
                segment_no=idx,
                speaker=seg.speaker,
                start_ms=seg.start_ms,
                end_ms=seg.end_ms,
                text=seg.text,
            )
        )
    session.add(
        TextVersion(
            tenant_id=ctx.tenant_id,
            conversation_id=conv.id,
            version_no=next_version,
            full_text=conv.full_text,
            summary=conv.summary,
            segments_json=segments_json,
            marks_json=conv.marks_json,
            speaker_aliases=body.speaker_aliases,
            edited_by=ctx.user.id,
            edit_reason=body.edit_reason,
            source="MANUAL_EDIT",
        )
    )
    await AuditService(session, ctx, request).record(
        action="recording.transcript_edit",
        resource_type="conversations",
        resource_id=str(conv.id),
        after={"version": next_version, "segments": len(body.segments)},
        detail=f"version={next_version}",
    )
    await session.commit()
    return {"ok": True, "version": next_version}


@router.get("/recordings/{audio_id}/versions", response_model=list[VersionOut])
async def list_versions(
    audio_id: uuid.UUID,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("records:read")),
) -> list[TextVersion]:
    audio = await session.get(AudioFile, audio_id)
    if audio is None or str(audio.tenant_id) != str(ctx.tenant_id) or audio.deleted_at is not None:
        raise AppError(404, "not_found", "录音不存在")
    conv = await session.scalar(select(Conversation).where(Conversation.audio_file_id == audio.id))
    if conv is None:
        return []
    rows = (
        (
            await session.execute(
                select(TextVersion)
                .where(
                    TextVersion.tenant_id == ctx.tenant_id,
                    TextVersion.conversation_id == conv.id,
                )
                .order_by(TextVersion.version_no.desc())
            )
        )
        .scalars()
        .all()
    )
    return list(rows)


@router.delete("/recordings/{audio_id}", response_model=dict)
async def delete_recording(
    audio_id: uuid.UUID,
    request: Request,
    session: SessionDep,
    ctx: CurrentUser,
    _: TenantContext = Depends(RequirePermission("records:delete")),
) -> dict:
    service = IngestionService(session, ctx=ctx)
    await service.soft_delete(audio_id, ctx.user.id)
    await AuditService(session, ctx, request).record(
        action="recording.delete", resource_type="audio_files", resource_id=str(audio_id)
    )
    await session.commit()
    return {"ok": True}
