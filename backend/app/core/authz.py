from typing import Optional, Set, Sequence, List
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import TokenPayload
from app.modules.auth.models import CompanyMembership, User
from app.modules.properties.models import Building, Room
from app.modules.rentals.models import RentalContract
from app.modules.billing.models import Invoice
from app.modules.services.models import ServiceRequest, ServiceAssignment


def get_user_company_ids(current_user: TokenPayload) -> Set[str]:
    """Return all active company IDs associated with the current user."""
    if not current_user.memberships:
        return set()
    return {m.companyId for m in current_user.memberships if m.companyId}


def resolve_owner_company_id(
    current_user: TokenPayload,
    requested_company_id: Optional[str] = None
) -> str:
    """
    Resolve and authorize the company ID for create/update operations.
    Rejects any requested_company_id that the authenticated user does not belong to.
    Removes any hardcoded fallback.
    """
    if current_user.role == "SUPER_ADMIN":
        if requested_company_id:
            return requested_company_id
        user_companies = get_user_company_ids(current_user)
        if user_companies:
            return next(iter(user_companies))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MISSING_COMPANY_ID: Super admin must specify a target companyId"
        )

    user_companies = get_user_company_ids(current_user)
    if not user_companies:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN: User has no active company memberships"
        )

    if requested_company_id:
        if requested_company_id not in user_companies:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"FORBIDDEN: You do not have permission to manage company '{requested_company_id}'"
            )
        return requested_company_id

    # Default to first company membership
    return next(iter(user_companies))


def assert_company_access(
    current_user: TokenPayload,
    target_company_id: str,
    allowed_roles: Optional[Sequence[str]] = None,
) -> str:
    """Verify that current_user has authorized access to target_company_id."""
    if current_user.role == "SUPER_ADMIN":
        return target_company_id

    user_companies = get_user_company_ids(current_user)
    if target_company_id not in user_companies:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"FORBIDDEN: Access to company '{target_company_id}' is denied"
        )

    if allowed_roles:
        matching_memberships = [
            m for m in current_user.memberships
            if m.companyId == target_company_id and m.role in allowed_roles
        ]
        if not matching_memberships:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"FORBIDDEN: Required company role not met for company '{target_company_id}'"
            )

    return target_company_id


async def assert_public_building_access(
    db: AsyncSession,
    building_id: str,
) -> Building:
    """Fetch building for public viewing (catalog/exploration)."""
    stmt = select(Building).where(Building.id == building_id)
    res = await db.execute(stmt)
    bld = res.scalar_one_or_none()
    if not bld:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Building not found")
    return bld


async def assert_private_building_access(
    db: AsyncSession,
    current_user: TokenPayload,
    building_id: str,
) -> Building:
    """
    Fetch building and assert authorized private/operational access.
    Authorized if:
    - SUPER_ADMIN
    - OWNER or STAFF belonging to the building's company
    - TENANT with an active, pending, or draft lease contract in this building
    Rejects unrelated tenants, cross-company owners/staff, and unauthorized roles with 403.
    """
    stmt = select(Building).where(Building.id == building_id)
    res = await db.execute(stmt)
    bld = res.scalar_one_or_none()
    if not bld:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Building not found")

    if current_user.role == "SUPER_ADMIN":
        return bld

    if current_user.role in ("OWNER", "STAFF"):
        user_companies = get_user_company_ids(current_user)
        if bld.company_id not in user_companies:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="FORBIDDEN: You do not have access to this building"
            )
        return bld

    if current_user.role == "TENANT":
        # Check if tenant has an active/pending/draft lease in this building
        lease_check = await db.execute(
            select(RentalContract.id)
            .join(Room, RentalContract.room_id == Room.id)
            .where(
                Room.building_id == building_id,
                RentalContract.tenant_id == current_user.userId,
                RentalContract.status.in_(["ACTIVE", "PENDING", "DRAFT"])
            )
        )
        if not lease_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="FORBIDDEN: You do not lease any room in this building"
            )
        return bld

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="FORBIDDEN: Role not authorized for private building access"
    )


# Backward-compatible alias: by default, any building access assertion must be private
assert_building_access = assert_private_building_access


async def assert_room_access(
    db: AsyncSession,
    current_user: TokenPayload,
    room_id: str,
    for_update: bool = False,
) -> Room:
    """Fetch room and assert that current_user has authorized access to it."""
    stmt = select(Room).options(selectinload(Room.building)).where(Room.id == room_id)
    if for_update:
        stmt = stmt.with_for_update()
    res = await db.execute(stmt)
    room = res.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    if current_user.role == "SUPER_ADMIN":
        return room

    user_companies = get_user_company_ids(current_user)
    if current_user.role in ("OWNER", "STAFF"):
        if room.company_id not in user_companies:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="FORBIDDEN: You do not have access to this room"
            )
        return room

    if current_user.role == "TENANT":
        # Tenant can only access room if they have an active or pending contract on it
        c_stmt = select(RentalContract).where(
            RentalContract.room_id == room_id,
            RentalContract.tenant_id == current_user.userId,
            RentalContract.status.in_(["ACTIVE", "PENDING", "DRAFT"])
        )
        c_res = await db.execute(c_stmt)
        contract = c_res.scalar_one_or_none()
        if not contract:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="FORBIDDEN: You do not have an active rental contract for this room"
            )
        return room

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="FORBIDDEN: Role not authorized for room access"
    )


async def assert_contract_access(
    db: AsyncSession,
    current_user: TokenPayload,
    contract_id: str,
    for_update: bool = False,
) -> RentalContract:
    """Fetch rental contract and assert that current_user has authorized access to it."""
    stmt = select(RentalContract).where(RentalContract.id == contract_id)
    if for_update:
        stmt = stmt.with_for_update()
    res = await db.execute(stmt)
    contract = res.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")

    if current_user.role == "SUPER_ADMIN":
        return contract

    if current_user.role == "TENANT":
        if contract.tenant_id != current_user.userId:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="FORBIDDEN: You do not have access to this contract"
            )
        return contract

    if current_user.role in ("OWNER", "STAFF"):
        user_companies = get_user_company_ids(current_user)
        if contract.company_id not in user_companies:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="FORBIDDEN: You do not have access to this contract"
            )
        return contract

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="FORBIDDEN")


async def assert_invoice_access(
    db: AsyncSession,
    current_user: TokenPayload,
    invoice_id: str,
    for_update: bool = False,
) -> Invoice:
    """Fetch invoice and assert that current_user has authorized access to it."""
    stmt = select(Invoice).where(Invoice.id == invoice_id)
    if for_update:
        stmt = stmt.with_for_update()
    res = await db.execute(stmt)
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    if current_user.role == "SUPER_ADMIN":
        return inv

    if current_user.role == "TENANT":
        if inv.tenant_id != current_user.userId:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="FORBIDDEN: You do not have access to this invoice"
            )
        return inv

    if current_user.role in ("OWNER", "STAFF"):
        user_companies = get_user_company_ids(current_user)
        if inv.company_id not in user_companies:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="FORBIDDEN: You do not have access to this invoice"
            )
        return inv

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="FORBIDDEN")


async def assert_service_request_access(
    db: AsyncSession,
    current_user: TokenPayload,
    request_id: str,
) -> ServiceRequest:
    """Fetch service request and assert that current_user has authorized access to it."""
    stmt = select(ServiceRequest).where(ServiceRequest.id == request_id)
    res = await db.execute(stmt)
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service request not found")

    if current_user.role == "SUPER_ADMIN":
        return req

    if current_user.role == "TENANT":
        if req.tenant_id != current_user.userId:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="FORBIDDEN: You do not have access to this service request"
            )
        return req

    user_companies = get_user_company_ids(current_user)

    if current_user.role == "PROVIDER":
        if req.provider_company_id not in user_companies:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="FORBIDDEN: You do not have access to this service request"
            )
        return req

    if current_user.role == "STAFF":
        if req.provider_company_id in user_companies:
            return req
        # Or check if staff is specifically assigned
        asg_stmt = select(ServiceAssignment).where(
            ServiceAssignment.service_request_id == request_id,
            ServiceAssignment.staff_id == current_user.userId
        )
        asg_res = await db.execute(asg_stmt)
        if asg_res.scalar_one_or_none():
            return req
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN: You are not assigned to this service request"
        )

    if current_user.role == "OWNER":
        if req.room_id:
            rm_stmt = select(Room).options(selectinload(Room.building)).where(Room.id == req.room_id)
            rm_res = await db.execute(rm_stmt)
            room = rm_res.scalar_one_or_none()
            if room and room.company_id in user_companies:
                return req
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN: You do not have access to this service request"
        )

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="FORBIDDEN")


async def assert_staff_assignment(
    db: AsyncSession,
    provider_company_id: str,
    staff_id: str,
) -> User:
    """Verify that staff_id belongs to provider_company_id with an active staff/provider role."""
    stmt = (
        select(User)
        .join(CompanyMembership, CompanyMembership.user_id == User.id)
        .where(
            User.id == staff_id,
            CompanyMembership.company_id == provider_company_id,
            CompanyMembership.status == "ACTIVE",
            CompanyMembership.role.in_(["STAFF", "PROVIDER"])
        )
    )
    res = await db.execute(stmt)
    staff = res.scalar_one_or_none()
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"INVALID_STAFF_ASSIGNMENT: Staff '{staff_id}' does not belong to provider company '{provider_company_id}'"
        )
    return staff
