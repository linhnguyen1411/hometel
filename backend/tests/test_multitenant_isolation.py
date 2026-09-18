import uuid
import pytest
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import AsyncSessionLocal
from app.core.security import create_access_token
from app.modules.auth.models import Company, User, CompanyMembership
from app.modules.rentals.models import RentalContract


def make_auth_headers(user_id: str, email: str, role: str, company_id: str) -> dict:
    """Generate a JWT token for a specific user and company membership."""
    token = create_access_token(
        user_id=user_id,
        email=email,
        role=role,
        memberships=[{"companyId": company_id, "role": role}]
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def tenant_environment():
    """
    Setup two isolated tenants (Company Alpha and Company Beta) with DB entities:
    - Dedicated Owner, Staff, and Tenant accounts
    - Real Company and CompanyMembership records in PostgreSQL for FK integrity
    """
    alpha_id = f"comp_alpha_{uuid.uuid4().hex[:6]}"
    beta_id = f"comp_beta_{uuid.uuid4().hex[:6]}"

    oa_id = f"usr_oa_{uuid.uuid4().hex[:6]}"
    sa_id = f"usr_sa_{uuid.uuid4().hex[:6]}"
    ta_id = f"usr_ta_{uuid.uuid4().hex[:6]}"
    pa_id = f"usr_pa_{uuid.uuid4().hex[:6]}"

    ob_id = f"usr_ob_{uuid.uuid4().hex[:6]}"
    sb_id = f"usr_sb_{uuid.uuid4().hex[:6]}"
    tb_id = f"usr_tb_{uuid.uuid4().hex[:6]}"
    pb_id = f"usr_pb_{uuid.uuid4().hex[:6]}"

    email_oa = f"owner_a_{uuid.uuid4().hex[:4]}@alpha.vn"
    email_sa = f"staff_a_{uuid.uuid4().hex[:4]}@alpha.vn"
    email_ta = f"tenant_a_{uuid.uuid4().hex[:4]}@alpha.vn"
    email_pa = f"prov_a_{uuid.uuid4().hex[:4]}@alpha.vn"

    email_ob = f"owner_b_{uuid.uuid4().hex[:4]}@beta.vn"
    email_sb = f"staff_b_{uuid.uuid4().hex[:4]}@beta.vn"
    email_tb = f"tenant_b_{uuid.uuid4().hex[:4]}@beta.vn"
    email_pb = f"prov_b_{uuid.uuid4().hex[:4]}@beta.vn"

    async with AsyncSessionLocal() as session:
        # Create Companies
        comp_a = Company(id=alpha_id, name="Company Alpha Real Estate", status="ACTIVE")
        comp_b = Company(id=beta_id, name="Company Beta Real Estate", status="ACTIVE")
        session.add_all([comp_a, comp_b])

        # Create Users
        users = [
            User(id=oa_id, email=email_oa, password_hash="dummy", full_name="Owner Alpha", role="OWNER", status="ACTIVE"),
            User(id=sa_id, email=email_sa, password_hash="dummy", full_name="Staff Alpha", role="STAFF", status="ACTIVE"),
            User(id=ta_id, email=email_ta, password_hash="dummy", full_name="Tenant Alpha", role="TENANT", status="ACTIVE"),
            User(id=pa_id, email=email_pa, password_hash="dummy", full_name="Provider Alpha", role="PROVIDER", status="ACTIVE"),
            User(id=ob_id, email=email_ob, password_hash="dummy", full_name="Owner Beta", role="OWNER", status="ACTIVE"),
            User(id=sb_id, email=email_sb, password_hash="dummy", full_name="Staff Beta", role="STAFF", status="ACTIVE"),
            User(id=tb_id, email=email_tb, password_hash="dummy", full_name="Tenant Beta", role="TENANT", status="ACTIVE"),
            User(id=pb_id, email=email_pb, password_hash="dummy", full_name="Provider Beta", role="PROVIDER", status="ACTIVE"),
        ]
        session.add_all(users)

        # Create Memberships
        memberships = [
            CompanyMembership(user_id=oa_id, company_id=alpha_id, role="OWNER", status="ACTIVE"),
            CompanyMembership(user_id=sa_id, company_id=alpha_id, role="STAFF", status="ACTIVE"),
            CompanyMembership(user_id=ta_id, company_id=alpha_id, role="TENANT", status="ACTIVE"),
            CompanyMembership(user_id=pa_id, company_id=alpha_id, role="PROVIDER", status="ACTIVE"),
            CompanyMembership(user_id=ob_id, company_id=beta_id, role="OWNER", status="ACTIVE"),
            CompanyMembership(user_id=sb_id, company_id=beta_id, role="STAFF", status="ACTIVE"),
            CompanyMembership(user_id=tb_id, company_id=beta_id, role="TENANT", status="ACTIVE"),
            CompanyMembership(user_id=pb_id, company_id=beta_id, role="PROVIDER", status="ACTIVE"),
        ]
        session.add_all(memberships)
        await session.commit()

    headers = {
        "owner_a": make_auth_headers(oa_id, email_oa, "OWNER", alpha_id),
        "staff_a": make_auth_headers(sa_id, email_sa, "STAFF", alpha_id),
        "tenant_a": make_auth_headers(ta_id, email_ta, "TENANT", alpha_id),
        "provider_a": make_auth_headers(pa_id, email_pa, "PROVIDER", alpha_id),
        "owner_b": make_auth_headers(ob_id, email_ob, "OWNER", beta_id),
        "staff_b": make_auth_headers(sb_id, email_sb, "STAFF", beta_id),
        "tenant_b": make_auth_headers(tb_id, email_tb, "TENANT", beta_id),
        "provider_b": make_auth_headers(pb_id, email_pb, "PROVIDER", beta_id),
    }

    return {
        "alpha_id": alpha_id,
        "beta_id": beta_id,
        "users": {
            "oa_id": oa_id, "sa_id": sa_id, "ta_id": ta_id, "pa_id": pa_id,
            "ob_id": ob_id, "sb_id": sb_id, "tb_id": tb_id, "pb_id": pb_id,
        },
        "headers": headers,
    }


@pytest.mark.asyncio
async def test_cross_company_building_and_room_isolation(tenant_environment):
    """Verify Owner A cannot modify, configure, or create rooms inside Company B's building."""
    env = tenant_environment
    headers_a = env["headers"]["owner_a"]
    headers_b = env["headers"]["owner_b"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Owner B creates building B
        b_res = await ac.post("/api/v1/buildings", json={
            "name": f"Building Beta {uuid.uuid4().hex[:4]}",
            "address": "123 Beta St",
            "city": "Đà Nẵng",
            "district": "Hải Châu",
            "total_floors": 3,
        }, headers=headers_b)
        assert b_res.status_code == 201
        bld_b_id = b_res.json()["data"]["id"]

        # 2. Owner B creates floor and room in building B
        f_res = await ac.post(f"/api/v1/buildings/{bld_b_id}/floors", json={
            "floorNumber": 1,
            "name": "Floor 1"
        }, headers=headers_b)
        assert f_res.status_code == 201
        floor_b_id = f_res.json()["data"]["id"]

        r_res = await ac.post("/api/v1/rooms", json={
            "building_id": bld_b_id,
            "floor_id": floor_b_id,
            "room_number": "B-101",
            "room_type": "STUDIO",
            "base_price_monthly": 7000000,
            "area_sqm": 35.0,
            "max_occupants": 2,
        }, headers=headers_b)
        assert r_res.status_code == 201
        room_b_id = r_res.json()["data"]["id"]

        # ATTACK 1: Owner A attempts to update Building B -> MUST BE 403
        attack_bld_update = await ac.patch(f"/api/v1/buildings/{bld_b_id}", json={
            "name": "Hacked Building Beta",
        }, headers=headers_a)
        assert attack_bld_update.status_code == 403, f"Expected 403 Forbidden, got {attack_bld_update.status_code}"

        # ATTACK 2: Owner A attempts to add configuration to Building B -> MUST BE 403
        attack_bld_cfg = await ac.post(f"/api/v1/buildings/{bld_b_id}/configurations", json={
            "effective_from": "2027-01-01",
            "electricity_unit_price": 9999,
        }, headers=headers_a)
        assert attack_bld_cfg.status_code == 403

        # ATTACK 3: Owner A attempts to create a room inside Building B -> MUST BE 403
        attack_create_room = await ac.post("/api/v1/rooms", json={
            "building_id": bld_b_id,
            "floor_id": floor_b_id,
            "room_number": "HACK-102",
            "room_type": "STUDIO",
            "base_price_monthly": 1000,
        }, headers=headers_a)
        assert attack_create_room.status_code == 403

        # ATTACK 4: Owner A attempts to modify Room B -> MUST BE 403
        attack_room_update = await ac.patch(f"/api/v1/rooms/{room_b_id}", json={
            "room_number": "PWNED-101",
        }, headers=headers_a)
        assert attack_room_update.status_code == 403

        # ATTACK 5: Owner A attempts to delete Room B -> MUST BE 403
        attack_room_del = await ac.delete(f"/api/v1/rooms/{room_b_id}", headers=headers_a)
        assert attack_room_del.status_code == 403


@pytest.mark.asyncio
async def test_cross_company_contract_and_signing_isolation(tenant_environment):
    """Verify Company A cannot view, OTP-request, or sign Company B's contracts."""
    env = tenant_environment
    headers_oa = env["headers"]["owner_a"]
    headers_ta = env["headers"]["tenant_a"]
    headers_ob = env["headers"]["owner_b"]
    tb_id = env["users"]["tb_id"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Owner B sets up room
        b_res = await ac.post("/api/v1/buildings", json={
            "name": f"Bld Beta Contract {uuid.uuid4().hex[:4]}",
            "address": "456 Beta St",
            "city": "Đà Nẵng",
            "district": "Sơn Trà",
            "total_floors": 2,
        }, headers=headers_ob)
        bld_b_id = b_res.json()["data"]["id"]

        f_res = await ac.post(f"/api/v1/buildings/{bld_b_id}/floors", json={"floorNumber": 1, "name": "F1"}, headers=headers_ob)
        floor_b_id = f_res.json()["data"]["id"]

        r_res = await ac.post("/api/v1/rooms", json={
            "building_id": bld_b_id,
            "floor_id": floor_b_id,
            "room_number": "B-201",
            "room_type": "STUDIO",
            "base_price_monthly": 8000000,
        }, headers=headers_ob)
        room_b_id = r_res.json()["data"]["id"]

        c_res = await ac.post("/api/v1/contracts", json={
            "roomId": room_b_id,
            "tenantId": tb_id,
            "startDate": "2026-10-01",
            "endDate": "2027-04-01",
            "rentAmount": 8000000,
            "depositAmount": 8000000,
        }, headers=headers_ob)
        assert c_res.status_code == 201
        contract_b_id = c_res.json()["data"]["id"]

        # ATTACK 1: Owner A attempts to read Contract B -> MUST BE 403
        att_get = await ac.get(f"/api/v1/contracts/{contract_b_id}", headers=headers_oa)
        assert att_get.status_code == 403

        # ATTACK 2: Tenant A attempts to read Contract B -> MUST BE 403
        att_t_get = await ac.get(f"/api/v1/contracts/{contract_b_id}", headers=headers_ta)
        assert att_t_get.status_code == 403

        # ATTACK 3: Tenant A attempts to request OTP for Contract B -> MUST BE 403
        att_otp = await ac.post(f"/api/v1/contracts/{contract_b_id}/request-otp", headers=headers_ta)
        assert att_otp.status_code == 403

        # ATTACK 4: Tenant A attempts to sign Contract B -> MUST BE 403
        att_sign = await ac.post(f"/api/v1/contracts/{contract_b_id}/sign", json={
            "signingMethod": "DRAW",
            "signatureData": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
        }, headers=headers_ta)
        assert att_sign.status_code == 403

        # ATTACK 5: Owner A attempts to renew Contract B -> MUST BE 403
        att_renew = await ac.post(f"/api/v1/contracts/{contract_b_id}/renew", json={
            "newEndDate": "2028-01-01",
            "newRentAmount": 9000000,
        }, headers=headers_oa)
        assert att_renew.status_code == 403


@pytest.mark.asyncio
async def test_cross_company_invoice_and_financial_isolation(tenant_environment):
    """Verify Invoice, VietQR, and payment isolation between Company A and Company B."""
    env = tenant_environment
    headers_oa = env["headers"]["owner_a"]
    headers_ta = env["headers"]["tenant_a"]
    headers_ob = env["headers"]["owner_b"]
    tb_id = env["users"]["tb_id"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        b_res = await ac.post("/api/v1/buildings", json={
            "name": f"Bld B Fin {uuid.uuid4().hex[:4]}",
            "address": "789 Beta St",
            "city": "Đà Nẵng",
            "district": "Ngũ Hành Sơn",
            "total_floors": 1,
        }, headers=headers_ob)
        bld_b_id = b_res.json()["data"]["id"]

        f_res = await ac.post(f"/api/v1/buildings/{bld_b_id}/floors", json={"floorNumber": 1, "name": "F1"}, headers=headers_ob)
        floor_b_id = f_res.json()["data"]["id"]

        r_res = await ac.post("/api/v1/rooms", json={
            "building_id": bld_b_id,
            "floor_id": floor_b_id,
            "room_number": "B-301",
            "room_type": "STUDIO",
            "base_price_monthly": 6000000,
        }, headers=headers_ob)
        room_b_id = r_res.json()["data"]["id"]

        c_res = await ac.post("/api/v1/contracts", json={
            "roomId": room_b_id,
            "tenantId": tb_id,
            "startDate": "2026-09-01",
            "endDate": "2027-03-01",
            "rentAmount": 6000000,
            "depositAmount": 6000000,
        }, headers=headers_ob)
        assert c_res.status_code == 201
        contract_b_id = c_res.json()["data"]["id"]

        async with AsyncSessionLocal() as session:
            c_obj = await session.get(RentalContract, contract_b_id)
            c_obj.status = "ACTIVE"
            await session.commit()

        # Generate monthly invoices for Building B
        gen_res = await ac.post("/api/v1/billing/invoices/generate-monthly", json={
            "buildingId": bld_b_id,
            "billing_month": "2026-09",
        }, headers=headers_ob)
        assert gen_res.status_code == 201
        inv_b_id = gen_res.json()["data"]["invoices"][0]["id"]

        # ATTACK 1: Owner A attempts to get VietQR for Invoice B -> MUST BE 403
        att_vqr_oa = await ac.get(f"/api/v1/billing/invoices/{inv_b_id}/vietqr", headers=headers_oa)
        assert att_vqr_oa.status_code in (403, 503)

        # ATTACK 2: Owner A attempts to record payment on Invoice B -> MUST BE 403
        att_pay_oa = await ac.post("/api/v1/billing/payments", json={
            "invoiceId": inv_b_id,
            "amount": 1000000,
            "method": "CASH",
        }, headers=headers_oa)
        assert att_pay_oa.status_code == 403

        # ATTACK 3: Tenant A attempts to record payment on Invoice B -> MUST BE 403
        att_pay_ta = await ac.post("/api/v1/billing/payments", json={
            "invoiceId": inv_b_id,
            "amount": 1000000,
            "method": "CASH",
        }, headers=headers_ta)
        assert att_pay_ta.status_code == 403


@pytest.mark.asyncio
async def test_financial_integrity_reconcile_and_overpayment_protection(tenant_environment):
    """Verify strict validation against negative payments, overpayments, and ensure idempotency."""
    env = tenant_environment
    headers_ob = env["headers"]["owner_b"]
    tb_id = env["users"]["tb_id"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        b_res = await ac.post("/api/v1/buildings", json={
            "name": f"Bld B Overpay {uuid.uuid4().hex[:4]}",
            "address": "999 St",
            "city": "Đà Nẵng",
            "district": "Hải Châu",
            "total_floors": 1,
        }, headers=headers_ob)
        bld_b_id = b_res.json()["data"]["id"]

        f_res = await ac.post(f"/api/v1/buildings/{bld_b_id}/floors", json={"floorNumber": 1, "name": "F1"}, headers=headers_ob)
        floor_b_id = f_res.json()["data"]["id"]

        r_res = await ac.post("/api/v1/rooms", json={
            "building_id": bld_b_id,
            "floor_id": floor_b_id,
            "room_number": "B-401",
            "room_type": "STUDIO",
            "base_price_monthly": 5000000,
        }, headers=headers_ob)
        room_b_id = r_res.json()["data"]["id"]

        c_res = await ac.post("/api/v1/contracts", json={
            "roomId": room_b_id,
            "tenantId": tb_id,
            "startDate": "2026-09-01",
            "endDate": "2027-03-01",
            "rentAmount": 5000000,
            "depositAmount": 5000000,
        }, headers=headers_ob)
        assert c_res.status_code == 201
        contract_b_id = c_res.json()["data"]["id"]

        async with AsyncSessionLocal() as session:
            c_obj = await session.get(RentalContract, contract_b_id)
            c_obj.status = "ACTIVE"
            await session.commit()

        gen_res = await ac.post("/api/v1/billing/invoices/generate-monthly", json={
            "buildingId": bld_b_id,
            "billing_month": "2026-09",
        }, headers=headers_ob)
        assert gen_res.status_code == 201
        inv_id = gen_res.json()["data"]["invoices"][0]["id"]

        # TEST 1: Negative amount payment -> MUST BE 400
        neg_res = await ac.post("/api/v1/billing/payments", json={
            "invoiceId": inv_id,
            "amount": -500000,
            "method": "CASH",
        }, headers=headers_ob)
        assert neg_res.status_code == 400
        assert neg_res.json()["error"]["code"] == "INVALID_AMOUNT"

        # TEST 2: Overpayment (> outstanding amount 5,000,000) -> MUST BE 400
        over_res = await ac.post("/api/v1/billing/payments", json={
            "invoiceId": inv_id,
            "amount": 99999999,
            "method": "CASH",
        }, headers=headers_ob)
        assert over_res.status_code == 400
        assert over_res.json()["error"]["code"] == "OVERPAYMENT_NOT_ALLOWED"

        # TEST 3: Partial payment -> Succeeds and recalculates outstanding amount
        part_res = await ac.post("/api/v1/billing/payments", json={
            "invoiceId": inv_id,
            "amount": 2000000,
            "method": "CASH",
        }, headers=headers_ob)
        assert part_res.status_code == 201
        assert part_res.json()["data"]["invoiceStatus"] == "PARTIALLY_PAID"
        assert part_res.json()["data"]["outstandingAmount"] == 3000000.0

        # TEST 4: Full settlement of remaining balance -> Status becomes PAID
        full_res = await ac.post("/api/v1/billing/payments", json={
            "invoiceId": inv_id,
            "amount": 3000000,
            "method": "CASH",
        }, headers=headers_ob)
        assert full_res.status_code == 201
        assert full_res.json()["data"]["invoiceStatus"] == "PAID"
        assert full_res.json()["data"]["outstandingAmount"] == 0.0

        # TEST 5: Monthly invoice generation idempotency check:
        # Re-triggering generate-monthly for the same period must skip and create 0 duplicate invoices
        idem_res = await ac.post("/api/v1/billing/invoices/generate-monthly", json={
            "buildingId": bld_b_id,
            "billing_month": "2026-09",
        }, headers=headers_ob)
        assert idem_res.status_code == 200
        assert idem_res.json()["data"]["invoices_created"] == 0
        assert idem_res.json()["data"]["invoices_skipped"] >= 1


@pytest.mark.asyncio
async def test_crm_and_operations_cross_company_isolation(tenant_environment):
    """Verify CRM Leads and Operations 360 are strictly isolated across companies."""
    env = tenant_environment
    headers_oa = env["headers"]["owner_a"]
    headers_ob = env["headers"]["owner_b"]
    headers_ta = env["headers"]["tenant_a"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        lead_res = await ac.post("/api/v1/crm/leads", json={
            "fullName": "Confidential Lead B",
            "phone": "0918888888",
            "email": "leadb@example.com",
            "source": "ZALO",
        }, headers=headers_ob)
        assert lead_res.status_code == 201
        lead_b_id = lead_res.json()["data"]["id"]

        # ATTACK 1: Owner A attempts to get Lead B -> MUST BE 403
        att_get_lead = await ac.get(f"/api/v1/crm/leads/{lead_b_id}", headers=headers_oa)
        assert att_get_lead.status_code == 403

        # ATTACK 2: Owner A attempts to update Lead B -> MUST BE 403
        att_patch_lead = await ac.patch(f"/api/v1/crm/leads/{lead_b_id}", json={
            "fullName": "Stolen Lead",
        }, headers=headers_oa)
        assert att_patch_lead.status_code == 403

        # Owner B creates a building and room
        bld_res = await ac.post("/api/v1/buildings", json={
            "name": f"Bld B 360 {uuid.uuid4().hex[:4]}",
            "address": "100 360 St",
            "city": "Đà Nẵng",
            "district": "Hải Châu",
            "total_floors": 1,
        }, headers=headers_ob)
        bld_id = bld_res.json()["data"]["id"]

        flr_res = await ac.post(f"/api/v1/buildings/{bld_id}/floors", json={"floorNumber": 1, "name": "F1"}, headers=headers_ob)
        flr_id = flr_res.json()["data"]["id"]

        rm_res = await ac.post("/api/v1/rooms", json={
            "building_id": bld_id,
            "floor_id": flr_id,
            "room_number": "R-360",
            "room_type": "STUDIO",
            "base_price_monthly": 6500000,
        }, headers=headers_ob)
        rm_id = rm_res.json()["data"]["id"]

        # ATTACK 3: Owner A requests Building B 360 overview -> MUST BE 403
        att_bld_360 = await ac.get(f"/api/v1/operations/buildings/{bld_id}/360", headers=headers_oa)
        assert att_bld_360.status_code == 403

        # ATTACK 4: Owner A requests Room B 360 -> MUST BE 403
        att_rm_360 = await ac.get(f"/api/v1/operations/rooms/{rm_id}/360", headers=headers_oa)
        assert att_rm_360.status_code == 403

        # ATTACK 5: Tenant A requests Room B 360 -> MUST BE 403
        att_t_360 = await ac.get(f"/api/v1/operations/rooms/{rm_id}/360", headers=headers_ta)
        assert att_t_360.status_code == 403


@pytest.mark.asyncio
async def test_services_and_staff_assignment_isolation(tenant_environment):
    """Verify Service Requests, Staff Assignment, and Reviews are isolated across companies."""
    env = tenant_environment
    headers_pa = env["headers"]["provider_a"]
    headers_pb = env["headers"]["provider_b"]
    headers_tb = env["headers"]["tenant_b"]
    headers_ta = env["headers"]["tenant_a"]
    sb_id = env["users"]["sb_id"]
    sa_id = env["users"]["sa_id"]
    beta_id = env["beta_id"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Provider B registers a service
        srv_res = await ac.post("/api/v1/services", json={
            "companyId": beta_id,
            "name": f"Air Conditioner Cleaning {uuid.uuid4().hex[:4]}",
            "slug": f"ac-clean-{uuid.uuid4().hex[:4]}",
            "description": "Standard AC deep cleaning",
            "category": "CLEANING",
            "priceType": "FIXED",
            "basePrice": 350000.0,
        }, headers=headers_pb)
        assert srv_res.status_code == 201
        srv_id = srv_res.json()["data"]["id"]

        # Tenant B creates a service request
        req_res = await ac.post("/api/v1/service-requests", json={
            "serviceId": srv_id,
            "title": "Need AC Cleaned",
            "description": "AC leaking water",
            "preferredDate": "2026-09-20",
            "urgency": "HIGH",
        }, headers=headers_tb)
        assert req_res.status_code == 201
        sreq_id = req_res.json()["data"]["id"]

        # ATTACK 1: Provider A attempts to view Service Request B -> MUST BE 403
        att_get = await ac.get(f"/api/v1/service-requests/{sreq_id}", headers=headers_pa)
        assert att_get.status_code == 403

        # ATTACK 2: Provider A attempts to review/approve Service Request B -> MUST BE 403
        att_rev = await ac.post(f"/api/v1/service-requests/{sreq_id}/review", json={
            "action": "APPROVE",
            "estimatedCost": 400000.0,
        }, headers=headers_pa)
        assert att_rev.status_code == 403

        # ATTACK 3: Cross-provider staff assignment: Provider B attempts to assign Staff A (who does not belong to Provider B) -> MUST BE 400
        cross_asg = await ac.post(f"/api/v1/service-requests/{sreq_id}/assign", json={
            "staffId": sa_id,
            "notes": "Assign outsider staff",
        }, headers=headers_pb)
        assert cross_asg.status_code == 400
        assert "INVALID_STAFF_ASSIGNMENT" in cross_asg.text

        # Legitimate staff assignment by Provider B using Staff B -> Succeeds
        legit_asg = await ac.post(f"/api/v1/service-requests/{sreq_id}/assign", json={
            "staffId": sb_id,
            "notes": "Legitimate staff assignment",
        }, headers=headers_pb)
        assert legit_asg.status_code == 201
        asg_id = legit_asg.json()["data"]["id"]

        # Complete assignment
        done_res = await ac.post(f"/api/v1/service-requests/assignments/{asg_id}/status", json={
            "status": "COMPLETED",
            "finalCost": 350000.0,
        }, headers=headers_pb)
        assert done_res.status_code == 200

        # ATTACK 4: Tenant A attempts to review Tenant B's service request -> MUST BE 403
        att_fake_rev = await ac.post("/api/v1/reviews", json={
            "serviceRequestId": sreq_id,
            "rating": 5,
            "punctualityRating": 5,
            "qualityRating": 5,
            "comment": "Fake review by stranger",
        }, headers=headers_ta)
        assert att_fake_rev.status_code == 403

        # Legitimate review by Tenant B -> Succeeds
        legit_rev = await ac.post("/api/v1/reviews", json={
            "serviceRequestId": sreq_id,
            "rating": 5,
            "punctualityRating": 5,
            "qualityRating": 5,
            "comment": "Great service!",
        }, headers=headers_tb)
        assert legit_rev.status_code == 201
