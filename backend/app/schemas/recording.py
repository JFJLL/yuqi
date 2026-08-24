"""录音/转写域 Schema."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TranscriptSegmentIn(BaseModel):
    text: str
    start_ms: int | None = None
    end_ms: int | None = None
    speaker: str = "unknown"


class TranscriptMarkIn(BaseModel):
    speaker: str
    start_ms: int | None = None
    end_ms: int | None = None
    color: str = "red"
    note: str = ""
    created_at: str | None = None


class TranscriptUpdate(BaseModel):
    """保存转写编辑: 生成一个新文本版本."""

    segments: list[TranscriptSegmentIn] = Field(default_factory=list)
    full_text: str = ""
    summary: str = ""
    marks: list[TranscriptMarkIn] = Field(default_factory=list)
    speaker_aliases: dict[str, str] = Field(default_factory=dict)
    edit_reason: str | None = Field(default=None, max_length=256)


class VersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    version_no: int
    full_text: str
    summary: str
    segments_json: list | None
    marks_json: list | None
    speaker_aliases: dict | None
    source: str
    edited_by: uuid.UUID | None
    created_at: datetime


class SegmentOut(BaseModel):
    text: str
    start_ms: int | None
    end_ms: int | None
    speaker: str


class RecordingDetailOut(BaseModel):
    """详情: 兼容旧 TranscriptRecord 字段 (前端详情对话框直接消费)."""

    id: uuid.UUID
    audio_file_id: uuid.UUID
    device: str | None
    employee: uuid.UUID | None
    store: uuid.UUID | None
    employee_name: str | None
    store_name: str | None
    summary: str
    full_text: str
    segments_json: list[SegmentOut] | None
    asr_job: uuid.UUID | None
    asr_status: str
    model: str | None
    audio_name: str | None
    source: str
    qc_result: str
    occurred_at: datetime | None
    speaker_aliases: dict | None
    marks_json: list | None
    current_version: int
    file_size: int | None
