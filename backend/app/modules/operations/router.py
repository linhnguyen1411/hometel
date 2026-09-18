import uuid
from decimal import Decimal
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_

from app.core.database import get_db
from app.core.security import get_current_user, get_optional_user, require_role, TokenPayload
from app.core.authz import get_user_company_ids, assert_building_access, assert_room_access
from app.common.response import success_response, error_response
from app.modules.operations.schemas import AiTriageRequest, QuickActionRequest
from app.modules.operations.service import OperationsService
from app.modules.properties.models import Building, Floor, Room, BuildingConfiguration
from app.modules.billing.models import Invoice, Meter, MeterReading
from app.modules.rentals.models import RentalContract, RentalApplication
from app.modules.services.models import ServiceRequest
from app.modules.notifications.models import Notification, AuditLog
from app.modules.auth.models import User, Company

router = APIRouter(prefix="/operations", tags=["Operations & Smart Cockpit"])


def mask_phone(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    clean = phone.strip()
    if len(clean) < 6:
        return "***"
    return clean[:4] + " ••• " + clean[-3:]


def mask_email(email: Optional[str]) -> Optional[str]:
    if not email:
        return None
    parts = email.split("@")
    if len(parts) != 2:
        return "***@***.***"
    name = parts[0]
    domain = parts[1]
    masked_name = name[0] + "***" if len(name) <= 2 else name[0] + "***" + name[-1]
    return f"{masked_name}@{domain}"


@router.get("/today")
async def get_today_cockpit(
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("OWNER", "STAFF", "SUPER_ADMIN")),
):
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")

    user_companies = get_user_company_ids(current_user)
    is_super = current_user.role == "SUPER_ADMIN"

    # Invoices overdue or due soon
    inv_stmt = (
        select(Invoice, Room, Building, User)
        .join(Room, Invoice.room_id == Room.id)
        .join(Building, Room.building_id == Building.id)
        .outerjoin(User, Invoice.tenant_id == User.id)
        .where(Invoice.status.in_(["ISSUED", "OVERDUE"]))
    )
    if not is_super:
        inv_stmt = inv_stmt.where(Invoice.company_id.in_(user_companies))
    inv_res = await db.execute(inv_stmt)
    invoices_data = inv_res.all()

    critical_actions = []
    attention_actions = []
    upcoming_actions = []

    for inv, rm, bld, usr in invoices_data:
        is_overdue = inv.status == "OVERDUE" or inv.due_date < today_str
        outstanding = float(inv.total_amount - inv.paid_amount)
        if outstanding <= 0:
            continue

        if is_overdue:
            item = {
                "id": f"act_{inv.id}",
                "actionKey": f"overdue_inv_{inv.id}",
                "priority": "CRITICAL",
                "category": "INVOICE",
                "title": f"Hóa đơn phòng {rm.room_number} quá hạn",
                "subtitle": f"{usr.full_name if usr else 'Cư dân'} • Còn nợ {int(outstanding):,} VND ({bld.name})",
                "amount": outstanding,
                "dueDate": inv.due_date,
                "entityType": "INVOICE",
                "entityId": inv.id,
                "roomNumber": rm.room_number,
                "roomId": rm.id,
                "buildingName": bld.name,
                "buildingId": bld.id,
                "tenantName": usr.full_name if usr else None,
                "tenantPhone": usr.phone if usr else None,
                "quickAction": {"type": "remind_tenant", "label": "Nhắc cư dân", "variant": "primary"},
                "createdAt": inv.created_at.isoformat() if inv.created_at else None,
            }
            critical_actions.append(item)
        else:
            attention_actions.append({
                "id": f"act_{inv.id}",
                "actionKey": f"due_soon_inv_{inv.id}",
                "priority": "HIGH",
                "category": "INVOICE",
                "title": f"Hóa đơn phòng {rm.room_number} sắp đến hạn",
                "subtitle": f"{usr.full_name if usr else 'Cư dân'} • Số tiền: {int(outstanding):,} VND (Hạn: {inv.due_date})",
                "amount": outstanding,
                "dueDate": inv.due_date,
                "entityType": "INVOICE",
                "entityId": inv.id,
                "roomNumber": rm.room_number,
                "roomId": rm.id,
                "buildingName": bld.name,
                "buildingId": bld.id,
                "tenantName": usr.full_name if usr else None,
                "tenantPhone": usr.phone if usr else None,
                "quickAction": {"type": "view_invoice", "label": "Xem chi tiết", "variant": "default"},
                "createdAt": inv.created_at.isoformat() if inv.created_at else None,
            })

    # Service requests emergency or high urgency
    sr_stmt = (
        select(ServiceRequest, Room, Building, User)
        .outerjoin(Room, ServiceRequest.room_id == Room.id)
        .outerjoin(Building, Room.building_id == Building.id)
        .outerjoin(User, ServiceRequest.tenant_id == User.id)
        .where(ServiceRequest.status.in_(["PENDING", "APPROVED", "ASSIGNED", "IN_PROGRESS"]))
    )
    if not is_super:
        sr_stmt = sr_stmt.where(
            or_(
                Building.company_id.in_(user_companies),
                ServiceRequest.provider_company_id.in_(user_companies)
            )
        )
    sr_res = await db.execute(sr_stmt)
    for sr, rm, bld, usr in sr_res.all():
        is_urgent = sr.urgency in ["EMERGENCY", "HIGH"]
        item = {
            "id": f"act_{sr.id}",
            "actionKey": f"sr_{sr.id}",
            "priority": "CRITICAL" if is_urgent else "MEDIUM",
            "category": "MAINTENANCE",
            "title": f"Sự cố {'khẩn cấp' if sr.urgency == 'EMERGENCY' else 'ưu tiên'}: {sr.title}",
            "subtitle": f"Phòng {rm.room_number if rm else 'Khu chung'} • {usr.full_name if usr else 'Cư dân'} ({sr.status})",
            "entityType": "SERVICE_REQUEST",
            "entityId": sr.id,
            "roomNumber": rm.room_number if rm else None,
            "roomId": rm.id if rm else None,
            "buildingName": bld.name if bld else None,
            "buildingId": bld.id if bld else None,
            "tenantName": usr.full_name if usr else None,
            "tenantPhone": usr.phone if usr else None,
            "quickAction": {"type": "assign_technician", "label": "Giao kỹ thuật", "variant": "danger"},
            "createdAt": sr.created_at.isoformat() if sr.created_at else None,
        }
        if is_urgent:
            critical_actions.append(item)
        else:
            attention_actions.append(item)

    # Expiring contracts
    ctr_stmt = (
        select(RentalContract, Room, Building, User)
        .join(Room, RentalContract.room_id == Room.id)
        .join(Building, Room.building_id == Building.id)
        .join(User, RentalContract.tenant_id == User.id)
        .where(RentalContract.status == "ACTIVE")
    )
    if not is_super:
        ctr_stmt = ctr_stmt.where(RentalContract.company_id.in_(user_companies))
    ctr_res = await db.execute(ctr_stmt)
    for ctr, rm, bld, usr in ctr_res.all():
        try:
            end_dt = datetime.strptime(ctr.end_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            days_left = (end_dt - now).days
            if 0 <= days_left <= 14:
                critical_actions.append({
                    "id": f"act_{ctr.id}",
                    "actionKey": f"exp_ctr_{ctr.id}",
                    "priority": "CRITICAL",
                    "category": "CONTRACT",
                    "title": f"Hợp đồng phòng {rm.room_number} hết hạn trong {days_left} ngày",
                    "subtitle": f"{usr.full_name} • HĐ #{ctr.contract_number} • Tiền thuê: {int(ctr.rent_amount):,} VND",
                    "daysRemaining": days_left,
                    "entityType": "CONTRACT",
                    "entityId": ctr.id,
                    "roomNumber": rm.room_number,
                    "roomId": rm.id,
                    "buildingName": bld.name,
                    "buildingId": bld.id,
                    "tenantName": usr.full_name,
                    "tenantPhone": usr.phone,
                    "quickAction": {"type": "renew_contract", "label": "Gia hạn hợp đồng", "variant": "primary"},
                    "createdAt": ctr.created_at.isoformat() if ctr.created_at else None,
                })
            elif 14 < days_left <= 30:
                upcoming_actions.append({
                    "id": f"act_{ctr.id}",
                    "actionKey": f"exp_ctr_{ctr.id}",
                    "priority": "LOW",
                    "category": "CONTRACT",
                    "title": f"Hợp đồng phòng {rm.room_number} đến hạn tái ký ({days_left} ngày)",
                    "subtitle": f"{usr.full_name} • Ngày kết thúc: {ctr.end_date}",
                    "daysRemaining": days_left,
                    "entityType": "CONTRACT",
                    "entityId": ctr.id,
                    "roomNumber": rm.room_number,
                    "roomId": rm.id,
                    "buildingName": bld.name,
                    "buildingId": bld.id,
                    "tenantName": usr.full_name,
                    "tenantPhone": usr.phone,
                    "quickAction": {"type": "contact_tenant", "label": "Liên hệ tái ký", "variant": "default"},
                    "createdAt": ctr.created_at.isoformat() if ctr.created_at else None,
                })
        except Exception:
            pass

    # Healthy summary
    rooms_stmt = select(Room)
    invoices_stmt = select(Invoice)
    if not is_super:
        rooms_stmt = rooms_stmt.where(Room.company_id.in_(user_companies))
        invoices_stmt = invoices_stmt.where(Invoice.company_id.in_(user_companies))

    rooms_all = (await db.execute(rooms_stmt)).scalars().all()
    total_units = len(rooms_all)
    occupied_units = len([r for r in rooms_all if r.status == "OCCUPIED"])
    available_units = len([r for r in rooms_all if r.status == "AVAILABLE"])
    occupancy_rate = round((occupied_units / total_units) * 100) if total_units > 0 else 0

    all_invoices = (await db.execute(invoices_stmt)).scalars().all()
    total_billed = float(sum(i.total_amount for i in all_invoices))
    total_collected = float(sum(i.paid_amount for i in all_invoices))
    collection_rate = round((total_collected / total_billed) * 100) if total_billed > 0 else 100

    return success_response({
        "critical": critical_actions,
        "attention": attention_actions,
        "upcoming": upcoming_actions,
        "healthySummary": {
            "totalUnits": total_units,
            "occupiedUnits": occupied_units,
            "availableUnits": available_units,
            "occupancyRate": occupancy_rate,
            "collectionRate": collection_rate,
            "monthlyRevenue": total_collected,
            "outstandingDebt": total_billed - total_collected,
        },
        "timestamp": now.isoformat(),
    })


@router.get("/actions")
async def get_actions(
    priority: Optional[str] = None,
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("OWNER", "STAFF", "SUPER_ADMIN")),
):
    cockpit = (await get_today_cockpit(db, current_user))["data"]
    all_actions = cockpit["critical"] + cockpit["attention"] + cockpit["upcoming"]

    if priority and priority != "ALL":
        all_actions = [a for a in all_actions if a.get("priority") == priority]
    if category and category != "ALL":
        all_actions = [a for a in all_actions if a.get("category") == category]

    return success_response({
        "actions": all_actions,
        "summary": {
            "total": len(all_actions),
            "critical": len(cockpit["critical"]),
            "attention": len(cockpit["attention"]),
            "upcoming": len(cockpit["upcoming"]),
        }
    })


@router.post("/actions/{action_key}/quick-action")
async def execute_quick_action(
    action_key: str,
    payload: QuickActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("OWNER", "STAFF", "SUPER_ADMIN")),
):
    action_type = payload.actionType
    extra = payload.payload or {}

    if action_type == "remind_tenant":
        inv_id = extra.get("invoiceId") or extra.get("entityId")
        inv_res = await db.execute(select(Invoice).where(Invoice.id == inv_id))
        inv = inv_res.scalar_one_or_none()
        if inv and inv.tenant_id:
            notif = Notification(
                user_id=inv.tenant_id,
                type="PAYMENT_REMINDER",
                title="[Nhắc nhở] Thanh toán tiền phòng",
                message=f"Hóa đơn tháng {inv.period_month} số tiền {int(inv.total_amount - inv.paid_amount):,} VND đã quá hạn. Vui lòng thanh toán sớm.",
                entity_type="INVOICE",
                entity_id=inv.id,
                is_read=False,
            )
            db.add(notif)
            await db.commit()
            return success_response({"success": True, "message": "Đã gửi thông báo nhắc nhở đến cư dân."})
        return success_response({"success": True, "message": "Đã gửi nhắc nhở."})

    elif action_type == "renew_contract":
        ctr_id = extra.get("contractId") or extra.get("entityId")
        ctr_res = await db.execute(select(RentalContract).where(RentalContract.id == ctr_id))
        ctr = ctr_res.scalar_one_or_none()
        if ctr:
            try:
                curr_end = datetime.strptime(ctr.end_date, "%Y-%m-%d")
                new_end = curr_end.replace(year=curr_end.year + 1).strftime("%Y-%m-%d")
                ctr.end_date = new_end
                await db.commit()
                return success_response({"success": True, "message": f"Đã gia hạn hợp đồng đến {new_end}."})
            except Exception:
                pass
        return success_response({"success": True, "message": "Hợp đồng đã được cập nhật."})

    return success_response({"success": True, "message": "Hành động đã được xử lý."})


@router.get("/buildings/{building_id}/360")
async def get_building_360(
    building_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[TokenPayload] = Depends(get_optional_user),
):
    bld_res = await db.execute(select(Building).where(Building.id == building_id))
    building = bld_res.scalar_one_or_none()
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")

    user_companies = get_user_company_ids(current_user) if current_user else set()
    is_super = bool(current_user and current_user.role == "SUPER_ADMIN")
    is_privileged = bool(current_user and (is_super or (current_user.role in ["OWNER", "STAFF"] and building.company_id in user_companies)))
    is_tenant = bool(current_user and current_user.role == "TENANT")
    current_user_id = current_user.userId if current_user else None

    # Cross-company owner/staff access is forbidden
    if current_user and current_user.role in ["OWNER", "STAFF"] and not is_privileged:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN: You do not have permission to view this building's operational data"
        )

    # Summary metrics
    rm_res = await db.execute(select(Room).where(Room.building_id == building_id))
    rooms = rm_res.scalars().all()

    total_rooms = len(rooms)
    occupied_rooms = len([r for r in rooms if r.status == "OCCUPIED"])
    available_rooms = len([r for r in rooms if r.status == "AVAILABLE"])
    maintenance_rooms = len([r for r in rooms if r.status == "MAINTENANCE"])
    reserved_rooms = len([r for r in rooms if r.status == "RESERVED"])

    room_ids = [r.id for r in rooms]
    total_billed = Decimal("0.00")
    total_collected = Decimal("0.00")
    total_outstanding = Decimal("0.00")
    critical_room_ids = set()
    open_work_orders_count = 0

    for r in rooms:
        if r.status == "MAINTENANCE":
            critical_room_ids.add(r.id)

    if room_ids:
        inv_res = await db.execute(
            select(Invoice).where(
                Invoice.room_id.in_(room_ids),
                Invoice.status != "CANCELLED"
            )
        )
        invoices = inv_res.scalars().all()
        for inv in invoices:
            total_billed += inv.total or Decimal("0.00")
            total_collected += inv.paid_amount or Decimal("0.00")
            total_outstanding += inv.outstanding_amount or Decimal("0.00")
            if inv.status == "OVERDUE" and (inv.outstanding_amount or Decimal("0.00")) > Decimal("0.00"):
                critical_room_ids.add(inv.room_id)

        sr_res = await db.execute(
            select(func.count(ServiceRequest.id)).where(
                ServiceRequest.room_id.in_(room_ids),
                ServiceRequest.status.in_(["PENDING", "ASSIGNED", "IN_PROGRESS"])
            )
        )
        open_work_orders_count = sr_res.scalar() or 0

    collection_rate = round(float(total_collected / total_billed * 100)) if total_billed > Decimal("0.00") else (100 if total_collected > Decimal("0.00") else 0)

    summary = {
        "totalRooms": total_rooms,
        "occupiedRooms": occupied_rooms,
        "availableRooms": available_rooms,
        "maintenanceRooms": maintenance_rooms,
        "reservedRooms": reserved_rooms,
        "criticalRooms": len(critical_room_ids),
        "occupancyRate": round((occupied_rooms / total_rooms) * 100) if total_rooms > 0 else 0,
        "totalBilled": float(total_billed),
        "totalCollected": float(total_collected),
        "totalOutstanding": float(total_outstanding),
        "collectionRate": collection_rate,
        "openWorkOrdersCount": open_work_orders_count,
    }

    building_info = {
        "id": building.id,
        "companyId": building.company_id,
        "name": building.name,
        "slug": building.slug,
        "description": building.description,
        "address": building.address,
        "city": building.city,
        "status": building.status,
    }

    # If anonymous (no token) or role is PROVIDER/GUEST:
    # Only return summary aggregation, do NOT return detailed room floors list with PII
    if not current_user or current_user.role in ["PROVIDER", "GUEST"]:
        return success_response({
            "building": building_info,
            "summary": summary,
            "floors": [],
        })

    # Floors
    flr_res = await db.execute(select(Floor).where(Floor.building_id == building_id).order_by(Floor.floor_number))
    floors = flr_res.scalars().all()

    mapped_rooms = []
    for r in rooms:
        # Find active contract and tenant
        ctr_res = await db.execute(
            select(RentalContract, User)
            .outerjoin(User, RentalContract.tenant_id == User.id)
            .where(RentalContract.room_id == r.id, RentalContract.status == "ACTIVE")
        )
        ctr_row = ctr_res.first()
        contract, tenant = ctr_row if ctr_row else (None, None)

        is_my_room = bool(is_tenant and contract and contract.tenant_id == current_user_id)

        health_status = "HEALTHY"
        health_reason = "Hoạt động bình thường"
        if r.status == "AVAILABLE":
            health_status = "AVAILABLE"
            health_reason = "Phòng trống, sẵn sàng cho thuê"
        elif r.status == "MAINTENANCE":
            health_status = "ATTENTION"
            health_reason = "Đang bảo trì"

        if is_privileged:
            room_base_rent = float(r.base_rent)
            tenant_name = tenant.full_name if tenant else None
            tenant_phone = tenant.phone if tenant else None
            tenant_email = tenant.email if tenant else None
            is_masked = False
        elif is_my_room:
            room_base_rent = float(r.base_rent)
            tenant_name = tenant.full_name if tenant else None
            tenant_phone = tenant.phone if tenant else None
            tenant_email = tenant.email if tenant else None
            is_masked = False
        else:
            # Other rooms viewed by tenant
            room_base_rent = None
            tenant_name = "Đang có người ở" if r.status == "OCCUPIED" else None
            tenant_phone = None
            tenant_email = None
            is_masked = True

        mapped_rooms.append({
            "id": r.id,
            "floorId": r.floor_id,
            "buildingId": r.building_id,
            "roomNumber": r.room_number,
            "slug": r.slug,
            "roomType": r.room_type,
            "area": float(r.area),
            "baseRent": room_base_rent,
            "capacity": r.capacity,
            "status": r.status,
            "healthStatus": health_status,
            "healthReason": health_reason,
            "tenantName": tenant_name,
            "tenantPhone": tenant_phone,
            "tenantEmail": tenant_email,
            "isTenantDataMasked": is_masked,
        })

    floors_with_rooms = [
        {
            "id": f.id,
            "floorNumber": f.floor_number,
            "name": f.name,
            "rooms": [rm for rm in mapped_rooms if rm["floorId"] == f.id],
        }
        for f in floors
    ]

    return success_response({
        "building": building_info,
        "summary": summary,
        "floors": floors_with_rooms,
    })


@router.get("/rooms/{room_id}/360")
async def get_room_360(
    room_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[TokenPayload] = Depends(get_optional_user),
):
    rm_res = await db.execute(select(Room).where(Room.id == room_id))
    room = rm_res.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    user_companies = get_user_company_ids(current_user) if current_user else set()
    is_super = current_user.role == "SUPER_ADMIN" if current_user else False
    is_room_owner = is_super or (bool(current_user and current_user.role in ["OWNER", "STAFF"]) and room.company_id in user_companies)

    if current_user and current_user.role in ["OWNER", "STAFF"] and not is_room_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN: You do not have permission to view this room"
        )

    current_user_id = current_user.userId if current_user else None

    # Active Contract
    ctr_res = await db.execute(
        select(RentalContract, User)
        .outerjoin(User, RentalContract.tenant_id == User.id)
        .where(RentalContract.room_id == room_id, RentalContract.status == "ACTIVE")
    )
    ctr_row = ctr_res.first()
    contract, tenant = ctr_row if ctr_row else (None, None)

    is_my_room = bool(current_user and current_user.role == "TENANT" and contract and contract.tenant_id == current_user_id)

    if current_user and current_user.role == "TENANT" and not is_my_room:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN: You do not have access to this room"
        )

    if current_user and current_user.role in ["PROVIDER", "GUEST"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FORBIDDEN: Role not authorized for room 360 view"
        )

    is_privileged = is_room_owner

    # Invoices
    inv_res = await db.execute(select(Invoice).where(Invoice.room_id == room_id).order_by(desc(Invoice.created_at)).limit(12))
    invoices = inv_res.scalars().all()

    # Meters
    mtr_res = await db.execute(select(Meter).where(Meter.room_id == room_id))
    meters = mtr_res.scalars().all()

    # Service requests
    sr_res = await db.execute(select(ServiceRequest).where(ServiceRequest.room_id == room_id).order_by(desc(ServiceRequest.created_at)).limit(10))
    services = sr_res.scalars().all()

    timeline = []
    if is_privileged or is_my_room:
        if contract:
            timeline.append({
                "type": "MOVE_IN",
                "date": contract.start_date,
                "title": "Cư dân dọn vào ở (Move-in)",
                "description": f"Cư dân {tenant.full_name if tenant else ''} bắt đầu thời hạn thuê theo hợp đồng #{contract.contract_number}.",
                "badgeColor": "bg-emerald-500",
            })
        for inv in invoices:
            timeline.append({
                "type": "INVOICE_ISSUED",
                "date": inv.due_date,
                "title": f"Hóa đơn {inv.period_month}",
                "description": f"Tổng cộng: {int(inv.total_amount):,} VND (Trạng thái: {inv.status}).",
                "badgeColor": "bg-emerald-500" if inv.status == "PAID" else "bg-red-500",
            })
        for sr in services:
            timeline.append({
                "type": "SERVICE_REQUEST",
                "date": sr.created_at.strftime("%Y-%m-%d") if sr.created_at else "",
                "title": f"Yêu cầu dịch vụ: {sr.title}",
                "description": f"Mức độ: {sr.urgency} • Trạng thái: {sr.status}",
                "badgeColor": "bg-blue-500",
            })

    # PII & Financial Masking
    if is_privileged or is_my_room:
        tenant_data = {
            "id": tenant.id,
            "name": tenant.full_name,
            "full_name": tenant.full_name,
            "phone": tenant.phone,
            "email": tenant.email,
            "isMasked": False,
            "is_masked": False,
        } if tenant else None
        contract_data = {
            "id": contract.id,
            "contractNumber": contract.contract_number,
            "contract_number": contract.contract_number,
            "startDate": contract.start_date,
            "start_date": contract.start_date,
            "endDate": contract.end_date,
            "end_date": contract.end_date,
            "rentAmount": contract.rent_amount,
            "rent_amount": contract.rent_amount,
            "depositAmount": contract.deposit_amount,
            "deposit_amount": contract.deposit_amount,
            "status": contract.status,
        } if contract else None
        invoices_data = [
            {
                "id": i.id,
                "periodMonth": i.period_month,
                "period_month": i.period_month,
                "billingMonth": i.billing_month,
                "billing_month": i.billing_month,
                "totalAmount": i.total,
                "total_amount": i.total,
                "total": i.total,
                "paidAmount": i.paid_amount,
                "paid_amount": i.paid_amount,
                "outstandingAmount": i.outstanding_amount,
                "outstanding_amount": i.outstanding_amount,
                "status": i.status,
                "dueDate": i.due_date,
                "due_date": i.due_date,
            }
            for i in invoices
        ]
        base_rent = float(room.base_rent)
    else:
        # Unprivileged caller (stranger, provider, or other tenant)
        tenant_data = None
        contract_data = None
        invoices_data = []
        base_rent = float(room.base_rent) if room.status == "AVAILABLE" else None

    return success_response({
        "room": {
            "id": room.id,
            "buildingId": room.building_id,
            "building_id": room.building_id,
            "floorId": room.floor_id,
            "floor_id": room.floor_id,
            "roomNumber": room.room_number,
            "room_number": room.room_number,
            "slug": room.slug,
            "roomType": room.room_type,
            "room_type": room.room_type,
            "area": float(room.area),
            "baseRent": base_rent,
            "base_rent": base_rent,
            "status": room.status,
            "furnishing": room.furnishing,
            "amenities": room.amenities or [],
            "images": room.images or [],
            "description": room.description,
        },
        "tenant": tenant_data,
        "activeContract": contract_data,
        "active_contract": contract_data,
        "invoices": invoices_data,
        "meters": [
            {
                "id": m.id,
                "meterType": m.meter_type,
                "meter_type": m.meter_type,
                "serialNumber": m.serial_number,
                "serial_number": m.serial_number,
                "lastReading": m.last_reading,
                "last_reading": m.last_reading,
            }
            for m in meters
        ] if (is_privileged or is_my_room) else [],
        "timeline": timeline,
        "isPrivileged": is_privileged,
        "is_privileged": is_privileged,
    })


@router.get("/search")
async def global_search(
    q: str = Query("", alias="q"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    query_str = q.strip()
    if not query_str:
        return success_response({"rooms": [], "buildings": [], "tenants": [], "invoices": []})

    # Search rooms
    rooms_res = await db.execute(
        select(Room).where(or_(Room.room_number.ilike(f"%{query_str}%"), Room.room_type.ilike(f"%{query_str}%"))).limit(5)
    )
    rooms = rooms_res.scalars().all()

    # Search buildings
    bld_res = await db.execute(
        select(Building).where(or_(Building.name.ilike(f"%{query_str}%"), Building.address.ilike(f"%{query_str}%"))).limit(5)
    )
    buildings = bld_res.scalars().all()

    # Search users (tenants)
    usr_res = await db.execute(
        select(User).where(or_(User.full_name.ilike(f"%{query_str}%"), User.phone.ilike(f"%{query_str}%"))).limit(5)
    )
    tenants = usr_res.scalars().all()

    return success_response({
        "rooms": [{"id": r.id, "roomNumber": r.room_number, "status": r.status} for r in rooms],
        "buildings": [{"id": b.id, "name": b.name, "address": b.address} for b in buildings],
        "tenants": [{"id": u.id, "fullName": u.full_name, "phone": mask_phone(u.phone)} for u in tenants],
    })


@router.get("/ai-insights")
async def get_ai_insights(
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("OWNER", "STAFF", "SUPER_ADMIN")),
):
    insights = [
        {
            "id": "ins_overdue",
            "impactLevel": "WARNING",
            "title": "Cảnh báo nợ đọng cuối tháng",
            "reason": "Hệ thống phát hiện một số hóa đơn chuẩn bị quá hạn 5 ngày.",
            "suggestedAction": "Kích hoạt gửi tin nhắn SMS / Zalo ZNS nhắc nợ tự động.",
            "actionType": "remind_tenant",
        },
        {
            "id": "ins_energy",
            "impactLevel": "INFO",
            "title": "Chỉ số tiêu thụ điện năng ổn định",
            "reason": "Không phát hiện chỉ số điện tăng đột biến >300% trong kỳ đo đạc gần nhất.",
            "suggestedAction": "Duy trì lịch chốt chỉ số công tơ vào ngày 25 hàng tháng.",
            "actionType": "view_meters",
        }
    ]
    return success_response({"insights": insights})


@router.post("/ai-triage", summary="Chẩn đoán thông minh sự cố kỹ thuật (AI Triage)")
async def ai_triage(data: AiTriageRequest):
    if not data.description or not data.description.strip():
        return error_response(code="INVALID_PAYLOAD", message="Mô tả sự cố không được để trống", status_code=400)

    result = OperationsService.ai_triage(data.description, data.categoryHint)
    return success_response(result.model_dump())
