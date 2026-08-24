"""分环境配置与校验 (pydantic-settings)."""

from __future__ import annotations

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # 运行环境: dev / test / prod
    env: str = "dev"
    app_name: str = "yuqi-api"
    api_prefix: str = "/api/v1"

    # 数据库 (async)
    database_url: str = "sqlite+aiosqlite:///./yuqi_dev.db"
    # Redis
    redis_url: str = "redis://127.0.0.1:6379/0"
    redis_enabled: bool = True

    # 认证
    jwt_secret: str = "dev-only-insecure-secret-change-me"
    jwt_access_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 14
    access_token_algorithm: str = "HS256"
    # 登录失败限流
    login_max_failures: int = 5
    login_lock_minutes: int = 15

    # 安全
    cors_origins: list[str] = ["http://localhost:8040", "http://127.0.0.1:8040"]
    trusted_proxies: list[str] = ["127.0.0.1"]
    secure_cookies: bool = False  # 生产置 true (HTTPS)

    # 演示数据
    allow_demo_seed: bool = False

    # 内部服务令牌 (OSS Scanner / ASR 网关)
    internal_service_token: str = "dev-internal-token"

    # 存储
    storage_provider: str = "local"  # local | aliyun_oss
    local_storage_dir: str = "./var/storage"
    oss_endpoint: str = ""
    oss_bucket: str = ""
    oss_access_key_id: str = ""
    oss_access_key_secret: str = ""
    oss_signed_url_ttl_seconds: int = 600

    # ASR Provider
    asr_provider: str = "mock"  # mock | private
    asr_private_base_url: str = ""
    asr_private_token: str = ""

    # LLM Provider (预留, 一期默认关闭)
    llm_enabled: bool = False
    llm_base_url: str = ""
    llm_api_key: str = ""
    llm_model: str = ""

    # SMS Provider
    sms_provider: str = "mock"
    sms_mock_fixed_code: str = "123456"  # 仅测试环境
    sms_code_ttl_seconds: int = 300
    sms_max_attempts: int = 5

    @field_validator("jwt_secret")
    @classmethod
    def _jwt_secret_not_default_in_prod(cls, v: str, info) -> str:
        if info.data.get("env") == "prod" and v in ("", "dev-only-insecure-secret-change-me"):
            raise ValueError("生产环境必须设置 JWT_SECRET")
        return v

    @field_validator("internal_service_token")
    @classmethod
    def _service_token_not_default_in_prod(cls, v: str, info) -> str:
        if info.data.get("env") == "prod" and v in ("", "dev-internal-token"):
            raise ValueError("生产环境必须设置 INTERNAL_SERVICE_TOKEN")
        return v

    @field_validator("sms_mock_fixed_code")
    @classmethod
    def _no_fixed_code_in_prod(cls, v: str, info) -> str:
        if info.data.get("env") == "prod" and v:
            raise ValueError("生产环境禁止启用固定验证码 (SMS_MOCK_FIXED_CODE 必须为空)")
        return v

    @field_validator("allow_demo_seed")
    @classmethod
    def _no_seed_in_prod(cls, v: bool, info) -> bool:
        if info.data.get("env") == "prod" and v:
            raise ValueError("生产环境禁止 ALLOW_DEMO_SEED=true")
        return v

    @property
    def is_prod(self) -> bool:
        return self.env == "prod"

    @property
    def is_test(self) -> bool:
        return self.env == "test"


@lru_cache
def get_settings() -> Settings:
    return Settings()
