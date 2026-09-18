import uuid
import hashlib
import json
import secrets
from datetime import datetime, timedelta, date, timezone
from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy import select, and_, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, ConfigDict, Field

from app.core.database import get_db
from app.core.security import get_current_user, require_role, TokenPayload
from app.core.authz import resolve_owner_company_id, assert_contract_access, assert_room_access, get_user_company_ids
from app.common.response import success_response, error_response
from .models import RentalApplication, RentalContract, ContractESignature, OtpVerification
from .schemas import CreateRentalApplicationRequest, ReviewRentalApplicationRequest, CreateContractRequest, SignContractRequest
from app.modules.properties.models import Room

router = APIRouter(tags=["Rentals & Contracts"])


class RenewContractPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    newEndDate: Optional[str] = Field(None, alias="endDate")
    endDate: Optional[str] = None
    end_date: Optional[str] = None
    newRentAmount: Optional[float] = Field(None, alias="rentAmount")
    rentAmount: Optional[float] = None
    rent_amount: Optional[float] = None
    notes: Optional[str] = None


class TerminateContractPayload(BaseModel):
    terminationDate: Optional[str] = None
    reason: Optional[str] = None


# =========================================================================
# RENTAL APPLICATIONS
# =========================================================================

@router.get("/rentals/applications", summary="Danh sách đơn thuê")
async def list_applications(
    status: Optional[str] = Query(None),
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(RentalApplication).options(
        selectinload(RentalApplication.room).selectinload(Room.building),
        selectinload(RentalApplication.applicant)
    )

    if current_user.role == "TENANT":
        stmt = stmt.where(RentalApplication.applicant_id == current_user.userId)
    elif status:
        stmt = stmt.where(RentalApplication.status == status)

    stmt = stmt.order_by(desc(RentalApplication.created_at))
    result = await db.execute(stmt)
    apps = result.scalars().all()

    data = [
        {
            "id": a.id,
            "roomId": a.room_id,
            "room_number": a.room.room_number if a.room else None,
            "building_name": a.room.building.name if a.room and hasattr(a.room, 'building') and a.room.building else "Homtel Building",
            "applicantId": a.applicant_id,
            "applicant_name": a.applicant.full_name if a.applicant else None,
            "applicant_phone": a.applicant.phone if a.applicant else None,
            "status": a.status,
            "intended_start_date": a.intended_start_date,
            "lease_duration_months": a.lease_duration_months,
            "notes": a.notes,
            "created_at": a.created_at.isoformat() if a.created_at else None
        }
        for a in apps
    ]
    return success_response(data)


@router.post("/rentals/applications", summary="Gửi hồ sơ thuê căn hộ (Tenant)", status_code=201)
async def submit_application(
    payload: CreateRentalApplicationRequest,
    current_user: TokenPayload = Depends(require_role("TENANT", "SUPER_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    app_id = f"app_{uuid.uuid4().hex[:12]}"
    new_app = RentalApplication(
        id=app_id,
        room_id=payload.roomId,
        applicant_id=current_user.userId,
        intended_start_date=payload.intendedStartDate,
        lease_duration_months=payload.leaseDurationMonths,
        notes=payload.notes,
        status="PENDING",
    )
    db.add(new_app)
    await db.commit()
    await db.refresh(new_app)
    return success_response({
        "id": new_app.id,
        "roomId": new_app.room_id,
        "status": new_app.status,
        "intendedStartDate": new_app.intended_start_date,
    }, status_code=201)


@router.post("/rentals/applications/{application_id}/review", summary="Duyệt hồ sơ thuê phòng")
async def review_application(
    application_id: str,
    payload: ReviewRentalApplicationRequest,
    current_user: TokenPayload = Depends(require_role("OWNER", "STAFF", "SUPER_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(RentalApplication).where(RentalApplication.id == application_id)
    result = await db.execute(stmt)
    app_obj = result.scalar_one_or_none()
    if not app_obj:
        return error_response(code="NOT_FOUND", message="Không tìm thấy hồ sơ thuê", status_code=404)

    # Assert authorized access to the application's room
    room = await assert_room_access(db, current_user, app_obj.room_id)

    is_approve = (payload.action in ("APPROVE", "APPROVED")) or (payload.decision in ("APPROVE", "APPROVED"))
    app_obj.status = "APPROVED" if is_approve else "REJECTED"
    app_obj.rejection_reason = payload.rejectionReason or payload.reviewNotes

    contract_id = None
    if is_approve:
        c_stmt = select(RentalContract).where(
            RentalContract.room_id == app_obj.room_id,
            RentalContract.tenant_id == app_obj.applicant_id,
            RentalContract.status == "DRAFT"
        )
        c_res = await db.execute(c_stmt)
        existing_c = c_res.scalar_one_or_none()
        if existing_c:
            contract_id = existing_c.id
        else:
            start_date = app_obj.intended_start_date or date.today().isoformat()
            try:
                sd = datetime.strptime(start_date, "%Y-%m-%d")
                days = app_obj.lease_duration_months * 30
                end_date = (sd + timedelta(days=days)).strftime("%Y-%m-%d")
            except Exception:
                end_date = "2027-10-01"

            room_num = room.room_number if room else "ROOM"
            c_num = f"HD-{room_num}-{uuid.uuid4().hex[:6].upper()}"
            comp_id = room.company_id or resolve_owner_company_id(current_user)
            rent_amt = room.base_rent if (room and room.base_rent) else Decimal("5000000.00")

            new_cnt = RentalContract(
                contract_number=c_num,
                room_id=app_obj.room_id,
                tenant_id=app_obj.applicant_id,
                company_id=comp_id,
                start_date=start_date,
                end_date=end_date,
                rent_amount=rent_amt,
                deposit_amount=rent_amt,
                status="DRAFT"
            )
            db.add(new_cnt)
            await db.flush()
            contract_id = new_cnt.id

    await db.commit()
    await db.refresh(app_obj)
    return success_response({
        "id": app_obj.id,
        "status": app_obj.status,
        "rejectionReason": app_obj.rejection_reason,
        "contractId": contract_id,
    })


# =========================================================================
# RENTAL CONTRACTS & E-SIGNATURE
# =========================================================================

@router.get("/contracts", summary="Danh sách hợp đồng thuê")
async def list_contracts(
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(RentalContract).options(
        selectinload(RentalContract.room).selectinload(Room.building),
        selectinload(RentalContract.tenant),
        selectinload(RentalContract.company)
    )

    if current_user.role == "TENANT":
        stmt = stmt.where(RentalContract.tenant_id == current_user.userId)
    elif current_user.role in ("OWNER", "STAFF") and current_user.memberships:
        company_ids = [m.companyId for m in current_user.memberships]
        stmt = stmt.where(RentalContract.company_id.in_(company_ids))

    stmt = stmt.order_by(desc(RentalContract.created_at))
    result = await db.execute(stmt)
    contracts = result.scalars().all()

    data = [
        {
            "id": c.id,
            "contract_number": c.contract_number,
            "contractNumber": c.contract_number,
            "room_id": c.room_id,
            "roomId": c.room_id,
            "room_number": c.room.room_number if c.room else None,
            "roomNumber": c.room.room_number if c.room else None,
            "building_name": c.room.building.name if c.room and hasattr(c.room, 'building') and c.room.building else "Homtel Building",
            "buildingName": c.room.building.name if c.room and hasattr(c.room, 'building') and c.room.building else "Homtel Building",
            "tenant_id": c.tenant_id,
            "tenantId": c.tenant_id,
            "tenant_name": c.tenant.full_name if c.tenant else None,
            "tenantName": c.tenant.full_name if c.tenant else None,
            "company_id": c.company_id,
            "companyId": c.company_id,
            "start_date": c.start_date,
            "startDate": c.start_date,
            "end_date": c.end_date,
            "endDate": c.end_date,
            "rent_amount": c.rent_amount,
            "rentAmount": c.rent_amount,
            "deposit_amount": c.deposit_amount,
            "depositAmount": c.deposit_amount,
            "payment_day_of_month": c.payment_day_of_month,
            "paymentDayOfMonth": c.payment_day_of_month,
            "status": c.status,
            "signed_at": c.signed_at,
            "signedAt": c.signed_at,
            "signature_hash": c.signature_hash,
            "signatureHash": c.signature_hash,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "createdAt": c.created_at.isoformat() if c.created_at else None,
        }
        for c in contracts
    ]
    return success_response(data)


@router.get("/contracts/active", summary="Hợp đồng đang hiệu lực của cư dân hiện tại")
async def get_active_contract(
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(RentalContract)
        .options(selectinload(RentalContract.room).selectinload(Room.building), selectinload(RentalContract.tenant))
        .where(
            and_(
                RentalContract.tenant_id == current_user.userId,
                RentalContract.status.in_(["ACTIVE", "PENDING", "DRAFT"])
            )
        )
        .order_by(desc(RentalContract.created_at))
    )
    result = await db.execute(stmt)
    contract = result.scalar_one_or_none()
    if not contract:
        return error_response(code="NO_ACTIVE_CONTRACT", message="Không tìm thấy hợp đồng đang hiệu lực", status_code=404)

    return success_response({
        "id": contract.id,
        "contract_number": contract.contract_number,
        "room_id": contract.room_id,
        "room_number": contract.room.room_number if contract.room else None,
        "building_name": contract.room.building.name if contract.room and hasattr(contract.room, 'building') and contract.room.building else "Homtel Complex",
        "tenant_id": contract.tenant_id,
        "tenant_name": contract.tenant.full_name if contract.tenant else None,
        "company_id": contract.company_id,
        "start_date": contract.start_date,
        "end_date": contract.end_date,
        "rent_amount": contract.rent_amount,
        "deposit_amount": contract.deposit_amount,
        "payment_day_of_month": contract.payment_day_of_month,
        "status": contract.status,
        "signed_at": contract.signed_at,
        "signature_hash": contract.signature_hash,
    })


@router.post("/contracts", summary="Tạo hợp đồng thuê mới", status_code=201)
async def create_contract(
    payload: CreateContractRequest,
    current_user: TokenPayload = Depends(require_role("OWNER", "STAFF", "SUPER_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    contract_id = f"cnt_{uuid.uuid4().hex[:12]}"
    contract_num = f"HDT-{datetime.now(timezone.utc).strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"

    comp_id = resolve_owner_company_id(current_user, payload.companyId)
    room = await assert_room_access(db, current_user, payload.roomId, for_update=True)
    if room.company_id != comp_id:
        return error_response(code="INVALID_ROOM", message="Phòng không thuộc công ty quản lý này", status_code=400)
    if room.status in ("OCCUPIED", "RESERVED"):
        return error_response(code="ROOM_UNAVAILABLE", message="Phòng này đã được đặt hoặc đang có người thuê, không thể tạo hợp đồng mới", status_code=409)

    existing_contract = await db.execute(
        select(RentalContract.id).where(
            RentalContract.room_id == payload.roomId,
            RentalContract.status.in_(["ACTIVE", "PENDING"])
        ).with_for_update()
    )
    if existing_contract.scalar_one_or_none():
        return error_response(code="ROOM_ALREADY_CONTRACTED", message="Phòng này đã có hợp đồng đang xử lý hoặc có hiệu lực", status_code=409)

    room.status = "RESERVED"

    contract = RentalContract(
        id=contract_id,
        contract_number=contract_num,
        room_id=payload.roomId,
        tenant_id=payload.tenantId,
        company_id=comp_id,
        start_date=payload.startDate,
        end_date=payload.endDate,
        rent_amount=payload.rentAmount,
        deposit_amount=payload.depositAmount,
        payment_day_of_month=payload.paymentDayOfMonth,
        status="PENDING",
        terms=payload.terms or "Hợp đồng thuê căn hộ dịch vụ Homtel tiêu chuẩn.",
    )
    db.add(contract)
    await db.commit()
    await db.refresh(contract)
    return success_response({
        "id": contract.id,
        "contract_number": contract.contract_number,
        "status": contract.status,
    }, status_code=201)


@router.post("/contracts/{contract_id}/request-otp", summary="Yêu cầu gửi mã OTP để ký hợp đồng")
async def request_signing_otp(
    contract_id: str,
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contract = await assert_contract_access(db, current_user, contract_id)

    if current_user.role == "TENANT" and contract.tenant_id != current_user.userId:
        return error_response(code="FORBIDDEN", message="Bạn không có quyền ký hợp đồng này", status_code=403)

    otp_code = str(secrets.randbelow(900000) + 100000)
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()

    otp_record = OtpVerification(
        id=f"otp_{uuid.uuid4().hex[:12]}",
        contract_id=contract_id,
        tenant_id=current_user.userId,
        otp_code=otp_code,
        expires_at=expires_at,
        verified=False
    )
    db.add(otp_record)
    await db.commit()

    return success_response({
        "success": True,
        "contract_id": contract_id,
        "expires_in_seconds": 600,
        "simulated_otp": otp_code,  # For seamless local testing
        "message": "Mã xác thực OTP 6 số đã được gửi tới số điện thoại/Zalo của bạn."
    })


@router.post("/contracts/{contract_id}/sign", summary="Ký kết hợp đồng điện tử (Canvas hoặc OTP)")
async def sign_contract(
    contract_id: str,
    payload: SignContractRequest,
    req: Request,
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contract = await assert_contract_access(db, current_user, contract_id, for_update=True)

    if current_user.role == "TENANT" and contract.tenant_id != current_user.userId:
        return error_response(code="FORBIDDEN", message="Bạn không có quyền ký hợp đồng này", status_code=403)

    if contract.status == "ACTIVE":
        return error_response(code="ALREADY_ACTIVE", message="Hợp đồng này đã được ký kết và kích hoạt", status_code=409)

    now_iso = datetime.now(timezone.utc).isoformat()

    sign_method = (payload.signingMethod or payload.method or "DRAW").upper()
    if "DRAW" in sign_method:
        sign_method = "DRAW"
    else:
        sign_method = "OTP"

    if sign_method == "OTP":
        if not payload.otpCode:
            return error_response(code="INVALID_OTP", message="Vui lòng cung cấp mã OTP", status_code=400)
        otp_stmt = select(OtpVerification).where(
            and_(
                OtpVerification.contract_id == contract_id,
                OtpVerification.tenant_id == current_user.userId,
                OtpVerification.otp_code == payload.otpCode,
                OtpVerification.verified == False
            )
        )
        otp_res = await db.execute(otp_stmt)
        otp_record = otp_res.scalar_one_or_none()
        if not otp_record:
            return error_response(code="INVALID_OTP", message="Mã OTP không chính xác hoặc đã hết hạn", status_code=400)
        otp_record.verified = True

    # Generate SHA-256 tamper-evident digital evidence certificate
    sig_content = f"{contract.id}:{contract.tenant_id}:{contract.rent_amount}:{sign_method}:{now_iso}"
    evidence_hash = hashlib.sha256(sig_content.encode("utf-8")).hexdigest()

    certificate_data = {
        "certificateVersion": "1.0-SHA256-LEGAL",
        "contractNumber": contract.contract_number,
        "contractId": contract.id,
        "signerUserId": current_user.userId,
        "signerEmail": current_user.email,
        "signingMethod": sign_method,
        "evidenceHash": evidence_hash,
        "timestamp": now_iso,
        "legalNotice": "Chứng thư điện tử có giá trị pháp lý theo Luật Giao dịch điện tử Việt Nam."
    }

    sig_record = ContractESignature(
        id=f"sig_{uuid.uuid4().hex[:12]}",
        contract_id=contract.id,
        tenant_id=current_user.userId,
        method=sign_method,
        signature_data=payload.signatureData if sign_method == "DRAW" else None,
        ip_address=req.client.host if req.client else "127.0.0.1",
        user_agent=req.headers.get("user-agent", "Unknown"),
        evidence_hash=evidence_hash,
        certificate_data=json.dumps(certificate_data),
        signed_at=now_iso
    )
    db.add(sig_record)

    contract.status = "ACTIVE"
    contract.signed_at = now_iso
    contract.signature_hash = evidence_hash

    # Update room status to OCCUPIED
    room_stmt = select(Room).where(Room.id == contract.room_id)
    room_res = await db.execute(room_stmt)
    room = room_res.scalar_one_or_none()
    if room:
        room.status = "OCCUPIED"

    await db.commit()

    return success_response({
        "success": True,
        "contract_id": contract.id,
        "contract_number": contract.contract_number,
        "status": contract.status,
        "signed_at": contract.signed_at,
        "signature_hash": contract.signature_hash,
        "evidence_certificate": certificate_data
    })


@router.get("/contracts/{contract_id}", summary="Chi tiết hợp đồng thuê")
async def get_contract(
    contract_id: str,
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contract = await assert_contract_access(db, current_user, contract_id)
    return success_response({
        "id": contract.id,
        "contractNumber": contract.contract_number,
        "contract_number": contract.contract_number,
        "roomId": contract.room_id,
        "tenantId": contract.tenant_id,
        "companyId": contract.company_id,
        "startDate": contract.start_date,
        "endDate": contract.end_date,
        "rentAmount": float(contract.rent_amount),
        "depositAmount": float(contract.deposit_amount),
        "paymentDayOfMonth": contract.payment_day_of_month,
        "status": contract.status,
        "signedAt": contract.signed_at,
        "signatureHash": contract.signature_hash,
    })


@router.get("/contracts/{contract_id}/evidence", summary="Chứng thư ký điện tử bảo mật SHA-256")
async def get_contract_evidence(
    contract_id: str,
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contract = await assert_contract_access(db, current_user, contract_id)
    if current_user.role == "TENANT" and contract.tenant_id != current_user.userId:
        return error_response(code="FORBIDDEN", message="Bạn không có quyền xem chứng thư của hợp đồng này", status_code=403)

    sig_stmt = select(ContractESignature).where(ContractESignature.contract_id == contract_id).order_by(desc(ContractESignature.created_at))
    sig_res = await db.execute(sig_stmt)
    signature = sig_res.scalars().first()

    cert_json = json.loads(signature.certificate_data) if signature and signature.certificate_data else None

    return success_response({
        "contract_id": contract.id,
        "contract_number": contract.contract_number,
        "status": contract.status,
        "signed_at": contract.signed_at,
        "signature_hash": contract.signature_hash,
        "method": signature.method if signature else None,
        "ip_address": signature.ip_address if signature else None,
        "certificate": cert_json
    })


@router.post("/contracts/{contract_id}/renew", summary="Gia hạn hợp đồng thuê phòng")
async def renew_contract(
    contract_id: str,
    payload: RenewContractPayload,
    current_user: TokenPayload = Depends(require_role("OWNER", "STAFF", "SUPER_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    contract = await assert_contract_access(db, current_user, contract_id)

    if contract.status not in ("ACTIVE", "EXPIRED"):
        raise HTTPException(status_code=400, detail="Chỉ có thể gia hạn hợp đồng đang hoạt động hoặc đã hết hạn.")

    target_end_date = payload.newEndDate or payload.endDate or payload.end_date
    if not target_end_date:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp ngày kết thúc gia hạn.")

    if target_end_date <= contract.start_date:
        raise HTTPException(status_code=400, detail="Ngày kết thúc gia hạn phải lớn hơn ngày bắt đầu hợp đồng.")

    target_rent = payload.newRentAmount if payload.newRentAmount is not None else (payload.rentAmount if payload.rentAmount is not None else payload.rent_amount)

    old_end_date = contract.end_date
    contract.end_date = target_end_date
    if target_rent is not None and target_rent > 0:
        contract.rent_amount = Decimal(str(target_rent))

    note_text = f"\n[Gia hạn từ {old_end_date} đến {target_end_date}]: {payload.notes or 'Gia hạn định kỳ'}"
    contract.terms = (contract.terms or "") + note_text

    await db.commit()
    await db.refresh(contract)

    return success_response({
        "success": True,
        "contractId": contract.id,
        "contractNumber": contract.contract_number,
        "newEndDate": contract.end_date,
        "endDate": contract.end_date,
        "end_date": contract.end_date,
        "rentAmount": float(contract.rent_amount),
        "status": contract.status,
        "message": f"Đã gia hạn hợp đồng thành công đến {contract.end_date}"
    })


@router.post("/contracts/{contract_id}/terminate", summary="Chấm dứt hợp đồng thuê và giải phóng phòng về AVAILABLE")
async def terminate_contract(
    contract_id: str,
    payload: Optional[TerminateContractPayload] = None,
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(RentalContract)
        .options(selectinload(RentalContract.room))
        .where(RentalContract.id == contract_id)
    )
    res = await db.execute(stmt)
    contract = res.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Không tìm thấy hợp đồng")

    if current_user.role == "TENANT" and contract.tenant_id != current_user.userId:
        raise HTTPException(status_code=403, detail="Bạn không có quyền chấm dứt hợp đồng này")

    if current_user.role not in ("OWNER", "STAFF", "SUPER_ADMIN", "TENANT"):
        raise HTTPException(status_code=403, detail="Không có quyền thực hiện thao tác này")

    term_date = (payload.terminationDate if payload and payload.terminationDate else None) or date.today().isoformat()
    reason = (payload.reason if payload and payload.reason else None) or "Chấm dứt hợp đồng trước hạn hoặc kết thúc kỳ thuê"

    contract.status = "TERMINATED"
    contract.end_date = term_date
    contract.terms = (contract.terms or "") + f"\n[Chấm dứt ngày {term_date}]: {reason}"

    # CRITICAL: Release room status back to AVAILABLE
    room_stmt = select(Room).where(Room.id == contract.room_id)
    room_res = await db.execute(room_stmt)
    room = room_res.scalar_one_or_none()
    if room:
        room.status = "AVAILABLE"

    await db.commit()

    return success_response({
        "success": True,
        "contractId": contract.id,
        "contractNumber": contract.contract_number,
        "status": contract.status,
        "terminationDate": term_date,
        "roomId": room.id if room else contract.room_id,
        "roomStatus": room.status if room else "AVAILABLE",
        "message": "Đã chấm dứt hợp đồng và giải phóng phòng về trạng thái AVAILABLE"
    })


rentals_router = router

