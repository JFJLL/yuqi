"""批量导入 Pydantic 模型."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ImportBatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    import_type: str
    file_name: str
    status: str
    total_rows: int
    success_rows: int
    failed_rows: int
    error_summary: str | None = None
    created_at: datetime
