"""认证相关 Pydantic 模型."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64, description="账号或手机号")
    password: str = Field(min_length=1, max_length=128)


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    username: str
    mobile: str | None = None
    display_name: str
    status: str
    is_super_admin: bool
    employee_id: uuid.UUID | None = None
    created_at: datetime
    roles: list[RoleOut] = []


class TenantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    status: str
    is_demo: bool


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut
    tenant: TenantOut
    permissions: list[str]
    data_scope_types: list[str]


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


class AdminResetPasswordRequest(BaseModel):
    user_id: uuid.UUID
    new_password: str = Field(min_length=8, max_length=128)


class MessageResponse(BaseModel):
    ok: bool = True
    message: str = ""
