import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from tests.helpers import get_owner_headers, get_tenant_headers, create_isolated_building


@pytest.mark.asyncio
async def test_tc_ctr_01_create_direct_contract():
    """TC-CTR-01: Tạo hợp đồng trực tiếp (không qua CRM) bởi Owner/Staff."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        tenant_headers = await get_tenant_headers(ac)
        tenant_me = (await ac.get("/api/v1/auth/me", headers=tenant_headers)).json()["data"]
        bld_data = await create_isolated_building(ac, owner_headers, "TC-CTR-01")

        # Create direct contract
        res = await ac.post("/api/v1/contracts", json={
            "roomId": bld_data["room_id"],
            "tenantId": tenant_me["id"],
            "startDate": "2026-10-01",
            "endDate": "2027-10-01",
            "rentAmount": 7000000,
            "depositAmount": 7000000,
            "terms": "Hợp đồng tạo trực tiếp bởi Owner"
        }, headers=owner_headers)
        assert res.status_code == 201
        data = res.json()["data"]
        assert data["id"] is not None
        assert data["contract_number"] is not None
        assert data["status"] == "PENDING"


@pytest.mark.asyncio
async def test_tc_ctr_02_sign_contract_with_canvas_draw():
    """TC-CTR-02: Ký hợp đồng bằng chữ ký vẽ tay (CANVAS_DRAW) — phòng chuyển OCCUPIED, sinh evidence SHA-256."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        tenant_headers = await get_tenant_headers(ac)
        tenant_me = (await ac.get("/api/v1/auth/me", headers=tenant_headers)).json()["data"]
        bld_data = await create_isolated_building(ac, owner_headers, "TC-CTR-02")

        c_res = await ac.post("/api/v1/contracts", json={
            "roomId": bld_data["room_id"],
            "tenantId": tenant_me["id"],
            "startDate": "2026-10-01",
            "endDate": "2027-10-01",
            "rentAmount": 6500000,
            "depositAmount": 6500000
        }, headers=owner_headers)
        contract_id = c_res.json()["data"]["id"]

        # Sign via Canvas DRAW
        sign_res = await ac.post(f"/api/v1/contracts/{contract_id}/sign", json={
            "signingMethod": "DRAW",
            "signatureData": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
        }, headers=tenant_headers)
        assert sign_res.status_code == 200
        sign_data = sign_res.json()["data"]
        assert sign_data["status"] == "ACTIVE"
        assert sign_data["signature_hash"] is not None
        assert len(sign_data["signature_hash"]) == 64  # SHA-256 length

        # Verify room status changed to OCCUPIED
        room_check = await ac.get(f"/api/v1/rooms/{bld_data['room_id']}")
        assert room_check.json()["data"]["status"] == "OCCUPIED"


@pytest.mark.asyncio
async def test_tc_ctr_03_sign_contract_with_otp():
    """TC-CTR-03: Ký hợp đồng bằng OTP: request OTP, sai OTP bị 400, đúng OTP thành công ACTIVE."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        tenant_headers = await get_tenant_headers(ac)
        tenant_me = (await ac.get("/api/v1/auth/me", headers=tenant_headers)).json()["data"]
        bld_data = await create_isolated_building(ac, owner_headers, "TC-CTR-03")

        c_res = await ac.post("/api/v1/contracts", json={
            "roomId": bld_data["room_id"],
            "tenantId": tenant_me["id"],
            "startDate": "2026-10-01",
            "endDate": "2027-10-01",
            "rentAmount": 6000000,
            "depositAmount": 6000000
        }, headers=owner_headers)
        contract_id = c_res.json()["data"]["id"]

        # 1. Request OTP
        otp_req = await ac.post(f"/api/v1/contracts/{contract_id}/request-otp", headers=tenant_headers)
        assert otp_req.status_code == 200
        valid_otp = otp_req.json()["data"]["simulated_otp"]

        # 2. Try signing with WRONG OTP -> MUST FAIL (400)
        bad_sign = await ac.post(f"/api/v1/contracts/{contract_id}/sign", json={
            "signingMethod": "OTP",
            "otpCode": "000000"
        }, headers=tenant_headers)
        assert bad_sign.status_code == 400
        assert "không chính xác" in bad_sign.json()["error"]["message"]

        # 3. Sign with VALID OTP -> SUCCESS (200)
        good_sign = await ac.post(f"/api/v1/contracts/{contract_id}/sign", json={
            "signingMethod": "OTP",
            "otpCode": valid_otp
        }, headers=tenant_headers)
        assert good_sign.status_code == 200
        assert good_sign.json()["data"]["status"] == "ACTIVE"


@pytest.mark.asyncio
async def test_tc_ctr_04_renew_contract_by_owner():
    """TC-CTR-04: Gia hạn hợp đồng bởi Owner — cập nhật ngày kết thúc mới và giá thuê mới, phòng vẫn OCCUPIED."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        tenant_headers = await get_tenant_headers(ac)
        tenant_me = (await ac.get("/api/v1/auth/me", headers=tenant_headers)).json()["data"]
        bld_data = await create_isolated_building(ac, owner_headers, "TC-CTR-04")

        c_res = await ac.post("/api/v1/contracts", json={
            "roomId": bld_data["room_id"],
            "tenantId": tenant_me["id"],
            "startDate": "2026-01-01",
            "endDate": "2026-12-31",
            "rentAmount": 6000000,
            "depositAmount": 6000000
        }, headers=owner_headers)
        contract_id = c_res.json()["data"]["id"]

        # Sign to activate
        await ac.post(f"/api/v1/contracts/{contract_id}/sign", json={
            "signingMethod": "DRAW",
            "signatureData": "sig"
        }, headers=tenant_headers)

        # Renew contract to 2027-12-31 with rent increase to 6,500,000
        renew_res = await ac.post(f"/api/v1/contracts/{contract_id}/renew", json={
            "endDate": "2027-12-31",
            "rentAmount": 6500000,
            "notes": "Gia hạn thêm 1 năm theo thỏa thuận"
        }, headers=owner_headers)
        assert renew_res.status_code == 200
        renew_data = renew_res.json()["data"]
        assert renew_data["endDate"] == "2027-12-31"
        assert float(renew_data["rentAmount"]) == 6500000

        # Room remains OCCUPIED
        room_check = await ac.get(f"/api/v1/rooms/{bld_data['room_id']}")
        assert room_check.json()["data"]["status"] == "OCCUPIED"


@pytest.mark.asyncio
async def test_tc_ctr_05_renew_contract_forbidden_for_tenant():
    """TC-CTR-05: Gia hạn hợp đồng bởi vai trò không phải OWNER/STAFF (TENANT) bị chặn 403."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        tenant_headers = await get_tenant_headers(ac)
        tenant_me = (await ac.get("/api/v1/auth/me", headers=tenant_headers)).json()["data"]
        bld_data = await create_isolated_building(ac, owner_headers, "TC-CTR-05")

        c_res = await ac.post("/api/v1/contracts", json={
            "roomId": bld_data["room_id"],
            "tenantId": tenant_me["id"],
            "startDate": "2026-01-01",
            "endDate": "2026-12-31",
            "rentAmount": 6000000,
            "depositAmount": 6000000
        }, headers=owner_headers)
        contract_id = c_res.json()["data"]["id"]

        # Tenant tries to renew contract -> MUST FAIL (403)
        renew_fail = await ac.post(f"/api/v1/contracts/{contract_id}/renew", json={
            "endDate": "2027-12-31",
            "rentAmount": 4000000  # Tenant attempts to reduce rent
        }, headers=tenant_headers)
        assert renew_fail.status_code == 403


@pytest.mark.asyncio
async def test_tc_ctr_06_terminate_contract_by_owner():
    """TC-CTR-06: Chấm dứt hợp đồng bởi Owner — hợp đồng TERMINATED, phòng giải phóng về AVAILABLE."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        tenant_headers = await get_tenant_headers(ac)
        tenant_me = (await ac.get("/api/v1/auth/me", headers=tenant_headers)).json()["data"]
        bld_data = await create_isolated_building(ac, owner_headers, "TC-CTR-06")

        c_res = await ac.post("/api/v1/contracts", json={
            "roomId": bld_data["room_id"],
            "tenantId": tenant_me["id"],
            "startDate": "2026-01-01",
            "endDate": "2026-12-31",
            "rentAmount": 6000000,
            "depositAmount": 6000000
        }, headers=owner_headers)
        contract_id = c_res.json()["data"]["id"]

        # Sign to activate
        await ac.post(f"/api/v1/contracts/{contract_id}/sign", json={
            "signingMethod": "DRAW",
            "signatureData": "sig"
        }, headers=tenant_headers)

        # Owner terminates contract
        term_res = await ac.post(f"/api/v1/contracts/{contract_id}/terminate", json={
            "terminationDate": "2026-09-30",
            "reason": "Hết hạn hợp đồng và khách dọn ra"
        }, headers=owner_headers)
        assert term_res.status_code == 200
        term_data = term_res.json()["data"]
        assert term_data["status"] == "TERMINATED"
        assert term_data["roomStatus"] == "AVAILABLE"

        # Verify room directly
        room_check = await ac.get(f"/api/v1/rooms/{bld_data['room_id']}")
        assert room_check.json()["data"]["status"] == "AVAILABLE"


@pytest.mark.asyncio
async def test_tc_ctr_07_terminate_contract_by_tenant_owner():
    """TC-CTR-07: Chấm dứt hợp đồng bởi chính Tenant sở hữu hợp đồng đó thành công."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        tenant_headers = await get_tenant_headers(ac)
        tenant_me = (await ac.get("/api/v1/auth/me", headers=tenant_headers)).json()["data"]
        bld_data = await create_isolated_building(ac, owner_headers, "TC-CTR-07")

        c_res = await ac.post("/api/v1/contracts", json={
            "roomId": bld_data["room_id"],
            "tenantId": tenant_me["id"],
            "startDate": "2026-01-01",
            "endDate": "2026-12-31",
            "rentAmount": 5500000,
            "depositAmount": 5500000
        }, headers=owner_headers)
        contract_id = c_res.json()["data"]["id"]

        # Sign
        await ac.post(f"/api/v1/contracts/{contract_id}/sign", json={
            "signingMethod": "DRAW",
            "signatureData": "sig"
        }, headers=tenant_headers)

        # Tenant terminates own contract
        term_res = await ac.post(f"/api/v1/contracts/{contract_id}/terminate", json={
            "terminationDate": "2026-10-01",
            "reason": "Chuyển công tác sang tỉnh khác"
        }, headers=tenant_headers)
        assert term_res.status_code == 200
        assert term_res.json()["data"]["status"] == "TERMINATED"


@pytest.mark.asyncio
async def test_tc_ctr_08_terminate_contract_forbidden_for_other_tenant():
    """TC-CTR-08: Chấm dứt hợp đồng của người khác bởi một Tenant khác bị chặn 403."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        tenant1_headers = await get_tenant_headers(ac)
        bld_data = await create_isolated_building(ac, owner_headers, "TC-CTR-08")

        # Register a second tenant
        unique_num = uuid.uuid4().hex[:6]
        t2_reg = await ac.post("/api/v1/auth/register", json={
            "fullName": f"Tenant 2 {unique_num}",
            "email": f"tenant2_{unique_num}@homtel.vn",
            "password": "Password@123",
            "phone": f"09{uuid.uuid4().int % 100000000:08d}"
        })
        assert t2_reg.status_code in (200, 201)
        t2_token = t2_reg.json()["data"]["accessToken"]
        tenant2_headers = {"Authorization": f"Bearer {t2_token}"}

        # Contract belongs to Tenant 1
        t1_me = (await ac.get("/api/v1/auth/me", headers=tenant1_headers)).json()["data"]
        c_res = await ac.post("/api/v1/contracts", json={
            "roomId": bld_data["room_id"],
            "tenantId": t1_me["id"],
            "startDate": "2026-01-01",
            "endDate": "2026-12-31",
            "rentAmount": 5500000,
            "depositAmount": 5500000
        }, headers=owner_headers)
        contract_id = c_res.json()["data"]["id"]

        # Tenant 2 attempts to terminate Tenant 1's contract -> MUST FAIL (403)
        term_fail = await ac.post(f"/api/v1/contracts/{contract_id}/terminate", json={
            "terminationDate": "2026-10-01",
            "reason": "Phá hoại hợp đồng người khác"
        }, headers=tenant2_headers)
        assert term_fail.status_code == 403


@pytest.mark.asyncio
async def test_tc_ctr_09_evidence_certificate_tamper_and_privacy():
    """TC-CTR-09: Xem chứng thư ký điện tử của hợp đồng — đúng hash SHA-256, timestamp; chặn tenant khác xem (403)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        tenant1_headers = await get_tenant_headers(ac)
        t1_me = (await ac.get("/api/v1/auth/me", headers=tenant1_headers)).json()["data"]
        bld_data = await create_isolated_building(ac, owner_headers, "TC-CTR-09")

        # Create contract for Tenant 1
        c_res = await ac.post("/api/v1/contracts", json={
            "roomId": bld_data["room_id"],
            "tenantId": t1_me["id"],
            "startDate": "2026-01-01",
            "endDate": "2026-12-31",
            "rentAmount": 5000000,
            "depositAmount": 5000000
        }, headers=owner_headers)
        contract_id = c_res.json()["data"]["id"]

        # Sign contract
        await ac.post(f"/api/v1/contracts/{contract_id}/sign", json={
            "signingMethod": "DRAW",
            "signatureData": "sig_evidence_test"
        }, headers=tenant1_headers)

        # 1. Tenant 1 views own evidence certificate -> SUCCESS (200)
        ev_res = await ac.get(f"/api/v1/contracts/{contract_id}/evidence", headers=tenant1_headers)
        assert ev_res.status_code == 200
        ev_data = ev_res.json()["data"]
        assert ev_data["signature_hash"] is not None
        assert len(ev_data["signature_hash"]) == 64
        assert ev_data["certificate"] is not None
        assert ev_data["certificate"]["signerUserId"] == t1_me["id"]

        # 2. Register Tenant 2 and attempt to view Tenant 1's evidence -> MUST FAIL (403)
        unique_num = uuid.uuid4().hex[:6]
        t2_reg = await ac.post("/api/v1/auth/register", json={
            "fullName": f"Tenant Spy {unique_num}",
            "email": f"tenant_spy_{unique_num}@homtel.vn",
            "password": "Password@123",
            "phone": f"09{uuid.uuid4().int % 100000000:08d}"
        })
        t2_token = t2_reg.json()["data"]["accessToken"]
        tenant2_headers = {"Authorization": f"Bearer {t2_token}"}

        spy_res = await ac.get(f"/api/v1/contracts/{contract_id}/evidence", headers=tenant2_headers)
        assert spy_res.status_code == 403
