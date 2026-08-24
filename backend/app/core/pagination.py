"""服务端分页/排序/筛选通用结构."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Query


@dataclass
class PageParams:
    page: int = Query(1, ge=1)
    page_size: int = Query(20, ge=1, le=200)
    sort_by: str = Query("created_at")
    sort_dir: str = Query("desc", pattern="^(asc|desc)$")


def page_meta(page: int, page_size: int, total: int) -> dict:
    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": (total + page_size - 1) // page_size if page_size else 0,
    }
