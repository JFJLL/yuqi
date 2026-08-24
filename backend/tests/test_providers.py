"""Provider 测试: 本地对象存储往返 / Mock ASR 提交与轮询."""

from __future__ import annotations

import pytest

from app.providers.asr import MockAsrProvider
from app.providers.object_storage import LocalStorageProvider, object_key_for


@pytest.mark.asyncio
async def test_local_storage_roundtrip(tmp_path):
    provider = LocalStorageProvider(str(tmp_path))
    key = object_key_for(tenant_id="t1", audio_file_id="a1", file_name="rec/../evil.wav")
    data = b"\x00\x01\x02" * 10
    await provider.put_object(key, data, "audio/wav")
    assert await provider.get_object(key) == data
    assert await provider.presigned_url(key) is None  # 本地无预签名
    await provider.delete_object(key)
    with pytest.raises(FileNotFoundError):
        await provider.get_object(key)


@pytest.mark.asyncio
async def test_local_storage_blocks_path_traversal(tmp_path):
    provider = LocalStorageProvider(str(tmp_path))
    with pytest.raises(ValueError):
        await provider.put_object("../../escape.bin", b"x")


@pytest.mark.asyncio
async def test_mock_asr_submit_and_poll():
    provider = MockAsrProvider()
    job_id = await provider.submit(
        object_key="t/a/rec.wav", file_name="rec.wav", language="zh-CN", hotwords="阿莫西林"
    )
    assert job_id.startswith("mock-")
    result = await provider.poll(job_id)
    assert result.status == "succeeded"
    assert result.segments
    assert "阿莫西林" in result.full_text
    missing = await provider.poll("mock-nonexistent")
    assert missing.status == "failed"
