"""统一错误响应规范.

所有 API 错误响应格式:
  {"error": {"code": "...", "message": "...", "request_id": "..."}}
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    """业务错误: status + 稳定错误码."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        super().__init__(message)


def _payload(request: Request, status_code: int, code: str, message: str) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "request_id": getattr(request.state, "request_id", ""),
        }
    }


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_payload(request, exc.status_code, exc.code, exc.message),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "http_error"
        message = str(exc.detail)
        if exc.status_code == 404:
            code = "not_found"
            message = "资源不存在"
        elif exc.status_code == 401:
            code = "unauthorized"
            message = "未认证或登录已过期"
        elif exc.status_code == 403:
            code = "forbidden"
            message = "没有权限执行该操作"
        return JSONResponse(
            status_code=exc.status_code,
            content=_payload(request, exc.status_code, code, message),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_payload(
                request,
                422,
                "validation_error",
                f"请求参数校验失败: {exc.errors()[:5]}",
            ),
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        # 生产不泄露内部细节
        message = "服务器内部错误" if request.app.state.settings.is_prod else str(exc)
        return JSONResponse(
            status_code=500,
            content=_payload(request, 500, "internal_error", message),
        )
