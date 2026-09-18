import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings


@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_auth_login_all_5_roles():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        roles = [
            ("admin@homtel.vn", "Admin@123", "SUPER_ADMIN"),
            ("owner@homtel.vn", "Owner@123", "OWNER"),
            ("staff@homtel.vn", "Staff@123", "STAFF"),
            ("provider@homtel.vn", "Provider@123", "PROVIDER"),
            ("tenant@homtel.vn", "Tenant@123", "TENANT"),
        ]

        for email, password, expected_role in roles:
            resp = await ac.post("/api/v1/auth/login", json={"email": email, "password": password})
            assert resp.status_code == 200, f"Failed login for {email}: {resp.text}"
            body = resp.json()
            assert body["success"] is True
            assert "token" in body["data"] or "accessToken" in body["data"]
            user = body["data"]["user"]
            assert user["role"] == expected_role, f"Expected {expected_role} got {user['role']}"


@pytest.mark.asyncio
async def test_public_buildings_and_rooms():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # List buildings
        resp = await ac.get("/api/v1/buildings")
        assert resp.status_code == 200
        blds = resp.json()["data"]
        assert len(blds) >= 2

        # Get building by slug
        resp = await ac.get("/api/v1/buildings/slug/homtel-riverside-central")
        assert resp.status_code == 200
        bld = resp.json()["data"]
        assert bld["name"] == "Homtel Riverside Central"
        assert len(bld["floors"]) >= 3

        # List rooms
        resp = await ac.get("/api/v1/rooms")
        assert resp.status_code == 200
        rooms = resp.json()["data"]
        assert len(rooms) >= 4


@pytest.mark.asyncio
async def test_operations_cockpit_and_building_360():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Login as owner
        login_resp = await ac.post("/api/v1/auth/login", json={"email": "owner@homtel.vn", "password": "Owner@123"})
        token = login_resp.json()["data"]["accessToken"]
        headers = {"Authorization": f"Bearer {token}"}

        # Today cockpit
        resp = await ac.get("/api/v1/operations/today", headers=headers)
        assert resp.status_code == 200
        cockpit = resp.json()["data"]
        assert "healthySummary" in cockpit
        assert cockpit["healthySummary"]["totalUnits"] >= 4

        # Building 360
        resp = await ac.get("/api/v1/operations/buildings/bld_riverside/360", headers=headers)
        assert resp.status_code == 200
        bld360 = resp.json()["data"]
        assert bld360["building"]["name"] == "Homtel Riverside Central"
        assert len(bld360["floors"]) >= 3


@pytest.mark.asyncio
async def test_services_and_reviews():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Public services catalog
        resp = await ac.get("/api/v1/services")
        assert resp.status_code == 200
        services = resp.json()["data"]
        assert len(services) >= 3

        # Provider reputation
        resp = await ac.get("/api/v1/reviews/provider/comp_services")
        assert resp.status_code == 200
        rep = resp.json()["data"]
        assert rep["totalReviews"] >= 1
        assert rep["averageRating"] == 5.0


@pytest.mark.asyncio
async def test_financial_consolidated_pnl():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        login_resp = await ac.post("/api/v1/auth/login", json={"email": "owner@homtel.vn", "password": "Owner@123"})
        token = login_resp.json()["data"]["accessToken"]
        headers = {"Authorization": f"Bearer {token}"}

        resp = await ac.get("/api/v1/financial/pnl/consolidated", headers=headers)
        assert resp.status_code == 200
        pnl = resp.json()["data"]
        assert "portfolio" in pnl
        assert pnl["portfolio"]["totalBuildings"] >= 2
        assert len(pnl["buildings"]) >= 2


@pytest.mark.asyncio
async def test_role_based_access_denied():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Login as Tenant
        t_resp = await ac.post("/api/v1/auth/login", json={"email": "tenant@homtel.vn", "password": "Tenant@123"})
        tenant_token = t_resp.json()["data"]["accessToken"]
        tenant_headers = {"Authorization": f"Bearer {tenant_token}"}

        # 2. Login as Staff
        s_resp = await ac.post("/api/v1/auth/login", json={"email": "staff@homtel.vn", "password": "Staff@123"})
        staff_token = s_resp.json()["data"]["accessToken"]
        staff_headers = {"Authorization": f"Bearer {staff_token}"}

        # 3. Login as Provider
        p_resp = await ac.post("/api/v1/auth/login", json={"email": "provider@homtel.vn", "password": "Provider@123"})
        provider_token = p_resp.json()["data"]["accessToken"]
        provider_headers = {"Authorization": f"Bearer {provider_token}"}

        # Scenario A: Tenant cannot create buildings (requires OWNER or SUPER_ADMIN)
        r1 = await ac.post("/api/v1/buildings", json={
            "companyId": "comp_homtel",
            "name": "Unauthorized Building",
            "slug": "unauthorized-bld",
            "address": "123 Test St"
        }, headers=tenant_headers)
        assert r1.status_code == 403

        # Scenario B: Staff cannot access Super Admin stats (requires SUPER_ADMIN)
        r2 = await ac.get("/api/v1/admin/stats", headers=staff_headers)
        assert r2.status_code == 403

        # Scenario C: Provider cannot access consolidated P&L (requires OWNER or SUPER_ADMIN)
        r3 = await ac.get("/api/v1/financial/pnl/consolidated", headers=provider_headers)
        assert r3.status_code == 403

        # Scenario D: Tenant cannot scan OCR meters (requires OWNER, STAFF, or SUPER_ADMIN)
        r4 = await ac.post("/api/v1/billing/meters/ocr-scan", json={"meterId": "mtr_1", "imageBase64": "fake_base64_data"}, headers=tenant_headers)
        assert r4.status_code == 403

        # Scenario E: Tenant cannot execute quick operations actions (requires OWNER, STAFF, or SUPER_ADMIN)
        r5 = await ac.post("/api/v1/operations/actions/SEND_REMINDER/quick-action", json={"actionType": "remind_tenant", "payload": {"invoiceId": "inv_test"}}, headers=tenant_headers)
        assert r5.status_code == 403


@pytest.mark.asyncio
async def test_building_360_masking_by_role():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        bld_id = "bld_riverside"

        # Case 1: Anonymous call (No token)
        # Must return summary metrics only, floors must be empty (NO room PII leaked)
        anon_resp = await ac.get(f"/api/v1/operations/buildings/{bld_id}/360")
        assert anon_resp.status_code == 200
        anon_data = anon_resp.json()["data"]
        assert anon_data["summary"]["totalRooms"] >= 1
        assert anon_data["floors"] == [], "Anonymous caller must receive empty floors to prevent PII leakage!"

        # Case 2: Provider call
        p_login = await ac.post("/api/v1/auth/login", json={"email": "provider@homtel.vn", "password": "Provider@123"})
        p_headers = {"Authorization": f"Bearer {p_login.json()['data']['accessToken']}"}
        p_resp = await ac.get(f"/api/v1/operations/buildings/{bld_id}/360", headers=p_headers)
        assert p_resp.status_code == 200
        p_data = p_resp.json()["data"]
        assert p_data["floors"] == [], "Provider must not receive room PII floors list in Building 360!"

        # Case 3: Tenant call (Tenant rents rom_101)
        t_login = await ac.post("/api/v1/auth/login", json={"email": "tenant@homtel.vn", "password": "Tenant@123"})
        t_headers = {"Authorization": f"Bearer {t_login.json()['data']['accessToken']}"}
        t_resp = await ac.get(f"/api/v1/operations/buildings/{bld_id}/360", headers=t_headers)
        assert t_resp.status_code == 200
        t_floors = t_resp.json()["data"]["floors"]
        assert len(t_floors) > 0

        # Verify Room 101 vs other rooms for Tenant
        all_rooms = [rm for fl in t_floors for rm in fl["rooms"]]
        my_room = next((r for r in all_rooms if r["id"] == "rom_101"), None)
        other_rooms = [r for r in all_rooms if r["id"] != "rom_101"]

        assert my_room is not None
        assert my_room["isTenantDataMasked"] is False
        assert my_room["baseRent"] is not None
        assert my_room["tenantName"] == "Hoàng Anh Cư Dân"

        for other_rm in other_rooms:
            assert other_rm["isTenantDataMasked"] is True, f"Room {other_rm['id']} must be masked for tenant!"
            assert other_rm["baseRent"] is None, f"Room {other_rm['id']} baseRent must be hidden!"
            assert other_rm["tenantPhone"] is None
            assert other_rm["tenantEmail"] is None
            if other_rm["status"] == "OCCUPIED":
                assert other_rm["tenantName"] == "Đang có người ở"

        # Case 4: Owner / Staff call (Full privileged visibility)
        o_login = await ac.post("/api/v1/auth/login", json={"email": "owner@homtel.vn", "password": "Owner@123"})
        o_headers = {"Authorization": f"Bearer {o_login.json()['data']['accessToken']}"}
        o_resp = await ac.get(f"/api/v1/operations/buildings/{bld_id}/360", headers=o_headers)
        assert o_resp.status_code == 200
        o_floors = o_resp.json()["data"]["floors"]
        o_rooms = [rm for fl in o_floors for rm in fl["rooms"]]

        for r in o_rooms:
            assert r["isTenantDataMasked"] is False
            assert r["baseRent"] is not None and r["baseRent"] > 0
            if r["id"] == "rom_101":
                assert r["tenantName"] == "Hoàng Anh Cư Dân"
                assert r["tenantPhone"] == "0905000005"


@pytest.mark.asyncio
async def test_room_360_masking_by_role():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        room_id = "rom_101"

        # Case 1: Anonymous caller
        anon_resp = await ac.get(f"/api/v1/operations/rooms/{room_id}/360")
        assert anon_resp.status_code == 200
        anon_data = anon_resp.json()["data"]
        assert anon_data["tenant"] is None, "Anonymous must not see tenant PII in room 360!"
        assert anon_data["activeContract"] is None, "Anonymous must not see active contract!"
        assert anon_data["invoices"] == [], "Anonymous must not see invoices!"

        # Case 2: Tenant who owns the room
        t_login = await ac.post("/api/v1/auth/login", json={"email": "tenant@homtel.vn", "password": "Tenant@123"})
        t_headers = {"Authorization": f"Bearer {t_login.json()['data']['accessToken']}"}
        t_resp = await ac.get(f"/api/v1/operations/rooms/{room_id}/360", headers=t_headers)
        assert t_resp.status_code == 200
        t_data = t_resp.json()["data"]
        assert t_data["tenant"] is not None
        assert t_data["tenant"]["name"] == "Hoàng Anh Cư Dân"
        assert t_data["activeContract"] is not None
        assert len(t_data["invoices"]) > 0

        # Case 3: Owner / Staff
        s_login = await ac.post("/api/v1/auth/login", json={"email": "staff@homtel.vn", "password": "Staff@123"})
        s_headers = {"Authorization": f"Bearer {s_login.json()['data']['accessToken']}"}
        s_resp = await ac.get(f"/api/v1/operations/rooms/{room_id}/360", headers=s_headers)
        assert s_resp.status_code == 200
        s_data = s_resp.json()["data"]
        assert s_data["tenant"] is not None
        assert s_data["activeContract"] is not None


@pytest.mark.asyncio
async def test_vietqr_webhook_auth_required(monkeypatch):
    monkeypatch.setattr(settings, "PAYMENT_GATEWAY_ENABLED", True)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        payload = {
            "transactionId": "TX_TEST_9999",
            "amount": 8000000.0,
            "description": "HOMTEL INV-202609-0001 thanh toan phong 101",
            "bankCode": "MB",
            "accountNumber": "0905123456",
            "transactionDate": "2026-09-16 10:00:00"
        }

        # Case 1: Missing X-Webhook-Secret header -> 401
        r1 = await ac.post("/api/v1/billing/invoices/webhook/vietqr", json=payload)
        assert r1.status_code == 401
        assert "INVALID_WEBHOOK_SECRET" in r1.text

        # Case 2: Wrong X-Webhook-Secret header -> 401
        r2 = await ac.post(
            "/api/v1/billing/invoices/webhook/vietqr",
            json=payload,
            headers={"X-Webhook-Secret": "invalid_fake_secret_key"}
        )
        assert r2.status_code == 401
        assert "INVALID_WEBHOOK_SECRET" in r2.text

        # Case 3: Valid X-Webhook-Secret header -> 200 OK
        r3 = await ac.post(
            "/api/v1/billing/invoices/webhook/vietqr",
            json=payload,
            headers={"X-Webhook-Secret": "vqr_secret_homtel_dev_2026"}
        )
        assert r3.status_code == 200
        data = r3.json()["data"]
        assert data["status"] in ["RECONCILED", "DUPLICATE_SKIPPED", "NOT_FOUND"]

