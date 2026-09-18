import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.core.security import get_current_user, require_role, TokenPayload, hash_password
from app.common.response import success_response
from app.modules.auth.models import User, Company, CompanyMembership
from app.modules.properties.models import Building, Room
from app.modules.rentals.models import RentalContract
from app.modules.notifications.models import AuditLog

admin_router = APIRouter(prefix="/admin", tags=["admin"])


class CreateOwnerOrProviderInput(BaseModel):
    email: EmailStr
    password: str
    fullName: str
    phone: Optional[str] = None
    companyName: str
    companyType: str
    taxCode: Optional[str] = None
    businessRegistrationNumber: Optional[str] = None
    companyPhone: Optional[str] = None
    companyEmail: Optional[str] = None
    companyAddress: Optional[str] = None


@admin_router.get("/stats")
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("SUPER_ADMIN")),
):
    users_count = (await db.execute(select(func.count(User.id)))).scalar() or 0
    companies_count = (await db.execute(select(func.count(Company.id)))).scalar() or 0
    buildings_count = (await db.execute(select(func.count(Building.id)))).scalar() or 0
    rooms_count = (await db.execute(select(func.count(Room.id)))).scalar() or 0
    contracts_count = (await db.execute(select(func.count(RentalContract.id)))).scalar() or 0

    return success_response({
        "totalUsers": users_count,
        "totalCompanies": companies_count,
        "totalBuildings": buildings_count,
        "totalRooms": rooms_count,
        "activeContracts": contracts_count,
    })


@admin_router.post("/owners", status_code=status.HTTP_201_CREATED)
async def create_owner(
    payload: CreateOwnerOrProviderInput,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("SUPER_ADMIN")),
):
    # Check email
    res = await db.execute(select(User).where(User.email == payload.email))
    if res.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already exists")

    # Create user
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.fullName,
        phone=payload.phone,
        role="OWNER",
        status="ACTIVE",
    )
    db.add(user)
    await db.flush()

    # Create company
    company = Company(
        name=payload.companyName,
        type="OWNER_OPERATOR",
        tax_code=payload.taxCode,
        phone=payload.companyPhone,
        email=payload.companyEmail,
        address=payload.companyAddress,
        status="ACTIVE",
    )
    db.add(company)
    await db.flush()

    # Create membership
    membership = CompanyMembership(
        user_id=user.id,
        company_id=company.id,
        role="OWNER",
        status="ACTIVE",
    )
    db.add(membership)

    # Log audit
    audit = AuditLog(
        actor_id=current_user.user_id,
        actor_email=current_user.email,
        action="CREATE_OWNER_ATOMIC",
        entity_type="USER",
        entity_id=user.id,
        new_value=f"Company {company.id}, User {user.id}",
    )
    db.add(audit)
    await db.commit()

    return success_response({
        "user": {"id": user.id, "email": user.email, "fullName": user.full_name, "role": user.role},
        "company": {"id": company.id, "name": company.name, "type": company.type},
    }, status_code=201)


@admin_router.post("/providers", status_code=status.HTTP_201_CREATED)
async def create_provider(
    payload: CreateOwnerOrProviderInput,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("SUPER_ADMIN")),
):
    # Check email
    res = await db.execute(select(User).where(User.email == payload.email))
    if res.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already exists")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.fullName,
        phone=payload.phone,
        role="PROVIDER",
        status="ACTIVE",
    )
    db.add(user)
    await db.flush()

    company = Company(
        name=payload.companyName,
        type="SERVICE_PARTNER",
        tax_code=payload.taxCode,
        phone=payload.companyPhone,
        email=payload.companyEmail,
        address=payload.companyAddress,
        status="ACTIVE",
    )
    db.add(company)
    await db.flush()

    membership = CompanyMembership(
        user_id=user.id,
        company_id=company.id,
        role="PROVIDER_ADMIN",
        status="ACTIVE",
    )
    db.add(membership)

    audit = AuditLog(
        actor_id=current_user.user_id,
        actor_email=current_user.email,
        action="CREATE_PROVIDER_ATOMIC",
        entity_type="USER",
        entity_id=user.id,
        new_value=f"Company {company.id}, User {user.id}",
    )
    db.add(audit)
    await db.commit()

    return success_response({
        "user": {"id": user.id, "email": user.email, "fullName": user.full_name, "role": user.role},
        "company": {"id": company.id, "name": company.name, "type": company.type},
    }, status_code=201)


@admin_router.get("/users")
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100, alias="pageSize"),
    role: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("SUPER_ADMIN")),
):
    query = select(User)
    if role:
        query = query.where(User.role == role)
    if status_filter:
        query = query.where(User.status == status_filter)
    if search:
        query = query.where(
            or_(
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
                User.phone.ilike(f"%{search}%")
            )
        )

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    res = await db.execute(query.order_by(desc(User.created_at)).offset((page - 1) * page_size).limit(page_size))
    users = res.scalars().all()

    return success_response({
        "items": [
            {
                "id": u.id,
                "email": u.email,
                "fullName": u.full_name,
                "phone": u.phone,
                "role": u.role,
                "status": u.status,
                "createdAt": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
        "pagination": {"page": page, "pageSize": page_size, "total": total}
    })


@admin_router.get("/companies")
async def list_companies(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100, alias="pageSize"),
    company_type: Optional[str] = Query(None, alias="type"),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("SUPER_ADMIN")),
):
    query = select(Company)
    if company_type:
        query = query.where(Company.type == company_type)
    if status_filter:
        query = query.where(Company.status == status_filter)
    if search:
        query = query.where(
            or_(
                Company.name.ilike(f"%{search}%"),
                Company.tax_code.ilike(f"%{search}%")
            )
        )

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    res = await db.execute(query.order_by(desc(Company.created_at)).offset((page - 1) * page_size).limit(page_size))
    comps = res.scalars().all()

    return success_response({
        "items": [
            {
                "id": c.id,
                "name": c.name,
                "type": c.type,
                "taxCode": c.tax_code,
                "phone": c.phone,
                "email": c.email,
                "status": c.status,
                "createdAt": c.created_at.isoformat() if c.created_at else None,
            }
            for c in comps
        ],
        "pagination": {"page": page, "pageSize": page_size, "total": total}
    })


@admin_router.get("/audit-logs")
async def list_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    entity_type: Optional[str] = Query(None, alias="entityType"),
    action: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("SUPER_ADMIN")),
):
    query = select(AuditLog)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if action:
        query = query.where(AuditLog.action == action)

    res = await db.execute(query.order_by(desc(AuditLog.created_at)).limit(limit))
    logs = res.scalars().all()

    return success_response([
        {
            "id": l.id,
            "actorId": l.actor_id,
            "actorEmail": l.actor_email,
            "action": l.action,
            "entityType": l.entity_type,
            "entityId": l.entity_id,
            "oldValue": l.old_value,
            "newValue": l.new_value,
            "createdAt": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ])
