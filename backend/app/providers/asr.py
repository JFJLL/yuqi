"""ASR Provider 抽象: 提交音频 → 轮询结果.

- MockAsrProvider: 内存模拟, 开发/测试确定性完成 (无需外部服务)
- HttpAsrProvider: 调用私有 ASR 网关 (asr_private_base_url, Bearer Token),
  网关负责拉取对象存储音频并回调/轮询
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from typing import Protocol

import httpx

from app.core.logging import get_logger

logger = get_logger("yuqi.asr")


@dataclass
class AsrSegment:
    text: str
    start_ms: int | None
    end_ms: int | None
    speaker: str = "unknown"


@dataclass
class AsrJobResult:
    status: str  # queued / running / succeeded / failed
    segments: list[AsrSegment] = field(default_factory=list)
    full_text: str = ""
    duration_ms: int | None = None
    error_code: str | None = None
    error_message: str | None = None


class AsrProvider(Protocol):
    name: str

    async def submit(self, *, object_key: str, file_name: str, language: str, hotwords: str) -> str:
        """提交转写, 返回远端任务 ID."""

    async def poll(self, remote_job_id: str) -> AsrJobResult:
        """轮询远端任务结果."""


class MockAsrProvider:
    """内存模拟 ASR: 立即返回成功, 生成带热词的演示转写."""

    name = "mock"

    def __init__(self) -> None:
        self._jobs: dict[str, AsrJobResult] = {}

    async def submit(self, *, object_key: str, file_name: str, language: str, hotwords: str) -> str:
        job_id = f"mock-{uuid.uuid4().hex[:12]}"
        text = _mock_transcript(file_name, hotwords)
        self._jobs[job_id] = AsrJobResult(
            status="succeeded",
            segments=[
                AsrSegment(text="您好，请问有什么可以帮您？", start_ms=0, end_ms=2400, speaker="customer"),
                AsrSegment(text=text, start_ms=2400, end_ms=9000, speaker="staff"),
                AsrSegment(text="好的，感谢您的光临，再见。", start_ms=9000, end_ms=11000, speaker="staff"),
            ],
            full_text="您好，请问有什么可以帮您？\n" + text + "\n好的，感谢您的光临，再见。",
            duration_ms=11_000,
        )
        return job_id

    async def poll(self, remote_job_id: str) -> AsrJobResult:
        result = self._jobs.get(remote_job_id)
        if result is None:
            return AsrJobResult(status="failed", error_code="unknown_job", error_message="远端任务不存在")
        # 模拟一次轮询才完成, 保证 running 状态可观测
        if result.status == "succeeded":
            await asyncio.sleep(0)
        return result


class HttpAsrProvider:
    """私有 ASR 网关: 以 Service Token 提交/轮询 (网关内部拉取对象存储)."""

    name = "private"

    def __init__(self, base_url: str, token: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}

    async def submit(self, *, object_key: str, file_name: str, language: str, hotwords: str) -> str:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.base_url}/api/asr/jobs",
                headers=self._headers(),
                json={
                    "object_key": object_key,
                    "file_name": file_name,
                    "language": language,
                    "hotwords": hotwords,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return str(data["job_id"])

    async def poll(self, remote_job_id: str) -> AsrJobResult:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self.base_url}/api/asr/jobs/{remote_job_id}",
                headers=self._headers(),
            )
            resp.raise_for_status()
            data = resp.json()
        status = str(data.get("status", "running"))
        segments = [
            AsrSegment(
                text=str(seg.get("text", "")),
                start_ms=seg.get("start_ms"),
                end_ms=seg.get("end_ms"),
                speaker=str(seg.get("speaker", "unknown")),
            )
            for seg in (data.get("segments") or [])
        ]
        return AsrJobResult(
            status=status,
            segments=segments,
            full_text=str(data.get("full_text", "")),
            duration_ms=data.get("duration_ms"),
            error_code=data.get("error_code"),
            error_message=data.get("error_message"),
        )


def _mock_transcript(file_name: str, hotwords: str) -> str:
    """Mock 转写内容: 文件名去后缀 + 热词注入 (用于演示/测试可断言)."""
    stem = file_name.rsplit(".", 1)[0] if "." in file_name else file_name
    words = "、".join(hotwords.split()) if hotwords else "阿莫西林胶囊"
    return f"本次接待记录于文件 {stem}，重点介绍了 {words} 的用法与注意事项。"
