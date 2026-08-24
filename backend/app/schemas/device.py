"""设备/绑定/知情同意 Pydantic 模型."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    device_code: str
    device_type: str
    vendor: str | None = None
    model: str | None = None
    status: str
    online_status: str
    last_heartbeat_at: datetime | None = None
    battery_level: int | None = None
    firmware_version: str | None = None


class DeviceCreate(BaseModel):
    device_code: str = Field(min_length=1, max_length=64)
    device_type: str = "BADGE"
    vendor: str | None = None
    model: str | None = None


class BindingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    device_id: uuid.UUID
    device_code: str | None = None
    employee_id: uuid.UUID
    employee_name: str | None = None
    store_id: uuid.UUID | None = None
    store_name: str | None = None
    start_at: datetime
    end_at: datetime | None = None
    binding_status: str
    source: str
    created_at: datetime


class BindingRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    device_id: uuid.UUID
    device_code: str | None = None
    employee_id: uuid.UUID
    employee_name: str | None = None
    status: str
    requested_at: datetime
    reviewed_at: datetime | None = None
    review_comment: str | None = None


class BindRequest(BaseModel):
    device_id: uuid.UUID
    employee_id: uuid.UUID
    start_at: datetime | None = None


class UnbindRequest(BaseModel):
    device_id: uuid.UUID
    end_at: datetime | None = None


class ConsentRequest(BaseModel):
    employee_id: uuid.UUID
    policy_name: str = Field(min_length=1, max_length=128)
    policy_version: str = Field(min_length=1, max_length=64)
    content_hash: str = Field(min_length=32, max_length=64)
    device_info: str | None = None
