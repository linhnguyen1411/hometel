from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterTenantRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    fullName: str
    phone: Optional[str] = None


class MembershipDto(BaseModel):
    companyId: str
    companyName: Optional[str] = None
    role: str


class UserDto(BaseModel):
    id: str
    email: str
    fullName: str
    phone: Optional[str] = None
    role: str
    status: str
    avatarUrl: Optional[str] = None
    memberships: List[MembershipDto] = []


class AuthResponseData(BaseModel):
    accessToken: str
    refreshToken: str
    expiresIn: int
    user: UserDto
