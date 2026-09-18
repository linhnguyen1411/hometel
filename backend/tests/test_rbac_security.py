import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings
from tests.helpers import (
    get_owner_headers,
    get_tenant_headers,
    get_provider_headers,
    get_admin_headers,
    create_isolated_building,
)


@pytest.mark.asyncio
async def test_tc_sec_01_rbac_across_all_10_modules():
    """TC-SEC-01: Chặn Tenant gọi các endpoint đặc quyền quản trị qua 10 module (HTTP 403)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        tenant_headers = await get_tenant_headers(ac)

        # 1. Properties: Create building
        res = await ac.post("/api/v1/buildings", json={"name": "Forbidden Bld", "address": "123 St"}, headers=tenant_headers)
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"

        # 2. Floor: Create floor
        res = await ac.post("/api/v1/buildings/bld_riverside/floors", json={"floorNumber": 99, "name": "Tầng 99"}, headers=tenant_headers)
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"

        # 3. Room: Create room
        res = await ac.post("/api/v1/rooms", json={"room_number": "P999", "base_price_monthly": 5000000}, headers=tenant_headers)
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"

        # 4. Contracts: Create contract
        res = await ac.post("/api/v1/contracts", json={"roomId": "room_dummy", "tenantId": "usr_dummy"}, headers=tenant_headers)
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"

        # 5. Services: Create catalog service
        res = await ac.post("/api/v1/services", json={"name": "Forbidden Srv", "category": "CLEANING"}, headers=tenant_headers)
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"

        # 6. Billing: Batch generate invoices
        res = await ac.post("/api/v1/billing/invoices/generate-monthly", json={"billing_month": "2026-10"}, headers=tenant_headers)
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"

        # 7. Billing: Scan meter OCR
        res = await ac.post("/api/v1/billing/meters/ocr-scan", json={"meterId": "mtr_dummy", "imageBase64OrUrl": "dummy"}, headers=tenant_headers)
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"

        # 8. Finance: Consolidated PnL
        res = await ac.get("/api/v1/financial/pnl/consolidated", headers=tenant_headers)
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"

        # 9. Super Admin: System stats
        res = await ac.get("/api/v1/admin/stats", headers=tenant_headers)
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"

        # 10. Super Admin: Create owner
        res = await ac.post("/api/v1/admin/owners", json={"email": "new_o@homtel.vn"}, headers=tenant_headers)
        assert res.status_code == 403, f"Expected 403, got {res.status_code}"


@pytest.mark.asyncio
async def test_tc_sec_02_building_360_data_masking():
    """TC-SEC-02: Kiểm tra che giấu PII (Data Masking) trên Cockpit 360 đối với khách vãng lai, Provider, Tenant khác."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        provider_headers = await get_provider_headers(ac)
        tenant_headers = await get_tenant_headers(ac)

        # Create isolated building with room
        bld_data = await create_isolated_building(ac, owner_headers, "TC-SEC-02")
        bld_id = bld_data["building_id"]

        # 1. Anonymous viewer: floors array should be empty
        anon_res = await ac.get(f"/api/v1/operations/buildings/{bld_id}/360")
        assert anon_res.status_code == 200
        assert anon_res.json()["data"]["floors"] == []

        # 2. Provider viewer: floors array should be empty
        prov_res = await ac.get(f"/api/v1/operations/buildings/{bld_id}/360", headers=provider_headers)
        assert prov_res.status_code == 200
        assert prov_res.json()["data"]["floors"] == []

        # 3. Other tenant viewer: floors returned, but room data is masked
        tnt_res = await ac.get(f"/api/v1/operations/buildings/{bld_id}/360", headers=tenant_headers)
        assert tnt_res.status_code == 200
        floors = tnt_res.json()["data"]["floors"]
        assert len(floors) >= 1
        room_item = floors[0]["rooms"][0]
        assert room_item["isTenantDataMasked"] is True
        assert room_item["tenantPhone"] is None
        assert room_item["tenantEmail"] is None

        # 4. Owner viewer: unmasked
        own_res = await ac.get(f"/api/v1/operations/buildings/{bld_id}/360", headers=owner_headers)
        assert own_res.status_code == 200
        own_floors = own_res.json()["data"]["floors"]
        assert len(own_floors) >= 1
        own_room_item = own_floors[0]["rooms"][0]
        assert own_room_item["isTenantDataMasked"] is False


@pytest.mark.asyncio
async def test_tc_sec_03_vietqr_webhook_secret_auth(monkeypatch):
    """TC-SEC-03: Webhook VietQR từ chối khi tắt cờ (503) hoặc sai Secret header (401)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        payload = {
            "transactionId": "TX12345",
            "amount": 5000000,
            "description": "HOMTEL INV-202609-0001",
            "bankCode": "MBBANK"
        }

        # 1. Feature flag disabled -> returns 503
        monkeypatch.setattr(settings, "PAYMENT_GATEWAY_ENABLED", False)
        res_disabled = await ac.post("/api/v1/billing/invoices/webhook/vietqr", json=payload)
        assert res_disabled.status_code == 503
        assert "tạm ngưng" in res_disabled.json()["detail"]

        # 2. Feature flag enabled -> requires valid secret
        monkeypatch.setattr(settings, "PAYMENT_GATEWAY_ENABLED", True)

        # Missing secret header -> 401
        res_missing = await ac.post("/api/v1/billing/invoices/webhook/vietqr", json=payload)
        assert res_missing.status_code == 401

        # Wrong secret header -> 401
        res_wrong = await ac.post(
            "/api/v1/billing/invoices/webhook/vietqr",
            json=payload,
            headers={"X-Webhook-Secret": "fake_attacker_secret_key"}
        )
        assert res_wrong.status_code == 401


@pytest.mark.asyncio
async def test_tc_sec_04_login_security_anti_enumeration():
    """TC-SEC-04: Đăng nhập chống dò tài khoản (Anti-Account Enumeration) - thông điệp lỗi đồng nhất."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Case A: Email does not exist
        res_no_user = await ac.post("/api/v1/auth/login", json={
            "email": "completely_nonexistent_email_123456@homtel.vn",
            "password": "AnyPassword@123"
        })
        assert res_no_user.status_code == 401
        data_no_user = res_no_user.json()

        # Case B: Email exists, wrong password
        res_wrong_pw = await ac.post("/api/v1/auth/login", json={
            "email": "owner@homtel.vn",
            "password": "DefinitivelyWrongPassword@999"
        })
        assert res_wrong_pw.status_code == 401
        data_wrong_pw = res_wrong_pw.json()

        # Both cases must return identical code and message
        assert data_no_user["error"]["code"] == data_wrong_pw["error"]["code"]
        assert data_no_user["error"]["message"] == data_wrong_pw["error"]["message"]
        assert "INVALID_CREDENTIALS" in data_no_user["error"]["message"]


@pytest.mark.asyncio
async def test_tc_sec_05_token_tamper_and_expiration():
    """TC-SEC-05: Chặn truy cập với Token bị can thiệp, sai chữ ký số, hoặc thiếu Bearer."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Tampered token
        tampered_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered_payload_content.invalid_signature"
        res_tampered = await ac.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tampered_token}"})
        assert res_tampered.status_code == 401

        # 2. Random string as token
        res_random = await ac.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-jwt-string"})
        assert res_random.status_code == 401

        # 3. Missing Bearer prefix
        res_no_bearer = await ac.get("/api/v1/auth/me", headers={"Authorization": "Token 12345"})
        assert res_no_bearer.status_code == 401


@pytest.mark.asyncio
async def test_tc_tnt_01_tenant_cross_privacy_isolation():
    """TC-TNT-01: Cách ly bảo mật giữa các Tenant: Tenant B không thể đọc hồ sơ/hợp đồng/evidence của Tenant A."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        tenant_headers = await get_tenant_headers(ac)

        # 1. Register a distinct Tenant B
        u_b = uuid.uuid4().hex[:6]
        reg_res = await ac.post("/api/v1/auth/register", json={
            "fullName": f"Tenant B {u_b}",
            "email": f"tenant_b_{u_b}@homtel.vn",
            "phone": f"09{uuid.uuid4().int % 100000000:08d}",
            "password": "Password@123"
        })
        assert reg_res.status_code == 201
        token_b = reg_res.json()["data"]["accessToken"]
        tenant_b_headers = {"Authorization": f"Bearer {token_b}"}

        # 2. Create building & active contract for Tenant A
        bld_data = await create_isolated_building(ac, owner_headers, "TC-TNT-01")
        c_res = await ac.post("/api/v1/contracts", json={
            "roomId": bld_data["room_id"],
            "tenantId": "usr_tenant",
            "startDate": "2026-09-01",
            "endDate": "2027-09-01",
            "rentAmount": 7000000,
            "depositAmount": 7000000,
            "status": "ACTIVE"
        }, headers=owner_headers)
        assert c_res.status_code == 201
        contract_id = c_res.json()["data"]["id"]

        # Tenant A can view evidence certificate
        ev_a = await ac.get(f"/api/v1/contracts/{contract_id}/evidence", headers=tenant_headers)
        assert ev_a.status_code == 200

        # Tenant B cannot view Tenant A's evidence certificate (403)
        ev_b = await ac.get(f"/api/v1/contracts/{contract_id}/evidence", headers=tenant_b_headers)
        assert ev_b.status_code == 403


@pytest.mark.asyncio
async def test_tc_tnt_02_tenant_notifications():
    """TC-TNT-02: Cư dân xem thông báo in-app (/notifications) và đánh dấu đã đọc."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        tenant_headers = await get_tenant_headers(ac)

        # Fetch notifications
        res = await ac.get("/api/v1/notifications", headers=tenant_headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert "notifications" in data
        assert "unreadCount" in data

        # Mark all as read
        mark_all = await ac.post("/api/v1/notifications/read-all", headers=tenant_headers)
        assert mark_all.status_code == 200

        # Re-fetch -> unreadCount should be 0
        res2 = await ac.get("/api/v1/notifications", headers=tenant_headers)
        assert res2.status_code == 200
        assert res2.json()["data"]["unreadCount"] == 0
