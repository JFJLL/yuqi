"""导出 OpenAPI JSON, 供前端 openapi-typescript 生成类型.

用法: python scripts/export_openapi.py [输出路径]
不连接数据库, 仅构建路由表。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app  # noqa: E402


def main() -> None:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2] / "openapi.json"
    schema = app.openapi()
    out.write_text(json.dumps(schema, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"openapi.json written: {out}")


if __name__ == "__main__":
    main()
