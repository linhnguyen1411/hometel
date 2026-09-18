import json
from typing import Optional, List
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_

from app.core.database import get_db
from app.core.security import get_current_user, get_optional_user, require_role, TokenPayload
from app.core.authz import (
    get_user_company_ids,
    assert_company_access,
    assert_service_request_access,
    assert_staff_assignment,
)
from app.common.response import success_response
from app.modules.services.models import Service, ServiceRequest, ServiceAssignment, ProviderReview
from app.modules.services.schemas import (
    CreateServiceRequest,
    SubmitServiceRequestInput,
    ReviewServiceRequestInput,
    AssignStaffInput,
    SubmitProviderReviewInput,
)
from app.modules.auth.models import User, Company

services_router = APIRouter(prefix="/services", tags=["services"])
service_requests_router = APIRouter(prefix="/service-requests", tags=["service-requests"])
reviews_router = APIRouter(prefix="/reviews", tags=["reviews"])


# ==========================================
# SERVICES CATALOG
# ==========================================

@services_router.get("")
async def get_services(
    company_id: Optional[str] = Query(None, alias="companyId"),
    category: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[TokenPayload] = Depends(get_optional_user),
):
    query = select(Service)
    if company_id:
        query = query.where(Service.company_id == company_id)
    if category:
        query = query.where(Service.category == category)
    if status_filter:
        query = query.where(Service.status == status_filter)
    elif not company_id:
        query = query.where(Service.status == "ACTIVE")
    if search:
        query = query.where(
            or_(
                Service.name.ilike(f"%{search}%"),
                Service.description.ilike(f"%{search}%")
            )
        )
    
    result = await db.execute(query.order_by(Service.name))
    services = result.scalars().all()
    
    data = []
    for s in services:
        data.append({
            "id": s.id,
            "companyId": s.company_id,
            "name": s.name,
            "slug": s.slug,
            "description": s.description,
            "category": s.category,
            "priceType": s.price_type,
            "basePrice": s.base_price,
            "imageUrl": s.image_url,
            "status": s.status,
            "createdAt": s.created_at.isoformat() if s.created_at else None,
        })
    return success_response(data)


@services_router.get("/slug/{slug}")
async def get_service_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Service).where(Service.slug == slug.lower()))
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    return success_response({
        "id": service.id,
        "companyId": service.company_id,
        "name": service.name,
        "slug": service.slug,
        "description": service.description,
        "category": service.category,
        "priceType": service.price_type,
        "basePrice": service.base_price,
        "imageUrl": service.image_url,
        "status": service.status,
    })


@services_router.get("/workload")
async def get_staff_workload(
    company_id: Optional[str] = Query(None, alias="companyId"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    target_company = company_id
    if not target_company and current_user.memberships:
        target_company = current_user.memberships[0].get("companyId")
    
    if not target_company:
        raise HTTPException(status_code=400, detail="companyId is required")

    if current_user.role != "SUPER_ADMIN":
        user_companies = get_user_company_ids(current_user)
        if target_company not in user_companies:
            raise HTTPException(status_code=403, detail="FORBIDDEN: You do not have access to this company's workload")
    
    # Query assignments for staff in company
    result = await db.execute(
        select(ServiceAssignment)
        .join(ServiceRequest, ServiceAssignment.service_request_id == ServiceRequest.id)
        .where(ServiceRequest.provider_company_id == target_company)
    )
    assignments = result.scalars().all()
    
    workload = [
        {
            "id": a.id,
            "serviceRequestId": a.service_request_id,
            "staffId": a.staff_id,
            "assignedAt": a.assigned_at,
            "status": a.status,
            "notes": a.notes,
        }
        for a in assignments
    ]
    return success_response(workload)


@services_router.post("", status_code=status.HTTP_201_CREATED)
async def create_service(
    payload: CreateServiceRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("PROVIDER", "SUPER_ADMIN")),
):
    assert_company_access(current_user, payload.companyId, ["PROVIDER", "SUPER_ADMIN"])
    new_srv = Service(
        company_id=payload.companyId,
        name=payload.name,
        slug=payload.slug.lower(),
        description=payload.description,
        category=payload.category,
        price_type=payload.priceType,
        base_price=Decimal(str(payload.basePrice)) if payload.basePrice is not None else Decimal("0.00"),
        image_url=payload.imageUrl,
        status="ACTIVE",
    )
    db.add(new_srv)
    await db.commit()
    await db.refresh(new_srv)
    
    return success_response({
        "id": new_srv.id,
        "companyId": new_srv.company_id,
        "name": new_srv.name,
        "slug": new_srv.slug,
        "description": new_srv.description,
        "category": new_srv.category,
        "priceType": new_srv.price_type,
        "basePrice": float(new_srv.base_price),
        "imageUrl": new_srv.image_url,
        "status": new_srv.status,
    }, status_code=201)


# ==========================================
# SERVICE REQUESTS
# ==========================================

@service_requests_router.post("", status_code=status.HTTP_201_CREATED)
async def create_service_request(
    payload: SubmitServiceRequestInput,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    srv_res = await db.execute(select(Service).where(Service.id == payload.serviceId))
    srv = srv_res.scalar_one_or_none()
    if not srv:
        raise HTTPException(status_code=404, detail="Service not found")
    
    new_req = ServiceRequest(
        service_id=payload.serviceId,
        provider_company_id=srv.company_id,
        tenant_id=current_user.user_id,
        room_id=payload.roomId,
        title=payload.title,
        description=payload.description,
        preferred_date=payload.preferredDate,
        urgency=payload.urgency,
        status="PENDING",
    )
    db.add(new_req)
    await db.commit()
    await db.refresh(new_req)
    
    return success_response({
        "id": new_req.id,
        "serviceId": new_req.service_id,
        "providerCompanyId": new_req.provider_company_id,
        "tenantId": new_req.tenant_id,
        "roomId": new_req.room_id,
        "title": new_req.title,
        "description": new_req.description,
        "preferredDate": new_req.preferred_date,
        "urgency": new_req.urgency,
        "status": new_req.status,
    }, status_code=201)


@service_requests_router.get("")
async def list_service_requests(
    company_id: Optional[str] = Query(None, alias="companyId"),
    status_filter: Optional[str] = Query(None, alias="status"),
    urgency: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    query = select(ServiceRequest)
    
    if current_user.role == "TENANT":
        query = query.where(ServiceRequest.tenant_id == current_user.user_id)
    elif current_user.role == "STAFF":
        query = query.join(ServiceAssignment, ServiceAssignment.service_request_id == ServiceRequest.id).where(
            ServiceAssignment.staff_id == current_user.user_id
        )
    elif current_user.role == "SUPER_ADMIN":
        if company_id:
            query = query.where(ServiceRequest.provider_company_id == company_id)
    elif current_user.role == "OWNER":
        target_company = company_id
        if not target_company and current_user.memberships:
            target_company = current_user.memberships[0].get("companyId")
        if target_company:
            from app.modules.properties.models import Room, Building
            query = query.outerjoin(Room, ServiceRequest.room_id == Room.id).outerjoin(Building, Room.building_id == Building.id).where(
                or_(
                    ServiceRequest.provider_company_id == target_company,
                    Building.company_id == target_company
                )
            )
    else:
        # PROVIDER
        target_company = company_id
        if not target_company and current_user.memberships:
            target_company = current_user.memberships[0].get("companyId")
        if target_company:
            query = query.where(ServiceRequest.provider_company_id == target_company)
    
    if status_filter:
        query = query.where(ServiceRequest.status == status_filter)
    if urgency:
        query = query.where(ServiceRequest.urgency == urgency)
        
    result = await db.execute(query.order_by(desc(ServiceRequest.created_at)))
    requests = result.scalars().all()
    
    data = []
    for r in requests:
        data.append({
            "id": r.id,
            "serviceId": r.service_id,
            "providerCompanyId": r.provider_company_id,
            "tenantId": r.tenant_id,
            "roomId": r.room_id,
            "title": r.title,
            "description": r.description,
            "preferredDate": r.preferred_date,
            "urgency": r.urgency,
            "status": r.status,
            "estimatedCost": r.estimated_cost,
            "finalCost": r.final_cost,
            "createdAt": r.created_at.isoformat() if r.created_at else None,
        })
    return success_response(data)


@service_requests_router.get("/{request_id}")
async def get_service_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    r = await assert_service_request_access(db, current_user, request_id)
    
    return success_response({
        "id": r.id,
        "serviceId": r.service_id,
        "providerCompanyId": r.provider_company_id,
        "tenantId": r.tenant_id,
        "roomId": r.room_id,
        "title": r.title,
        "description": r.description,
        "preferredDate": r.preferred_date,
        "urgency": r.urgency,
        "status": r.status,
        "estimatedCost": float(r.estimated_cost) if r.estimated_cost is not None else None,
        "finalCost": float(r.final_cost) if r.final_cost is not None else None,
        "rejectionReason": r.rejection_reason,
        "createdAt": r.created_at.isoformat() if r.created_at else None,
    })


@service_requests_router.post("/{request_id}/review")
async def review_service_request(
    request_id: str,
    payload: ReviewServiceRequestInput,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("PROVIDER", "STAFF", "SUPER_ADMIN")),
):
    r = await assert_service_request_access(db, current_user, request_id)
    if current_user.role != "SUPER_ADMIN":
        user_companies = get_user_company_ids(current_user)
        if r.provider_company_id not in user_companies:
            raise HTTPException(status_code=403, detail="FORBIDDEN: You can only review requests for your provider company")
    
    if payload.action == "APPROVE":
        r.status = "APPROVED"
        if payload.estimatedCost is not None:
            r.estimated_cost = Decimal(str(payload.estimatedCost))
    else:
        r.status = "REJECTED"
        r.rejection_reason = payload.rejectionReason
    
    await db.commit()
    await db.refresh(r)
    return success_response({
        "id": r.id,
        "status": r.status,
        "estimatedCost": float(r.estimated_cost) if r.estimated_cost is not None else None,
        "rejectionReason": r.rejection_reason,
    })


@service_requests_router.post("/{request_id}/assign", status_code=status.HTTP_201_CREATED)
async def assign_service_request(
    request_id: str,
    payload: AssignStaffInput,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("PROVIDER", "STAFF", "SUPER_ADMIN")),
):
    r = await assert_service_request_access(db, current_user, request_id)
    if current_user.role != "SUPER_ADMIN":
        user_companies = get_user_company_ids(current_user)
        if r.provider_company_id not in user_companies:
            raise HTTPException(status_code=403, detail="FORBIDDEN: You can only assign staff for your provider company")

    await assert_staff_assignment(db, r.provider_company_id, payload.staffId)

    r.status = "ASSIGNED"
    if payload.estimatedCost is not None:
        r.estimated_cost = Decimal(str(payload.estimatedCost))
        
    assignment = ServiceAssignment(
        service_request_id=r.id,
        staff_id=payload.staffId,
        assigned_at=datetime.now(timezone.utc).isoformat(),
        status="ASSIGNED",
        notes=payload.notes,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    
    return success_response({
        "id": assignment.id,
        "serviceRequestId": assignment.service_request_id,
        "staffId": assignment.staff_id,
        "status": assignment.status,
        "notes": assignment.notes,
    }, status_code=201)


@service_requests_router.post("/assignments/{assignment_id}/status")
async def update_assignment_status(
    assignment_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    result = await db.execute(select(ServiceAssignment).where(ServiceAssignment.id == assignment_id))
    asg = result.scalar_one_or_none()
    if not asg:
        raise HTTPException(status_code=404, detail="Assignment not found")

    sr = await assert_service_request_access(db, current_user, asg.service_request_id)
    if current_user.role == "STAFF" and asg.staff_id != current_user.userId:
        raise HTTPException(status_code=403, detail="FORBIDDEN: You are not assigned to this service request")

    new_status = payload.get("status")
    if not new_status or new_status not in ["IN_PROGRESS", "COMPLETED", "CANCELLED"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    asg.status = new_status
    if "notes" in payload:
        asg.notes = payload["notes"]
    
    sr.status = new_status
    if payload.get("finalCost") is not None:
        sr.final_cost = Decimal(str(payload["finalCost"]))
            
    await db.commit()
    await db.refresh(asg)
    
    return success_response({
        "id": asg.id,
        "status": asg.status,
        "serviceRequestId": asg.service_request_id,
    })


# ==========================================
# REVIEWS & RATINGS
# ==========================================

@reviews_router.post("", status_code=status.HTTP_201_CREATED)
async def submit_review(
    payload: SubmitProviderReviewInput,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("TENANT", "SUPER_ADMIN")),
):
    sr_res = await db.execute(select(ServiceRequest).where(ServiceRequest.id == payload.serviceRequestId))
    sr = sr_res.scalar_one_or_none()
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found")

    if current_user.role != "SUPER_ADMIN" and sr.tenant_id != current_user.userId:
        raise HTTPException(status_code=403, detail="FORBIDDEN: You can only review your own service requests")

    if sr.status != "COMPLETED":
        raise HTTPException(status_code=400, detail="Can only review completed requests")
    
    # Check if already reviewed
    rev_res = await db.execute(select(ProviderReview).where(ProviderReview.service_request_id == sr.id))
    existing = rev_res.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Service request already reviewed")
    
    review = ProviderReview(
        service_request_id=sr.id,
        provider_company_id=sr.provider_company_id,
        tenant_id=current_user.userId,
        rating=payload.rating,
        punctuality_rating=payload.punctualityRating,
        quality_rating=payload.qualityRating,
        comment=payload.comment,
        tags=json.dumps(payload.tags) if payload.tags else None,
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    
    return success_response({
        "id": review.id,
        "serviceRequestId": review.service_request_id,
        "providerCompanyId": review.provider_company_id,
        "rating": review.rating,
        "punctualityRating": review.punctuality_rating,
        "qualityRating": review.quality_rating,
        "comment": review.comment,
        "tags": json.loads(review.tags) if review.tags else [],
    }, status_code=201)


@reviews_router.get("/pending")
async def get_pending_reviews(
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("TENANT", "SUPER_ADMIN")),
):
    # Completed service requests by this tenant without a review
    query = (
        select(ServiceRequest)
        .outerjoin(ProviderReview, ProviderReview.service_request_id == ServiceRequest.id)
        .where(
            ServiceRequest.tenant_id == current_user.user_id,
            ServiceRequest.status == "COMPLETED",
            ProviderReview.id.is_(None)
        )
    )
    result = await db.execute(query)
    completed_without_review = result.scalars().all()
    
    return success_response([
        {
            "id": r.id,
            "serviceId": r.service_id,
            "providerCompanyId": r.provider_company_id,
            "title": r.title,
            "description": r.description,
            "finalCost": r.final_cost,
            "completedAt": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in completed_without_review
    ])


@reviews_router.get("/provider/{provider_id}")
async def get_provider_reputation(
    provider_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[TokenPayload] = Depends(get_optional_user),
):
    result = await db.execute(
        select(ProviderReview).where(ProviderReview.provider_company_id == provider_id)
    )
    reviews = result.scalars().all()
    
    total = len(reviews)
    avg_rating = round(sum(r.rating for r in reviews) / total, 1) if total > 0 else 5.0
    avg_punctuality = (
        round(sum(r.punctuality_rating for r in reviews if r.punctuality_rating) / len([r for r in reviews if r.punctuality_rating]), 1)
        if any(r.punctuality_rating for r in reviews)
        else 5.0
    )
    avg_quality = (
        round(sum(r.quality_rating for r in reviews if r.quality_rating) / len([r for r in reviews if r.quality_rating]), 1)
        if any(r.quality_rating for r in reviews)
        else 5.0
    )
    
    return success_response({
        "providerId": provider_id,
        "totalReviews": total,
        "averageRating": avg_rating,
        "punctualityRating": avg_punctuality,
        "qualityRating": avg_quality,
        "reviews": [
            {
                "id": r.id,
                "rating": r.rating,
                "punctualityRating": r.punctuality_rating,
                "qualityRating": r.quality_rating,
                "comment": r.comment,
                "tags": json.loads(r.tags) if r.tags else [],
                "createdAt": r.created_at.isoformat() if r.created_at else None,
            }
            for r in reviews
        ]
    })


@reviews_router.get("/request/{request_id}")
async def get_request_review(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    result = await db.execute(select(ProviderReview).where(ProviderReview.service_request_id == request_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="No review found for this work order")
    
    return success_response({
        "id": review.id,
        "serviceRequestId": review.service_request_id,
        "providerCompanyId": review.provider_company_id,
        "rating": review.rating,
        "punctualityRating": review.punctuality_rating,
        "qualityRating": review.quality_rating,
        "comment": review.comment,
        "tags": json.loads(review.tags) if review.tags else [],
        "createdAt": review.created_at.isoformat() if review.created_at else None,
    })
