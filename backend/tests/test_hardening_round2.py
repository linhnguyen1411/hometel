import asyncio
import uuid
import pytest
from datetime import datetime, timezone, timedelta, date
from decimal import Decimal
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.main import app
from app.core.database import AsyncSessionLocal
from app.core.security import create_access_token
from app.modules.auth.models import Company, User, CompanyMembership
from app.modules.properties.models import Building, Floor, Room, BuildingConfiguration
from app.modules.rentals.models import RentalContract
from app.modules.billing.models import Invoice, InvoiceItem, Payment


def make_token_headers(user_id: str, email: str, role: str, company_ids: list[str] | None = None) -> dict:
    memberships = [{"companyId": cid, "role": role} for cid in (company_ids or [])]
    token = create_access_token(
        user_id=user_id,
        email=email,
        role=role,
        memberships=memberships
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def round2_environment():
    """
    Setup two isolated companies (Alpha and Beta) with buildings, floors, rooms,
    and users (SuperAdmin, Owner A, Staff A, Tenant A, Owner B, Staff B, Tenant B, Orphan User).
    """
    comp_a_id = f"comp_r2_a_{uuid.uuid4().hex[:6]}"
    comp_b_id = f"comp_r2_b_{uuid.uuid4().hex[:6]}"

    bld_a_id = f"bld_r2_a_{uuid.uuid4().hex[:6]}"
    bld_b_id = f"bld_r2_b_{uuid.uuid4().hex[:6]}"

    flr_a_id = f"flr_r2_a_{uuid.uuid4().hex[:6]}"
    flr_b_id = f"flr_r2_b_{uuid.uuid4().hex[:6]}"

    rm_a_id = f"rm_r2_a_{uuid.uuid4().hex[:6]}"
    rm_b_id = f"rm_r2_b_{uuid.uuid4().hex[:6]}"

    su_id = f"usr_su_{uuid.uuid4().hex[:6]}"
    oa_id = f"usr_oa_{uuid.uuid4().hex[:6]}"
    sa_id = f"usr_sa_{uuid.uuid4().hex[:6]}"
    ta_id = f"usr_ta_{uuid.uuid4().hex[:6]}"

    ob_id = f"usr_ob_{uuid.uuid4().hex[:6]}"
    sb_id = f"usr_sb_{uuid.uuid4().hex[:6]}"
    tb_id = f"usr_tb_{uuid.uuid4().hex[:6]}"

    orphan_id = f"usr_orphan_{uuid.uuid4().hex[:6]}"

    async with AsyncSessionLocal() as session:
        comp_a = Company(id=comp_a_id, name="Company Alpha R2", status="ACTIVE")
        comp_b = Company(id=comp_b_id, name="Company Beta R2", status="ACTIVE")
        session.add_all([comp_a, comp_b])

        users = [
            User(id=su_id, email=f"su_{uuid.uuid4().hex[:4]}@admin.vn", password_hash="dummy", full_name="Super Admin", role="SUPER_ADMIN", status="ACTIVE"),
            User(id=oa_id, email=f"oa_{uuid.uuid4().hex[:4]}@alpha.vn", password_hash="dummy", full_name="Owner Alpha", role="OWNER", status="ACTIVE"),
            User(id=sa_id, email=f"sa_{uuid.uuid4().hex[:4]}@alpha.vn", password_hash="dummy", full_name="Staff Alpha", role="STAFF", status="ACTIVE"),
            User(id=ta_id, email=f"ta_{uuid.uuid4().hex[:4]}@alpha.vn", password_hash="dummy", full_name="Tenant Alpha", role="TENANT", status="ACTIVE"),
            User(id=ob_id, email=f"ob_{uuid.uuid4().hex[:4]}@beta.vn", password_hash="dummy", full_name="Owner Beta", role="OWNER", status="ACTIVE"),
            User(id=sb_id, email=f"sb_{uuid.uuid4().hex[:4]}@beta.vn", password_hash="dummy", full_name="Staff Beta", role="STAFF", status="ACTIVE"),
            User(id=tb_id, email=f"tb_{uuid.uuid4().hex[:4]}@beta.vn", password_hash="dummy", full_name="Tenant Beta", role="TENANT", status="ACTIVE"),
            User(id=orphan_id, email=f"orphan_{uuid.uuid4().hex[:4]}@nomember.vn", password_hash="dummy", full_name="Orphan User", role="TENANT", status="ACTIVE"),
        ]
        session.add_all(users)

        memberships = [
            CompanyMembership(user_id=oa_id, company_id=comp_a_id, role="OWNER", status="ACTIVE"),
            CompanyMembership(user_id=sa_id, company_id=comp_a_id, role="STAFF", status="ACTIVE"),
            CompanyMembership(user_id=ta_id, company_id=comp_a_id, role="TENANT", status="ACTIVE"),
            CompanyMembership(user_id=ob_id, company_id=comp_b_id, role="OWNER", status="ACTIVE"),
            CompanyMembership(user_id=sb_id, company_id=comp_b_id, role="STAFF", status="ACTIVE"),
            CompanyMembership(user_id=tb_id, company_id=comp_b_id, role="TENANT", status="ACTIVE"),
        ]
        session.add_all(memberships)

        bld_a = Building(id=bld_a_id, company_id=comp_a_id, name="Building Alpha R2", slug=f"bld-a-{uuid.uuid4().hex[:4]}", address="123 Alpha St, District 1", city="Ho Chi Minh", status="ACTIVE")
        bld_b = Building(id=bld_b_id, company_id=comp_b_id, name="Building Beta R2", slug=f"bld-b-{uuid.uuid4().hex[:4]}", address="456 Beta St, District 3", city="Ho Chi Minh", status="ACTIVE")
        session.add_all([bld_a, bld_b])

        cfg_a = BuildingConfiguration(
            building_id=bld_a_id,
            version=1,
            effective_from=date.today(),
            electricity_unit_price=Decimal("3800.00"),
            water_unit_price=Decimal("16000.00"),
            notes="Tariff A"
        )
        cfg_b = BuildingConfiguration(
            building_id=bld_b_id,
            version=1,
            effective_from=date.today(),
            electricity_unit_price=Decimal("4000.00"),
            water_unit_price=Decimal("18000.00"),
            notes="Tariff B"
        )
        session.add_all([cfg_a, cfg_b])

        flr_a = Floor(id=flr_a_id, building_id=bld_a_id, floor_number=1, name="Tầng 1 A")
        flr_b = Floor(id=flr_b_id, building_id=bld_b_id, floor_number=1, name="Tầng 1 B")
        session.add_all([flr_a, flr_b])

        rm_a = Room(id=rm_a_id, company_id=comp_a_id, building_id=bld_a_id, floor_id=flr_a_id, room_number="101-A", slug=f"101-a-{uuid.uuid4().hex[:4]}", room_type="STUDIO", area=Decimal("35.0"), base_rent=Decimal("5000000.00"), status="AVAILABLE")
        rm_b = Room(id=rm_b_id, company_id=comp_b_id, building_id=bld_b_id, floor_id=flr_b_id, room_number="101-B", slug=f"101-b-{uuid.uuid4().hex[:4]}", room_type="STUDIO", area=Decimal("40.0"), base_rent=Decimal("6000000.00"), status="AVAILABLE")
        session.add_all([rm_a, rm_b])

        cnt_a_id = f"cnt_a_{uuid.uuid4().hex[:6]}"
        cnt_a = RentalContract(
            id=cnt_a_id,
            contract_number=f"HD-A-{uuid.uuid4().hex[:4]}",
            room_id=rm_a_id,
            tenant_id=ta_id,
            company_id=comp_a_id,
            start_date="2026-01-01",
            end_date="2027-01-01",
            rent_amount=Decimal("5000000.00"),
            deposit_amount=Decimal("5000000.00"),
            status="ACTIVE"
        )
        session.add(cnt_a)
        rm_a.status = "OCCUPIED"

        await session.commit()

    return {
        "comp_a_id": comp_a_id,
        "comp_b_id": comp_b_id,
        "bld_a_id": bld_a_id,
        "bld_b_id": bld_b_id,
        "rm_a_id": rm_a_id,
        "rm_b_id": rm_b_id,
        "cnt_a_id": cnt_a_id,
        "headers_su": make_token_headers(su_id, "su@admin.vn", "SUPER_ADMIN"),
        "headers_oa": make_token_headers(oa_id, "oa@alpha.vn", "OWNER", [comp_a_id]),
        "headers_sa": make_token_headers(sa_id, "sa@alpha.vn", "STAFF", [comp_a_id]),
        "headers_ta": make_token_headers(ta_id, "ta@alpha.vn", "TENANT", [comp_a_id]),
        "headers_ob": make_token_headers(ob_id, "ob@beta.vn", "OWNER", [comp_b_id]),
        "headers_sb": make_token_headers(sb_id, "sb@beta.vn", "STAFF", [comp_b_id]),
        "headers_tb": make_token_headers(tb_id, "tb@beta.vn", "TENANT", [comp_b_id]),
        "headers_orphan": make_token_headers(orphan_id, "orphan@nomember.vn", "TENANT", []),
        "users": {"orphan_id": orphan_id, "ta_id": ta_id, "tb_id": tb_id, "oa_id": oa_id},
    }


@pytest.mark.asyncio
async def test_payment_positive_amount_check_constraint(round2_environment):
    """
    Verify check constraint chk_payment_positive_amount at the DB level:
    - payment with amount <= 0 raises IntegrityError / CheckViolation
    - payment with amount > 0 succeeds
    """
    env = round2_environment
    comp_a_id = env["comp_a_id"]
    ta_id = env["users"]["ta_id"]
    rm_a_id = env["rm_a_id"]

    async with AsyncSessionLocal() as session:
        # Create an invoice to attach payments to
        inv = Invoice(
            id=f"inv_test_{uuid.uuid4().hex[:6]}",
            invoice_number=f"INV-TEST-{uuid.uuid4().hex[:4]}",
            tenant_id=ta_id,
            contract_id=env["cnt_a_id"],
            company_id=comp_a_id,
            room_id=rm_a_id,
            issue_date="2026-09-01",
            due_date="2026-09-10",
            billing_month="2026-09",
            subtotal=Decimal("1000000.00"),
            total=Decimal("1000000.00"),
            paid_amount=Decimal("0.00"),
            outstanding_amount=Decimal("1000000.00"),
            status="ISSUED"
        )
        session.add(inv)
        await session.commit()

    async with AsyncSessionLocal() as session:
        # 1. Zero amount payment MUST fail with IntegrityError
        zero_pay = Payment(
            id=f"pay_zero_{uuid.uuid4().hex[:6]}",
            invoice_id=inv.id,
            tenant_id=ta_id,
            company_id=comp_a_id,
            amount=Decimal("0.00"),
            method="CASH",
            status="SUCCESS",
            paid_at=datetime.now(timezone.utc).isoformat()
        )
        session.add(zero_pay)
        with pytest.raises(IntegrityError) as exc_zero:
            await session.flush()
        assert "chk_payment_positive_amount" in str(exc_zero.value)
        await session.rollback()

    async with AsyncSessionLocal() as session:
        # 2. Negative amount payment MUST fail with IntegrityError
        inv_ref = await session.get(Invoice, inv.id)
        neg_pay = Payment(
            id=f"pay_neg_{uuid.uuid4().hex[:6]}",
            invoice_id=inv.id,
            tenant_id=ta_id,
            company_id=comp_a_id,
            amount=Decimal("-50000.00"),
            method="CASH",
            status="SUCCESS",
            paid_at=datetime.now(timezone.utc).isoformat()
        )
        session.add(neg_pay)
        with pytest.raises(IntegrityError) as exc_neg:
            await session.flush()
        assert "chk_payment_positive_amount" in str(exc_neg.value)
        await session.rollback()

    async with AsyncSessionLocal() as session:
        # 3. Positive amount payment MUST succeed
        pos_pay = Payment(
            id=f"pay_pos_{uuid.uuid4().hex[:6]}",
            invoice_id=inv.id,
            tenant_id=ta_id,
            company_id=comp_a_id,
            amount=Decimal("500000.00"),
            method="CASH",
            status="SUCCESS",
            paid_at=datetime.now(timezone.utc).isoformat()
        )
        session.add(pos_pay)
        await session.flush()
        await session.commit()

        # Verify saved in DB
        res = await session.execute(select(Payment).where(Payment.id == pos_pay.id))
        saved = res.scalar_one()
        assert saved.amount == Decimal("500000.00")


@pytest.mark.asyncio
async def test_building_authorization_semantics_split(round2_environment):
    """
    Verify building authorization semantics:
    - Tenant A accessing Building B private endpoint -> 403
    - Tenant A accessing Building A private endpoint -> 200
    - Tenant A accessing Building B public endpoint -> 200
    - Owner A accessing Building B -> 403
    - Staff A accessing Building B -> 403
    - Super Admin accessing Building B -> 200
    """
    env = round2_environment
    bld_a_id = env["bld_a_id"]
    bld_b_id = env["bld_b_id"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Tenant A accessing Building B private endpoint (/configurations) -> 403
        tnt_a_priv_b = await ac.get(f"/api/v1/buildings/{bld_b_id}/configurations", headers=env["headers_ta"])
        assert tnt_a_priv_b.status_code == 403

        # 2. Tenant A accessing Building A private endpoint (/configurations) -> 200 (Tenant has lease in A)
        tnt_a_priv_a = await ac.get(f"/api/v1/buildings/{bld_a_id}/configurations", headers=env["headers_ta"])
        assert tnt_a_priv_a.status_code == 200
        assert len(tnt_a_priv_a.json()["data"]) >= 1

        # 3. Tenant A accessing Building B public endpoint (/buildings/{id}) -> 200
        tnt_a_pub_b = await ac.get(f"/api/v1/buildings/{bld_b_id}", headers=env["headers_ta"])
        assert tnt_a_pub_b.status_code == 200
        assert tnt_a_pub_b.json()["data"]["id"] == bld_b_id

        # 4. Owner A accessing Building B private endpoint -> 403
        own_a_priv_b = await ac.get(f"/api/v1/buildings/{bld_b_id}/configurations", headers=env["headers_oa"])
        assert own_a_priv_b.status_code == 403

        # 5. Staff A accessing Building B private endpoint -> 403
        stf_a_priv_b = await ac.get(f"/api/v1/buildings/{bld_b_id}/configurations", headers=env["headers_sa"])
        assert stf_a_priv_b.status_code == 403

        # 6. Super Admin accessing Building B private endpoint -> 200
        su_priv_b = await ac.get(f"/api/v1/buildings/{bld_b_id}/configurations", headers=env["headers_su"])
        assert su_priv_b.status_code == 200
        assert len(su_priv_b.json()["data"]) >= 1


@pytest.mark.asyncio
async def test_hardcoded_company_id_removed(round2_environment):
    """
    Verify that removing hardcoded company fallbacks prevents unauthorized creation:
    - User with no company memberships attempting to create lead without companyId -> 403
    - User with no company memberships attempting to create contract -> 403
    """
    env = round2_environment
    rm_b_id = env["rm_b_id"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Orphan tenant trying to create CRM lead with no company membership
        lead_res = await ac.post("/api/v1/crm/leads", json={
            "customerName": "Potential Customer",
            "customerPhone": "0987654321",
            "source": "FACEBOOK"
        }, headers=env["headers_orphan"])
        # Should fail with 403 FORBIDDEN or 400 because no company could be resolved
        assert lead_res.status_code in (400, 403)

        # Orphan user trying to create contract -> 403 (role require OWNER/STAFF/SUPER_ADMIN)
        cnt_res = await ac.post("/api/v1/contracts", json={
            "roomId": rm_b_id,
            "tenantId": env["users"]["tb_id"],
            "startDate": "2026-10-01",
            "endDate": "2027-10-01",
            "rentAmount": 6000000.0,
            "depositAmount": 6000000.0,
            "paymentDayOfMonth": 5
        }, headers=env["headers_orphan"])
        assert cnt_res.status_code == 403


@pytest.mark.asyncio
async def test_concurrent_room_reservation(round2_environment):
    """
    Test concurrency & transaction integrity on room reservation:
    Two concurrent requests trying to create a contract for the SAME available room.
    Exactly one must succeed (201) and one must receive a Conflict (409).
    """
    env = round2_environment
    rm_b_id = env["rm_b_id"]
    headers_ob = env["headers_ob"]
    tb_id = env["users"]["tb_id"]

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        payload = {
            "roomId": rm_b_id,
            "tenantId": tb_id,
            "companyId": env["comp_b_id"],
            "startDate": "2026-11-01",
            "endDate": "2027-11-01",
            "rentAmount": 6000000.0,
            "depositAmount": 6000000.0,
            "paymentDayOfMonth": 5
        }

        # Issue two concurrent contract creation requests for Room B
        req1 = ac.post("/api/v1/contracts", json=payload, headers=headers_ob)
        req2 = ac.post("/api/v1/contracts", json=payload, headers=headers_ob)

        res1, res2 = await asyncio.gather(req1, req2)

        status_codes = sorted([res1.status_code, res2.status_code])
        # Exactly one must succeed with 201, and one must be rejected with 409
        assert status_codes == [201, 409], f"Unexpected status codes: {res1.status_code}, {res2.status_code}"


@pytest.mark.asyncio
async def test_concurrent_invoice_generation_idempotency(round2_environment):
    """
    Test idempotent invoice generation:
    Generating invoices for the same building & billing_month concurrently
    produces only ONE invoice per contract, skipping duplicates gracefully without 500 error.
    """
    env = round2_environment
    bld_a_id = env["bld_a_id"]
    headers_oa = env["headers_oa"]
    test_period = f"2026-12"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        payload = {
            "buildingId": bld_a_id,
            "billing_month": test_period
        }

        # Trigger concurrent invoice generation
        res1, res2 = await asyncio.gather(
            ac.post("/api/v1/billing/invoices/generate-monthly", json=payload, headers=headers_oa),
            ac.post("/api/v1/billing/invoices/generate-monthly", json=payload, headers=headers_oa)
        )

        assert res1.status_code in (200, 201)
        assert res2.status_code in (200, 201)

        total_created = res1.json()["data"]["createdCount"] + res2.json()["data"]["createdCount"]
        # Exactly 1 invoice created across both calls (since there's 1 active contract in bld_a)
        assert total_created == 1

        # Verify in DB that only 1 invoice exists for that contract and month
        async with AsyncSessionLocal() as session:
            inv_res = await session.execute(
                select(Invoice).where(
                    Invoice.contract_id == env["cnt_a_id"],
                    Invoice.billing_month == test_period
                )
            )
            invoices = inv_res.scalars().all()
            assert len(invoices) == 1


@pytest.mark.asyncio
async def test_duplicate_payment_webhook_idempotency(round2_environment, monkeypatch):
    """
    Test VietQR webhook idempotency with duplicate transaction references:
    First webhook call records payment and reconciles invoice.
    Second call with the same transactionId returns DUPLICATE_SKIPPED without double-charging.
    """
    from app.core.config import settings
    monkeypatch.setattr(settings, "PAYMENT_GATEWAY_ENABLED", True)

    env = round2_environment
    bld_a_id = env["bld_a_id"]
    comp_a_id = env["comp_a_id"]
    headers_oa = env["headers_oa"]

    # 1. Generate an invoice first
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        gen_res = await ac.post("/api/v1/billing/invoices/generate-monthly", json={
            "buildingId": bld_a_id,
            "billing_month": "2026-11"
        }, headers=headers_oa)
        assert gen_res.status_code == 201
        inv_data = gen_res.json()["data"]["invoices"][0]
        inv_num = inv_data["invoiceNumber"]

        tx_ref = f"TX-IDEMP-{uuid.uuid4().hex[:8]}"
        webhook_payload = {
            "transactionId": tx_ref,
            "amount": 5000000.0,
            "description": f"HOMTEL {inv_num} payment",
            "bankAccount": "0905111001",
            "transactionDate": datetime.now(timezone.utc).isoformat()
        }

        # 2. First webhook call
        wh_res1 = await ac.post(
            "/api/v1/billing/invoices/webhook/vietqr",
            json=webhook_payload,
            headers={"X-Webhook-Secret": settings.VIETQR_WEBHOOK_SECRET}
        )
        assert wh_res1.status_code == 200
        assert wh_res1.json()["data"]["status"] == "RECONCILED"
        assert wh_res1.json()["data"]["paidAmount"] == 5000000.0
        assert wh_res1.json()["data"]["outstandingAmount"] == 0.0

        # 3. Second webhook call with same transactionId
        wh_res2 = await ac.post(
            "/api/v1/billing/invoices/webhook/vietqr",
            json=webhook_payload,
            headers={"X-Webhook-Secret": settings.VIETQR_WEBHOOK_SECRET}
        )
        assert wh_res2.status_code == 200
        assert wh_res2.json()["data"]["status"] == "DUPLICATE_SKIPPED"

        # 4. Verify DB payments table has exactly 1 payment record
        async with AsyncSessionLocal() as session:
            pay_res = await session.execute(
                select(Payment).where(Payment.transaction_reference == tx_ref)
            )
            payments = pay_res.scalars().all()
            assert len(payments) == 1
