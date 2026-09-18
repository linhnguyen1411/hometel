from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from datetime import datetime, timezone

from app.core.config import settings
from app.core.database import engine, Base
from app.common.response import success_response, error_response

# Import all models to register with Base.metadata
import app.modules.auth.models
import app.modules.properties.models
import app.modules.rentals.models
import app.modules.billing.models
import app.modules.services.models
import app.modules.crm.models
import app.modules.finance.models
import app.modules.notifications.models

# Routers
from app.modules.auth.router import router as auth_router
from app.modules.properties.router import router as properties_router
from app.modules.operations.router import router as operations_router
from app.modules.rentals.router import rentals_router
from app.modules.billing.router import billing_router
from app.modules.services.router import services_router, service_requests_router, reviews_router
from app.modules.crm.router import crm_router
from app.modules.finance.router import finance_router
from app.modules.notifications.router import push_router, notifications_router
from app.modules.admin.router import admin_router


from sqlalchemy import text

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Verify database connectivity (DDL schema managed purely via Alembic migrations)
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    yield
    # Shutdown
    await engine.dispose()



app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Enterprise Multi-Tenant Property Rental & Smart Operations Backend",
    openapi_url="/api/v1/openapi.json",
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger("homtel.main")


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return error_response(
        code=f"HTTP_{exc.status_code}",
        message=str(exc.detail),
        status_code=exc.status_code,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return error_response(
        code="VALIDATION_ERROR",
        message="Dữ liệu gửi lên không hợp lệ.",
        status_code=422,
        details=exc.errors(),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Exception on {request.method} {request.url}: {exc}", exc_info=True)
    return error_response(
        code="INTERNAL_ERROR",
        message="Lỗi máy chủ nội bộ. Vui lòng thử lại sau.",
        status_code=500,
        details=str(exc) if getattr(settings, "DEBUG", False) else None,
    )


# Health check
@app.get("/api/health", tags=["Health & Observability"])
async def health_check():
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "framework": "FastAPI 0.115+ (Async Python 3.12+)",
    }


# Register Routers under /api/v1
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(properties_router, prefix=settings.API_V1_STR)
app.include_router(operations_router, prefix=settings.API_V1_STR)
app.include_router(rentals_router, prefix=settings.API_V1_STR)
app.include_router(billing_router, prefix=f"{settings.API_V1_STR}/billing")
app.include_router(services_router, prefix=settings.API_V1_STR)
app.include_router(service_requests_router, prefix=settings.API_V1_STR)
app.include_router(reviews_router, prefix=settings.API_V1_STR)
app.include_router(crm_router, prefix=settings.API_V1_STR)
app.include_router(finance_router, prefix=settings.API_V1_STR)
app.include_router(push_router, prefix=settings.API_V1_STR)
app.include_router(notifications_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)
