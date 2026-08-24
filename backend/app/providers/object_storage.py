"""对象存储抽象: 本地文件系统 (开发/测试) 与 OSS/S3 兼容 (生产).

- LocalStorageProvider: 落盘到 settings.local_storage_dir, 无预签名能力 (由 API 流式下载)
- S3CompatibleProvider: 懒加载 boto3, put/get/delete/预签名均在线程池执行
业务代码只依赖 ObjectStorageProvider 协议, 不感知具体实现。
"""

from __future__ import annotations

import asyncio
import hashlib
import os
from pathlib import Path
from typing import Any, Protocol

from app.core.config import Settings
from app.core.logging import get_logger

logger = get_logger("yuqi.storage")


class ObjectStorageProvider(Protocol):
    name: str

    async def put_object(self, key: str, data: bytes, content_type: str | None = None) -> None:
        ...

    async def get_object(self, key: str) -> bytes:
        ...

    async def delete_object(self, key: str) -> None:
        ...

    async def presigned_url(self, key: str, expires_seconds: int = 600) -> str | None:
        """返回临时下载 URL; 不支持时返回 None (调用方走流式下载)."""


class LocalStorageProvider:
    name = "local"

    def __init__(self, base_dir: str) -> None:
        self.base_dir = Path(base_dir)

    def _path(self, key: str) -> Path:
        # 防止路径穿越: 规范化后必须仍位于 base_dir 内
        path = (self.base_dir / key).resolve()
        base = self.base_dir.resolve()
        if not path.is_relative_to(base):
            raise ValueError(f"invalid object key: {key}")
        return path

    async def put_object(self, key: str, data: bytes, content_type: str | None = None) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(path.write_bytes, data)

    async def get_object(self, key: str) -> bytes:
        path = self._path(key)
        if not path.exists():
            raise FileNotFoundError(f"object not found: {key}")
        return await asyncio.to_thread(path.read_bytes)

    async def delete_object(self, key: str) -> None:
        path = self._path(key)
        if path.exists():
            await asyncio.to_thread(path.unlink)

    async def presigned_url(self, key: str, expires_seconds: int = 600) -> str | None:
        return None


class S3CompatibleProvider:
    """S3/OSS 兼容对象存储 (boto3 懒加载)."""

    name = "s3"

    def __init__(self, *, endpoint: str, bucket: str, access_key_id: str, access_key_secret: str) -> None:
        self.endpoint = endpoint
        self.bucket = bucket
        self.access_key_id = access_key_id
        self.access_key_secret = access_key_secret
        self._client: Any | None = None

    def _get_client(self) -> Any:
        if self._client is None:
            import boto3  # type: ignore[import-not-found]

            self._client = boto3.client(
                "s3",
                endpoint_url=self.endpoint or None,
                aws_access_key_id=self.access_key_id,
                aws_secret_access_key=self.access_key_secret,
            )
        return self._client

    async def put_object(self, key: str, data: bytes, content_type: str | None = None) -> None:
        def _put() -> None:
            self._get_client().put_object(
                Bucket=self.bucket, Key=key, Body=data, ContentType=content_type or "application/octet-stream"
            )

        await asyncio.to_thread(_put)

    async def get_object(self, key: str) -> bytes:
        def _get() -> bytes:
            resp = self._get_client().get_object(Bucket=self.bucket, Key=key)
            return resp["Body"].read()

        return await asyncio.to_thread(_get)

    async def delete_object(self, key: str) -> None:
        def _delete() -> None:
            self._get_client().delete_object(Bucket=self.bucket, Key=key)

        await asyncio.to_thread(_delete)

    async def presigned_url(self, key: str, expires_seconds: int = 600) -> str:
        def _url() -> str:
            return self._get_client().generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=expires_seconds,
            )

        return await asyncio.to_thread(_url)


def object_key_for(*, tenant_id: str, audio_file_id: str, file_name: str) -> str:
    """对象存储 key 约定: {tenant}/{yyyy}/{mm}/{audio_id}/{sanitized_name}."""
    safe_name = os.path.basename(file_name).replace("\\", "_").replace("/", "_")
    return f"{tenant_id}/{audio_file_id}/{safe_name}"


def build_object_storage(settings: Settings) -> ObjectStorageProvider:
    provider = settings.storage_provider
    if provider == "s3" or provider == "aliyun_oss":
        return S3CompatibleProvider(
            endpoint=settings.oss_endpoint,
            bucket=settings.oss_bucket,
            access_key_id=settings.oss_access_key_id,
            access_key_secret=settings.oss_access_key_secret,
        )
    return LocalStorageProvider(settings.local_storage_dir)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
