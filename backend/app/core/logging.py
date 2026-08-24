"""结构化日志 + 脱敏 (Bearer/密码/Key)."""

from __future__ import annotations

import logging
import re
import sys

import structlog

_SENSITIVE = re.compile(
    r"(Bearer\s+[A-Za-z0-9._~+/=-]+|"
    r"password[\"']?\s*[:=]\s*[\"'][^\"']+[\"']|"
    r"(?:api[_-]?key|secret|token)[\"']?\s*[:=]\s*[\"'][^\"']+[\"']|"
    r"(?:api[_-]?key|secret|token)=[A-Za-z0-9._~+/=-]{8,})",
    re.IGNORECASE,
)


def redact(message: str) -> str:
    return _SENSITIVE.sub("[redacted]", message)


class RedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            record.msg = redact(str(record.msg))
        except Exception:  # pragma: no cover - 防御
            pass
        return True


def setup_logging(level: int = logging.INFO) -> None:
    root = logging.getLogger()
    root.setLevel(level)
    if not root.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.addFilter(RedactingFilter())
        root.addHandler(handler)

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(ensure_ascii=False),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)
