"""内部服务端点 (Node OSS Scanner / ASR 网关专用, X-Service-Token 鉴权).

不暴露公网; 供迁移切换后的内部组件调 FastAPI 而非直写 PocketBase。
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import SessionDep
from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.core.logging import get_logger
from app.models.auth import Tenant
from app.models.device import Device, DeviceBinding
from app.models.org import Employee
from app.models.recording import AudioFile, ProcessingJob
from app.modules.ingestion.service import IngestionService, UploadMeta
from app.providers.asr import AsrJobResult, AsrSegment

router = APIRouter(tags=["internal"])
logger = get_logger("yuqi.internal")


async def _require_service_token(
    x_service_token: Annotated[str | None, Header(alias="X-Service-Token")] = None,
    settings: Settings = Depends(get_settings),
) -> None:
    if not settings.internal_service_token:
        raise HTTPException(status_code=503, detail="internal API 未启用")
    if x_service_token != settings.internal_service_token:
        raise HTTPException(status_code=401, detail="无效的服务令牌")


ServiceToken = Annotated[None, Depends(_require_service_token)]


async def _resolve_tenant(session: AsyncSession, tenant_code: str | None) -> Tenant:
    if not tenant_code:
        raise AppError(400, "missing_tenant_code", "缺少 tenant_code")
    tenant = await session.scalar(select(Tenant).where(Tenant.code == tenant_code))
    if tenant is None or tenant.status != "ACTIVE":
        raise AppError(400, "invalid_tenant_code", "租户不存在或不可用")
    return tenant


async def _resolve_device_employee(
    session: AsyncSession, tenant_id: uuid.UUID, device_code: str | None
) -> tuple[Device | None, Employee | None]:
    """按设备码 → 当前活跃绑定 → 员工 (扫描器场景)."""
    if not device_code:
        return None, None
    device = await session.scalar(
        select(Device).where(
            Device.tenant_id == tenant_id,
            Device.device_code == device_code,
            Device.deleted_at.is_(None),
        )
    )
    if device is None:
        return None, None
    binding = await session.scalar(
        select(DeviceBinding).where(
            DeviceBinding.tenant_id == tenant_id,
            DeviceBinding.device_id == device.id,
            DeviceBinding.binding_status == "ACTIVE",
        )
    )
    employee = await session.get(Employee, binding.employee_id) if binding else None
    return device, employee


@router.post("/internal/ingest/audio", response_model=dict, status_code=201)
async def ingest_audio(
    session: SessionDep,
    _: ServiceToken,
    body: dict[str, Any],
) -> dict:
    """OSS Scanner 登记已发现音频 (对象已存在于对象存储, 不再重复上传)."""
    tenant = await _resolve_tenant(session, body.get("tenant_code"))
    object_key = str(body.get("object_key", ""))
    if not object_key:
        raise AppError(400, "missing_object_key", "缺少 object_key")
    # 幂等: 同 object_key 已登记则直接返回 (不重复入队)
    dup = await session.scalar(
        select(AudioFile).where(
            AudioFile.tenant_id == tenant.id,
            AudioFile.object_key == object_key,
            AudioFile.deleted_at.is_(None),
        )
    )
    if dup is not None:
        return {"id": str(dup.id), "duplicate": True, "status": dup.status}

    device, employee = await _resolve_device_employee(
        session, tenant.id, body.get("device_code")
    )
    try:
        occurred = (
            datetime.fromisoformat(str(body["occurred_at"]))
            if body.get("occurred_at")
            else datetime.now(UTC)
        )
    except ValueError as exc:
        raise AppError(400, "invalid_occurred_at", "录音时间格式不正确") from exc
    if occurred.tzinfo is None:
        occurred = occurred.replace(tzinfo=UTC)

    meta = UploadMeta(
        file_name=str(body.get("file_name") or object_key.rsplit("/", 1)[-1]),
        content_type=body.get("content_type"),
        size_bytes=int(body.get("size_bytes") or 0),
        language=str(body.get("language") or "zh-CN"),
        device_code=body.get("device_code") or (device.device_code if device else None),
        employee_id=employee.id if employee else None,
        store_id=employee.store_id if employee else None,
        occurred_at=occurred,
        source="oss_auto",
        hotwords=body.get("hotwords"),
    )
    service = IngestionService(session)
    audio = AudioFile(
        tenant_id=tenant.id,
        file_name=meta.file_name,
        object_key=object_key,
        storage_provider="s3",
        content_type=meta.content_type,
        size_bytes=meta.size_bytes,
        sha256=body.get("sha256"),
        language=meta.language,
        device_code=meta.device_code,
        employee_id=meta.employee_id,
        store_id=meta.store_id,
        occurred_at=meta.occurred_at,
        source=meta.source,
        hotwords=meta.hotwords,
        status="PENDING",
    )
    session.add(audio)
    await session.flush()
    job = await service.submit_asr(audio.id)
    await session.commit()
    return {"id": str(audio.id), "asr_job": str(job.id), "duplicate": False}


@router.post("/internal/asr/callback", response_model=dict)
async def asr_callback(
    session: SessionDep,
    _: ServiceToken,
    body: dict[str, Any],
) -> dict:
    """ASR 网关推送转写结果 (按 ProcessingJob id 或 remote_job_id 定位)."""
    job_id_raw = body.get("job_id")
    remote_job_id = body.get("remote_job_id")
    job: ProcessingJob | None = None
    if job_id_raw:
        try:
            job = await session.get(ProcessingJob, uuid.UUID(str(job_id_raw)))
        except ValueError:
            job = None
    if job is None and remote_job_id:
        job = await session.scalar(
            select(ProcessingJob).where(ProcessingJob.remote_job_id == str(remote_job_id))
        )
    if job is None:
        raise AppError(404, "job_not_found", "转写任务不存在")
    status = str(body.get("status") or "running")
    if status == "succeeded":
        result = AsrJobResult(
            status="succeeded",
            segments=[
                AsrSegment(
                    text=str(seg.get("text", "")),
                    start_ms=seg.get("start_ms"),
                    end_ms=seg.get("end_ms"),
                    speaker=str(seg.get("speaker", "unknown")),
                )
                for seg in (body.get("segments") or [])
            ],
            full_text=str(body.get("full_text") or ""),
            duration_ms=body.get("duration_ms"),
        )
        audio = await session.get(AudioFile, job.audio_file_id) if job.audio_file_id else None
        if audio is None:
            raise AppError(404, "audio_missing", "音频不存在")
        service = IngestionService(session)
        await service._import_result(job, audio, result)  # noqa: SLF001  (同模块边界内部复用)
        job.status = "succeeded"
        job.finished_at = datetime.now(UTC)
        job.result_imported_at = datetime.now(UTC)
        if audio is not None:
            audio.status = "SUCCEEDED"
    elif status == "failed":
        job.status = "failed"
        job.error_code = body.get("error_code")
        job.error_message = str(body.get("error_message") or "")[:500]
        job.finished_at = datetime.now(UTC)
        audio = await session.get(AudioFile, job.audio_file_id) if job.audio_file_id else None
        if audio is not None:
            audio.status = "FAILED"
    else:
        job.status = "running"
        job.last_polled_at = datetime.now(UTC)
    await session.commit()
    return {"ok": True, "status": job.status}
