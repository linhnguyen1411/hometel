from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, TokenPayload
from app.common.response import success_response, error_response
from .schemas import LoginRequest, RegisterTenantRequest
from .service import AuthService

router = APIRouter(prefix="/auth", tags=["Auth & Identity"])


@router.post("/login", summary="Đăng nhập tài khoản")
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        res = await AuthService.login(db, data)
        return success_response(res.model_dump())
    except HTTPException as ex:
        return error_response(code="AUTH_FAILED", message=ex.detail, status_code=ex.status_code)
    except Exception as ex:
        return error_response(code="SERVER_ERROR", message=str(ex), status_code=500)


@router.post("/register", summary="Đăng ký tài khoản cư dân (Tenant)")
async def register(data: RegisterTenantRequest, db: AsyncSession = Depends(get_db)):
    try:
        res = await AuthService.register_tenant(db, data)
        return success_response(res.model_dump(), status_code=201)
    except HTTPException as ex:
        return error_response(code="REGISTRATION_FAILED", message=ex.detail, status_code=ex.status_code)
    except Exception as ex:
        return error_response(code="SERVER_ERROR", message=str(ex), status_code=500)


@router.get("/me", summary="Lấy thông tin tài khoản đang đăng nhập")
async def get_me(
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await AuthService.get_user_by_id(db, current_user.userId)
    if not user:
        return error_response(code="USER_NOT_FOUND", message="Không tìm thấy người dùng", status_code=404)

    memberships_dto = [
        {
            "companyId": m.company_id,
            "companyName": m.company.name if m.company else None,
            "role": m.role,
        }
        for m in user.memberships
        if m.status == "ACTIVE"
    ]

    return success_response({
        "id": user.id,
        "email": user.email,
        "fullName": user.full_name,
        "phone": user.phone,
        "role": user.role,
        "status": user.status,
        "avatarUrl": user.avatar_url,
        "memberships": memberships_dto,
    })
