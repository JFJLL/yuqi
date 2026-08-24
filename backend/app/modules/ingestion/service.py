"""接入/转写业务服务: 文件登记 → ASR 提交/轮询 → 会话与文本版本落库.

职责边界:
- 对象存储由 providers.object_storage 负责 (业务不直接碰文件系统/OSS)
- ASR 由 providers.asr 抽象 (mock/private)
- 任务队列由 providers.queue 抽象 (内存同步 / ARQ)
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import AppError
from app.core.logging import get_logger
from app.models.recording import (
    AudioFile,
    Conversation,
    ProcessingJob,
    TextVersion,
    TranscriptSegment,
)
from app.providers.asr import AsrJobResult, AsrProvider
from app.providers.object_storage import ObjectStorageProvider, sha256_bytes
from app.services.security_context import TenantContext

logger = get_logger("yuqi.ingestion")


@dataclass
class UploadMeta:
    file_name: str
    content_type: str | None
    size_bytes: int
    language: str
    device_code: str | None
    employee_id: uuid.UUID | None
    store_id: uuid.UUID | None
    occurred_at: datetime
    source: str  # manual / oss_auto
    hotwords: str | None = None


class IngestionService:
    def __init__(
        self,
        session: AsyncSession,
        *,
        settings: Settings | None = None,
        storage: ObjectStorageProvider | None = None,
        asr: AsrProvider | None = None,
        ctx: TenantContext | None = None,
    ) -> None:
        from app.core.config import get_settings
        from app.providers.asr import HttpAsrProvider, MockAsrProvider
        from app.providers.object_storage import build_object_storage

        self.session = session
        self.ctx = ctx
        self.settings = settings or get_settings()
        self.storage = storage or build_object_storage(self.settings)
        if asr is None:
            asr = (
                HttpAsrProvider(self.settings.asr_private_base_url, self.settings.asr_private_token)
                if self.settings.asr_provider == "private"
                else MockAsrProvider()
            )
        self.asr = asr

    # ---------- 文件接入 ----------

    async def register_upload(
        self, tenant_id: uuid.UUID, meta: UploadMeta, data: bytes
    ) -> AudioFile:
        """保存音频到对象存储并登记 audio_files; 随后由调用方 submit_asr 入队."""
        from app.providers.object_storage import object_key_for

        audio = AudioFile(
            tenant_id=tenant_id,
            file_name=meta.file_name,
            object_key="",
            storage_provider=self.storage.name,
            content_type=meta.content_type,
            size_bytes=meta.size_bytes,
            sha256=sha256_bytes(data),
            language=meta.language,
            device_code=meta.device_code,
            employee_id=meta.employee_id,
            store_id=meta.store_id,
            occurred_at=meta.occurred_at,
            source=meta.source,
            hotwords=meta.hotwords,
            status="PENDING",
        )
        # 先 flush 拿到 id, 再构造 object_key 上传
        self.session.add(audio)
        await self.session.flush()
        audio.object_key = object_key_for(
            tenant_id=str(audio.tenant_id), audio_file_id=str(audio.id), file_name=meta.file_name
        )
        await self.storage.put_object(audio.object_key, data, meta.content_type)
        await self.session.flush()
        return audio

    # ---------- ASR 任务 ----------

    async def submit_asr(self, audio_file_id: uuid.UUID) -> ProcessingJob:
        """创建/复用 ASR 任务并入队. 返回任务."""
        audio = await self._get_audio(audio_file_id)
        existing = await self.session.scalar(
            select(ProcessingJob)
            .where(
                ProcessingJob.tenant_id == audio.tenant_id,
                ProcessingJob.audio_file_id == audio.id,
                ProcessingJob.job_type == "ASR",
                ProcessingJob.status.in_(["queued", "running"]),
            )
            .order_by(ProcessingJob.created_at.desc())
        )
        if existing is not None:
            return existing
        job = ProcessingJob(
            tenant_id=audio.tenant_id,
            job_type="ASR",
            audio_file_id=audio.id,
            status="queued",
            attempts=0,
            max_attempts=3,
            submitted_at=datetime.now(UTC),
        )
        self.session.add(job)
        audio.status = "PROCESSING"
        await self.session.flush()
        await self._enqueue(str(job.id))
        return job

    async def _enqueue(self, job_id: str) -> None:
        from app.providers.queue import InMemoryTaskQueue, get_task_queue

        queue = get_task_queue(self.settings)
        if isinstance(queue, InMemoryTaskQueue):
            # 内存队列: 同请求会话内同步执行 (测试/开发确定性, 无需独立 worker 会话)
            await self.execute_asr_job(job_id)
            return
        await queue.enqueue("run_asr_job", job_id=job_id)

    async def execute_asr_job(self, job_id: str) -> None:
        """执行 ASR 任务 (worker/内存队列调用)."""
        job = await self.session.get(ProcessingJob, uuid.UUID(job_id))
        if job is None or job.status == "succeeded":
            return
        audio = await self.session.get(AudioFile, job.audio_file_id) if job.audio_file_id else None
        if audio is None:
            job.status = "failed"
            job.error_code = "audio_missing"
            job.error_message = "音频文件不存在"
            job.finished_at = datetime.now(UTC)
            await self.session.commit()
            return
        job.status = "running"
        job.started_at = datetime.now(UTC)
        job.attempts += 1
        await self.session.commit()
        try:
            if not job.remote_job_id:
                job.remote_job_id = await self.asr.submit(
                    object_key=audio.object_key,
                    file_name=audio.file_name,
                    language=audio.language,
                    hotwords=audio.hotwords or "",
                )
                await self.session.commit()
            result = await self.asr.poll(job.remote_job_id)
            job.last_polled_at = datetime.now(UTC)
            if result.status == "succeeded":
                conversation = await self._import_result(job, audio, result)
                job.status = "succeeded"
                job.finished_at = datetime.now(UTC)
                job.result_imported_at = datetime.now(UTC)
                audio.status = "SUCCEEDED"
                await self.session.commit()
                # 转写完成 → 风险分析: 内存队列同会话执行, 生产走 ARQ worker 任务
                try:
                    from app.core.config import get_settings
                    from app.providers.queue import InMemoryTaskQueue, get_task_queue

                    queue = get_task_queue(get_settings())
                    if isinstance(queue, InMemoryTaskQueue):
                        from app.modules.analysis.service import RiskAnalyzer

                        await RiskAnalyzer(self.session).analyze_conversation(conversation.id)
                        await self.session.commit()
                    else:
                        await queue.enqueue(
                            "run_risk_analysis",
                            conversation_id=str(conversation.id),
                        )
                except Exception:  # noqa: BLE001
                    logger.exception(
                        "analysis_enqueue_failed", conversation_id=str(conversation.id)
                    )
            else:
                # 未完成: 保留 running, 由 scheduler 或下次重试轮询
                await self.session.commit()
        except Exception as exc:  # noqa: BLE001
            logger.exception("asr_job_failed", job_id=job_id, error=str(exc))
            job.status = "failed"
            job.error_code = "provider_error"
            job.error_message = str(exc)[:500]
            job.finished_at = datetime.now(UTC)
            audio.status = "FAILED"
            await self.session.commit()

    async def _import_result(
        self, job: ProcessingJob, audio: AudioFile, result: AsrJobResult
    ) -> Conversation:
        """写会话 + 当前片段 + 文本版本 (重试/回调幂等: 复用已有会话)."""
        now = datetime.now(UTC)
        conversation = await self.session.scalar(
            select(Conversation).where(Conversation.audio_file_id == audio.id)
        )
        if conversation is None:
            conversation = Conversation(
                tenant_id=audio.tenant_id,
                audio_file_id=audio.id,
                store_id=audio.store_id,
                employee_id=audio.employee_id,
                device_code=audio.device_code,
                started_at=audio.occurred_at,
                ended_at=now,
                summary=result.full_text[:200],
                full_text=result.full_text,
                status="READY",
                current_version=1,
            )
            self.session.add(conversation)
            await self.session.flush()
            audio.conversation_id = conversation.id
            version_no = 1
        else:
            # 重新转写: 追加为新版本, 保留用户编辑的标记/别名
            version_no = conversation.current_version + 1
            conversation.current_version = version_no
            conversation.full_text = result.full_text
            conversation.summary = result.full_text[:200]
            conversation.status = "READY"
            await self.session.flush()
        segments_json: list[dict[str, Any]] = []
        for idx, seg in enumerate(result.segments, start=1):
            self.session.add(
                TranscriptSegment(
                    tenant_id=audio.tenant_id,
                    conversation_id=conversation.id,
                    version_no=version_no,
                    segment_no=idx,
                    speaker=seg.speaker,
                    start_ms=seg.start_ms,
                    end_ms=seg.end_ms,
                    text=seg.text,
                )
            )
            segments_json.append(
                {"text": seg.text, "start_ms": seg.start_ms, "end_ms": seg.end_ms, "speaker": seg.speaker}
            )
        self.session.add(
            TextVersion(
                tenant_id=audio.tenant_id,
                conversation_id=conversation.id,
                version_no=version_no,
                full_text=result.full_text,
                summary=result.full_text[:200],
                segments_json=segments_json,
                source="ASR",
            )
        )
        await self.session.flush()
        return conversation

    # ---------- 管理端操作 ----------

    async def retry(self, audio_file_id: uuid.UUID) -> ProcessingJob:
        audio = await self._get_audio(audio_file_id)
        if audio.deleted_at is not None:
            raise AppError(404, "not_found", "音频不存在")
        old_jobs = (
            (
                await self.session.execute(
                    select(ProcessingJob).where(
                        ProcessingJob.tenant_id == audio.tenant_id,
                        ProcessingJob.audio_file_id == audio.id,
                        ProcessingJob.status.in_(["queued", "running", "failed"]),
                    )
                )
            )
            .scalars()
            .all()
        )
        for old in old_jobs:
            old.status = "failed"
            old.error_code = "superseded"
        await self.session.flush()
        return await self.submit_asr(audio.id)

    async def soft_delete(
        self, audio_file_id: uuid.UUID, actor_id: uuid.UUID | None
    ) -> None:
        """软删除音频与会话; 会话被疑似问题引用时拒绝删除 (证据锁)."""
        audio = await self._get_audio(audio_file_id)
        if audio.conversation_id:
            from app.models.issue import Issue

            referenced = await self.session.scalar(
                select(Issue.id).where(
                    Issue.tenant_id == audio.tenant_id,
                    Issue.conversation_id == audio.conversation_id,
                    Issue.deleted_at.is_(None),
                ).limit(1)
            )
            if referenced is not None:
                raise AppError(400, "issue_referenced", "该录音已被疑似问题引用, 不能删除 (证据锁)")
        conversation = (
            await self.session.scalar(
                select(Conversation).where(Conversation.audio_file_id == audio.id)
            )
            if audio.conversation_id
            else None
        )
        now = datetime.now(UTC)
        audio.deleted_at = now
        audio.deleted_by = actor_id
        audio.status = "ARCHIVED"
        if conversation is not None:
            conversation.deleted_at = now
            conversation.deleted_by = actor_id
        await self.session.flush()

    async def _get_audio(self, audio_file_id: uuid.UUID) -> AudioFile:
        audio = await self.session.get(AudioFile, audio_file_id)
        if audio is None:
            raise AppError(404, "not_found", "音频不存在")
        if self.ctx is not None and str(audio.tenant_id) != str(self.ctx.tenant_id):
            raise AppError(404, "not_found", "音频不存在")
        return audio


async def run_asr_job(job_id: str) -> None:
    """Worker 任务: 加载任务 → 提交/轮询 ASR → 写会话与文本版本."""
    from app.db.session import get_session_factory

    async with get_session_factory()() as session:
        service = IngestionService(session)
        await service.execute_asr_job(job_id)
