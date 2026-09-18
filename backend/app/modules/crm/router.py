from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_

from app.core.database import get_db
from app.core.security import get_current_user, require_role, TokenPayload
from app.core.authz import get_user_company_ids, assert_room_access, resolve_owner_company_id
from app.common.response import success_response
from app.modules.crm.models import Lead, Tour
from app.modules.crm.schemas import (
    CreateLeadInput,
    UpdateLeadInput,
    ScheduleTourInput,
    CompleteTourInput,
    ConvertLeadInput,
)
from app.modules.auth.models import User
from app.modules.properties.models import Room
from app.modules.rentals.models import RentalApplication

crm_router = APIRouter(prefix="/crm", tags=["crm"])


# ==========================================
# LEADS
# ==========================================

@crm_router.get("/leads")
async def get_leads(
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("SUPER_ADMIN", "OWNER", "STAFF")),
):
    query = select(Lead)
    if current_user.role != "SUPER_ADMIN":
        user_companies = get_user_company_ids(current_user)
        if not user_companies:
            return success_response([])
        query = query.where(Lead.company_id.in_(user_companies))
    
    if status_filter:
        query = query.where(Lead.status == status_filter)
    if search:
        query = query.where(
            or_(
                Lead.full_name.ilike(f"%{search}%"),
                Lead.phone.ilike(f"%{search}%"),
                Lead.email.ilike(f"%{search}%")
            )
        )
    
    result = await db.execute(query.order_by(desc(Lead.created_at)))
    leads = result.scalars().all()
    
    data = [
        {
            "id": l.id,
            "companyId": l.company_id,
            "fullName": l.full_name,
            "phone": l.phone,
            "email": l.email,
            "source": l.source,
            "status": l.status,
            "budgetMin": l.budget_min,
            "budgetMax": l.budget_max,
            "preferredRoomType": l.preferred_room_type,
            "moveInDate": l.move_in_date,
            "notes": l.notes,
            "assignedStaffId": l.assigned_staff_id,
            "createdAt": l.created_at.isoformat() if l.created_at else None,
        }
        for l in leads
    ]
    return success_response(data)


@crm_router.get("/leads/{lead_id}")
async def get_lead(
    lead_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("SUPER_ADMIN", "OWNER", "STAFF")),
):
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if current_user.role != "SUPER_ADMIN":
        user_companies = get_user_company_ids(current_user)
        if lead.company_id not in user_companies:
            raise HTTPException(status_code=403, detail="FORBIDDEN: You do not have access to this lead")
    
    return success_response({
        "id": lead.id,
        "companyId": lead.company_id,
        "fullName": lead.full_name,
        "phone": lead.phone,
        "email": lead.email,
        "source": lead.source,
        "status": lead.status,
        "budgetMin": lead.budget_min,
        "budgetMax": lead.budget_max,
        "preferredRoomType": lead.preferred_room_type,
        "moveInDate": lead.move_in_date,
        "notes": lead.notes,
        "assignedStaffId": lead.assigned_staff_id,
        "createdAt": lead.created_at.isoformat() if lead.created_at else None,
    })


@crm_router.post("/leads", status_code=status.HTTP_201_CREATED)
async def create_lead(
    payload: CreateLeadInput,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("SUPER_ADMIN", "OWNER", "STAFF")),
):
    company_id = resolve_owner_company_id(current_user, payload.companyId)

    lead = Lead(
        company_id=company_id,
        full_name=payload.fullName,
        phone=payload.phone,
        email=payload.email,
        source=payload.source,
        status="NEW",
        budget_min=payload.budgetMin,
        budget_max=payload.budgetMax,
        preferred_room_type=payload.preferredRoomType,
        move_in_date=payload.moveInDate,
        notes=payload.notes,
        assigned_staff_id=payload.assignedStaffId,
    )
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    
    return success_response({
        "id": lead.id,
        "companyId": lead.company_id,
        "fullName": lead.full_name,
        "phone": lead.phone,
        "email": lead.email,
        "source": lead.source,
        "status": lead.status,
    }, status_code=201)


@crm_router.patch("/leads/{lead_id}")
async def update_lead(
    lead_id: str,
    payload: UpdateLeadInput,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("SUPER_ADMIN", "OWNER", "STAFF")),
):
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if current_user.role != "SUPER_ADMIN":
        user_companies = get_user_company_ids(current_user)
        if lead.company_id not in user_companies:
            raise HTTPException(status_code=403, detail="FORBIDDEN: You do not have access to this lead")
    
    update_data = payload.model_dump(exclude_unset=True)
    if "fullName" in update_data:
        lead.full_name = update_data["fullName"]
    if "phone" in update_data:
        lead.phone = update_data["phone"]
    if "email" in update_data:
        lead.email = update_data["email"]
    if "source" in update_data:
        lead.source = update_data["source"]
    if "status" in update_data:
        lead.status = update_data["status"]
    if "budgetMin" in update_data:
        lead.budget_min = update_data["budgetMin"]
    if "budgetMax" in update_data:
        lead.budget_max = update_data["budgetMax"]
    if "preferredRoomType" in update_data:
        lead.preferred_room_type = update_data["preferredRoomType"]
    if "moveInDate" in update_data:
        lead.move_in_date = update_data["moveInDate"]
    if "notes" in update_data:
        lead.notes = update_data["notes"]
    if "assignedStaffId" in update_data:
        lead.assigned_staff_id = update_data["assignedStaffId"]
        
    await db.commit()
    await db.refresh(lead)
    return success_response({"id": lead.id, "status": lead.status})


# ==========================================
# TOURS
# ==========================================

@crm_router.get("/tours")
async def get_tours(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("SUPER_ADMIN", "OWNER", "STAFF")),
):
    query = select(Tour)
    if current_user.role != "SUPER_ADMIN":
        user_companies = get_user_company_ids(current_user)
        if not user_companies:
            return success_response([])
        query = query.where(Tour.company_id.in_(user_companies))
        
    if status_filter:
        query = query.where(Tour.status == status_filter)
        
    result = await db.execute(query.order_by(desc(Tour.scheduled_at)))
    tours = result.scalars().all()
    
    data = [
        {
            "id": t.id,
            "companyId": t.company_id,
            "leadId": t.lead_id,
            "roomId": t.room_id,
            "hostStaffId": t.host_staff_id,
            "scheduledAt": t.scheduled_at,
            "status": t.status,
            "feedback": t.feedback,
            "rating": t.rating,
        }
        for t in tours
    ]
    return success_response(data)


@crm_router.post("/tours", status_code=status.HTTP_201_CREATED)
async def schedule_tour(
    payload: ScheduleTourInput,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("SUPER_ADMIN", "OWNER", "STAFF")),
):
    lead_res = await db.execute(select(Lead).where(Lead.id == payload.leadId))
    lead = lead_res.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    if current_user.role != "SUPER_ADMIN":
        user_companies = get_user_company_ids(current_user)
        if lead.company_id not in user_companies:
            raise HTTPException(status_code=403, detail="FORBIDDEN: You do not have access to this lead")

    await assert_room_access(db, current_user, payload.roomId)
        
    tour = Tour(
        company_id=lead.company_id,
        lead_id=payload.leadId,
        room_id=payload.roomId,
        scheduled_at=payload.scheduledAt,
        host_staff_id=payload.hostStaffId or current_user.userId,
        status="SCHEDULED",
    )
    lead.status = "TOURED"
    db.add(tour)
    await db.commit()
    await db.refresh(tour)
    
    return success_response({
        "id": tour.id,
        "leadId": tour.lead_id,
        "roomId": tour.room_id,
        "scheduledAt": tour.scheduled_at,
        "status": tour.status,
    }, status_code=201)


@crm_router.patch("/tours/{tour_id}")
async def complete_tour(
    tour_id: str,
    payload: CompleteTourInput,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("SUPER_ADMIN", "OWNER", "STAFF")),
):
    result = await db.execute(select(Tour).where(Tour.id == tour_id))
    tour = result.scalar_one_or_none()
    if not tour:
        raise HTTPException(status_code=404, detail="Tour not found")
    if current_user.role != "SUPER_ADMIN":
        user_companies = get_user_company_ids(current_user)
        if tour.company_id not in user_companies:
            raise HTTPException(status_code=403, detail="FORBIDDEN: You do not have access to this tour")
        
    tour.status = payload.status
    if payload.feedback is not None:
        tour.feedback = payload.feedback
    if payload.rating is not None:
        tour.rating = payload.rating
        
    await db.commit()
    await db.refresh(tour)
    return success_response({
        "id": tour.id,
        "status": tour.status,
        "feedback": tour.feedback,
        "rating": tour.rating,
    })


@crm_router.post("/leads/{lead_id}/convert", status_code=status.HTTP_201_CREATED)
async def convert_lead(
    lead_id: str,
    payload: ConvertLeadInput,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("SUPER_ADMIN", "OWNER", "STAFF")),
):
    lead_res = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = lead_res.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if current_user.role != "SUPER_ADMIN":
        user_companies = get_user_company_ids(current_user)
        if lead.company_id not in user_companies:
            raise HTTPException(status_code=403, detail="FORBIDDEN: You do not have access to this lead")

    await assert_room_access(db, current_user, payload.roomId)
        
    # Find applicant user or fallback to tenant
    applicant_user_id = None
    if lead.email:
        u_res = await db.execute(select(User).where(User.email == lead.email))
        u = u_res.scalar_one_or_none()
        if u:
            applicant_user_id = u.id

    if not applicant_user_id:
        t_res = await db.execute(select(User).where(User.role == "TENANT"))
        t_user = t_res.scalars().first()
        applicant_user_id = t_user.id if t_user else current_user.userId

    # Create RentalApplication for this lead
    app = RentalApplication(
        room_id=payload.roomId,
        applicant_id=applicant_user_id,
        intended_start_date=payload.intendedStartDate,
        lease_duration_months=payload.leaseDurationMonths,
        notes=f"Converted from Lead {lead.full_name} ({lead.phone}). Note: {payload.notes or ''}",
        status="PENDING",
    )
    lead.status = "CONVERTED"
    db.add(app)
    await db.commit()
    await db.refresh(app)
    
    return success_response({
        "leadId": lead.id,
        "applicationId": app.id,
        "status": "CONVERTED",
    }, status_code=201)
