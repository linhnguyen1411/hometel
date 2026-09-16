from typing import Any, Optional
from fastapi.responses import JSONResponse
from .schemas import ApiResponse, PaginationMeta, ErrorDetail


def success_response(
    data: Any,
    meta: Optional[PaginationMeta] = None,
    status_code: int = 200,
) -> JSONResponse:
    response_model = ApiResponse(
        success=True,
        data=data,
        meta=meta,
        error=None,
    )
    return JSONResponse(content=response_model.model_dump(mode="json"), status_code=status_code)


def error_response(
    code: str,
    message: str,
    status_code: int = 400,
    details: Optional[Any] = None,
) -> JSONResponse:
    response_model = ApiResponse(
        success=False,
        data=None,
        meta=None,
        error=ErrorDetail(code=code, message=message, details=details),
    )
    return JSONResponse(content=response_model.model_dump(mode="json"), status_code=status_code)
