import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from .models import User, CompanyMembership, RefreshToken
from .schemas import LoginRequest, RegisterTenantRequest, AuthResponseData, UserDto, MembershipDto


class AuthService:
    @staticmethod
    async def get_user_with_memberships(session: AsyncSession, email: str) -> Optional[User]:
        stmt = (
            select(User)
            .options(selectinload(User.memberships).selectinload(CompanyMembership.company))
            .where(User.email == email)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_by_id(session: AsyncSession, user_id: str) -> Optional[User]:
        stmt = (
            select(User)
            .options(selectinload(User.memberships).selectinload(CompanyMembership.company))
            .where(User.id == user_id)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def login(cls, session: AsyncSession, data: LoginRequest) -> AuthResponseData:
        user = await cls.get_user_with_memberships(session, data.email)
        if not user or not verify_password(data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="INVALID_CREDENTIALS: Email hoặc mật khẩu không chính xác",
            )

        if user.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="ACCOUNT_INACTIVE: Tài khoản đã bị khóa hoặc chưa kích hoạt",
            )

        return await cls._generate_auth_response(session, user)

    @classmethod
    async def register_tenant(cls, session: AsyncSession, data: RegisterTenantRequest) -> AuthResponseData:
        existing = await cls.get_user_with_memberships(session, data.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="EMAIL_EXISTS: Email này đã được đăng ký trên hệ thống",
            )

        new_user = User(
            email=data.email,
            password_hash=get_password_hash(data.password),
            full_name=data.fullName,
            phone=data.phone,
            role="TENANT",
            status="ACTIVE",
            avatar_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed={data.fullName}",
        )
        session.add(new_user)
        await session.flush()
        await session.refresh(new_user, attribute_names=["memberships"])

        return await cls._generate_auth_response(session, new_user)

    @classmethod
    async def _generate_auth_response(cls, session: AsyncSession, user: User) -> AuthResponseData:
        memberships_list = [
            {"companyId": m.company_id, "role": m.role} for m in user.memberships if m.status == "ACTIVE"
        ]

        access_token = create_access_token(
            user_id=user.id,
            email=user.email,
            role=user.role,
            memberships=memberships_list,
        )

        raw_refresh = secrets.token_hex(32)
        token_hash = hashlib.sha256(raw_refresh.encode()).hexdigest()
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        refresh_record = RefreshToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        session.add(refresh_record)
        await session.flush()

        memberships_dto = [
            MembershipDto(
                companyId=m.company_id,
                companyName=m.company.name if m.company else None,
                role=m.role,
            )
            for m in user.memberships
            if m.status == "ACTIVE"
        ]

        user_dto = UserDto(
            id=user.id,
            email=user.email,
            fullName=user.full_name,
            phone=user.phone,
            role=user.role,
            status=user.status,
            avatarUrl=user.avatar_url,
            memberships=memberships_dto,
        )

        return AuthResponseData(
            accessToken=access_token,
            refreshToken=raw_refresh,
            expiresIn=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user_dto,
        )
