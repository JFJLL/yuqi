"""组织/员工/门店 Pydantic 模型."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class OrgNodeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    parent_id: uuid.UUID | None = None
    node_type: str
    name: str
    code: str
    sort_order: int
    status: str


class OrgNodeTreeItem(OrgNodeOut):
    children: list[OrgNodeTreeItem] = []


class OrgNodeCreate(BaseModel):
    parent_id: uuid.UUID | None = None
    node_type: str = Field(pattern="^(HQ|REGION|STORE|GROUP)$")
    name: str = Field(min_length=1, max_length=128)
    code: str = Field(min_length=1, max_length=64)
    sort_order: int = 0


class StoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    node_id: uuid.UUID
    name: str
    code: str
    address: str | None = None
    phone: str | None = None
    status: str


class EmployeeOut(BaseModel):
    """员工列表: 手机号默认脱敏 (详情接口按权限返回完整)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    employee_no: str
    name: str
    mobile: str | None = None
    mobile_masked: str | None = None
    job_title: str | None = None
    organization_node_id: uuid.UUID | None = None
    store_id: uuid.UUID | None = None
    store_name: str | None = None
    manager_id: uuid.UUID | None = None
    employment_status: str
    account_status: str
    joined_at: date | None = None
    left_at: date | None = None
    created_at: datetime


class EmployeeCreate(BaseModel):
    employee_no: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=128)
    mobile: str = Field(min_length=5, max_length=32)
    job_title: str | None = None
    organization_node_id: uuid.UUID | None = None
    store_id: uuid.UUID | None = None
    manager_id: uuid.UUID | None = None
    joined_at: date | None = None


def mask_mobile(mobile: str | None) -> str | None:
    if not mobile:
        return None
    if len(mobile) < 7:
        return mobile[:1] + "***"
    return mobile[:3] + "****" + mobile[-4:]
