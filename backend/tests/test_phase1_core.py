import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_feature_flags_vietqr_and_zalo_return_503():
    """Verify that VietQR and Zalo endpoints return 503 with explicit notice when feature flags are False."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        expected_msg = "Tính năng đang tạm ngưng, sẽ kích hoạt sau khi hoàn tất đăng ký doanh nghiệp"

        # Login as owner to get valid auth
        login_res = await ac.post("/api/v1/auth/login", json={"email": "owner@homtel.vn", "password": "Owner@123"})
        token = login_res.json()["data"]["accessToken"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. GET /billing/invoices/{id}/vietqr
        resp1 = await ac.get("/api/v1/billing/invoices/inv_test_123/vietqr", headers=headers)
        assert resp1.status_code == 503
        assert expected_msg in resp1.text

        # 2. POST /billing/invoices/webhook/vietqr
        resp2 = await ac.post("/api/v1/billing/invoices/webhook/vietqr", json={
            "transactionId": "tx_test_123",
            "amount": 5000000,
            "description": "INV123"
        })
        assert resp2.status_code == 503
        assert expected_msg in resp2.text

        # 3. POST /notifications/send-zalo
        resp3 = await ac.post("/api/v1/notifications/send-zalo", json={
            "userId": "usr_test",
            "title": "Thông báo hóa đơn",
            "message": "Nội dung thông báo qua Zalo ZNS"
        }, headers=headers)
        assert resp3.status_code == 503
        assert expected_msg in resp3.text


@pytest.mark.asyncio
async def test_building_floor_room_crud_and_delete_guards():
    """Verify Building, Floor, Room CRUD and delete constraints (foreign key & room guards)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Login as owner
        login_res = await ac.post("/api/v1/auth/login", json={"email": "owner@homtel.vn", "password": "Owner@123"})
        assert login_res.status_code == 200
        token = login_res.json()["data"]["accessToken"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Create Building
        bld_res = await ac.post("/api/v1/buildings", json={
            "name": "Test Delete Guard Building",
            "address": "999 Test Guard St, Ward 1",
            "city": "Hồ Chí Minh",
            "district": "Quận 1",
            "total_floors": 2
        }, headers=headers)
        assert bld_res.status_code == 201
        bld_id = bld_res.json()["data"]["id"]

        # 2. Create Floor
        flr_res = await ac.post(f"/api/v1/buildings/{bld_id}/floors", json={
            "floorNumber": 1,
            "name": "Tầng 1 Test"
        }, headers=headers)
        assert flr_res.status_code == 201
        flr_id = flr_res.json()["data"]["id"]

        # 3. Create Room on this floor
        room_res = await ac.post("/api/v1/rooms", json={
            "building_id": bld_id,
            "floor_id": flr_id,
            "room_number": "T101",
            "room_type": "STUDIO",
            "base_price_monthly": 6000000,
            "area_sqm": 28,
            "max_occupants": 2,
            "status": "AVAILABLE"
        }, headers=headers)
        assert room_res.status_code == 201
        room_id = room_res.json()["data"]["id"]

        # 4. Attempt to delete floor while it has rooms -> MUST FAIL (400)
        del_flr_fail = await ac.delete(f"/api/v1/floors/{flr_id}", headers=headers)
        assert del_flr_fail.status_code == 400
        assert "Không thể xóa tầng đang chứa phòng" in del_flr_fail.json()["detail"]

        # 5. Attempt to delete building while it has floors/rooms -> MUST FAIL (400)
        del_bld_fail = await ac.delete(f"/api/v1/buildings/{bld_id}", headers=headers)
        assert del_bld_fail.status_code == 400

        # 6. Delete room -> succeeds
        del_room = await ac.delete(f"/api/v1/rooms/{room_id}", headers=headers)
        assert del_room.status_code == 200

        # 7. Delete floor -> succeeds
        del_flr = await ac.delete(f"/api/v1/floors/{flr_id}", headers=headers)
        assert del_flr.status_code == 200

        # 8. Delete building -> succeeds
        del_bld = await ac.delete(f"/api/v1/buildings/{bld_id}", headers=headers)
        assert del_bld.status_code == 200


@pytest.mark.asyncio
async def test_booking_lifecycle_e2e_and_rejection():
    """Verify full booking lifecycle: Lead -> Tour -> Convert -> Application -> Review -> Contract -> Sign -> OCCUPIED.
    Also verify that rejecting an application leaves room AVAILABLE.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Logins
        owner_login = await ac.post("/api/v1/auth/login", json={"email": "owner@homtel.vn", "password": "Owner@123"})
        owner_token = owner_login.json()["data"]["accessToken"]
        owner_headers = {"Authorization": f"Bearer {owner_token}"}

        tenant_login = await ac.post("/api/v1/auth/login", json={"email": "tenant@homtel.vn", "password": "Tenant@123"})
        tenant_token = tenant_login.json()["data"]["accessToken"]
        tenant_headers = {"Authorization": f"Bearer {tenant_token}"}

        # 1. Setup Building, Floor, Room
        bld_res = await ac.post("/api/v1/buildings", json={
            "name": "Booking Flow Tower",
            "address": "123 Flow Ave",
            "city": "Hồ Chí Minh",
            "district": "Bình Thạnh",
            "total_floors": 1
        }, headers=owner_headers)
        assert bld_res.status_code == 201
        bld_id = bld_res.json()["data"]["id"]

        flr_res = await ac.post(f"/api/v1/buildings/{bld_id}/floors", json={
            "floorNumber": 1,
            "name": "Tầng 1"
        }, headers=owner_headers)
        assert flr_res.status_code == 201
        flr_id = flr_res.json()["data"]["id"]

        room_res = await ac.post("/api/v1/rooms", json={
            "building_id": bld_id,
            "floor_id": flr_id,
            "room_number": "BF-101",
            "room_type": "STUDIO",
            "base_price_monthly": 7500000,
            "area_sqm": 30,
            "max_occupants": 2,
            "status": "AVAILABLE"
        }, headers=owner_headers)
        assert room_res.status_code == 201
        room_id = room_res.json()["data"]["id"]

        # 2. Create Lead for tenant@homtel.vn
        lead_res = await ac.post("/api/v1/crm/leads", json={
            "fullName": "Tenant User",
            "phone": "0988776655",
            "email": "tenant@homtel.vn",
            "source": "FACEBOOK",
            "budgetMin": 5000000,
            "budgetMax": 8000000,
            "notes": "Quan tâm phòng BF-101"
        }, headers=owner_headers)
        assert lead_res.status_code == 201
        lead_id = lead_res.json()["data"]["id"]

        # 3. Schedule Tour
        tour_res = await ac.post("/api/v1/crm/tours", json={
            "leadId": lead_id,
            "roomId": room_id,
            "scheduledAt": "2026-10-01T09:00:00Z",
            "notes": "Hẹn xem phòng sáng 1/10"
        }, headers=owner_headers)
        assert tour_res.status_code == 201
        tour_id = tour_res.json()["data"]["id"]

        # 4. Complete Tour
        comp_tour = await ac.patch(f"/api/v1/crm/tours/{tour_id}", json={
            "status": "COMPLETED",
            "feedback": "Khách rất ưng ý, muốn đặt cọc và làm hợp đồng ngay."
        }, headers=owner_headers)
        assert comp_tour.status_code == 200

        # 5. Convert Lead -> Rental Application
        conv_res = await ac.post(f"/api/v1/crm/leads/{lead_id}/convert", json={
            "roomId": room_id,
            "intendedStartDate": "2026-10-05",
            "leaseDurationMonths": 12,
            "notes": "Chuyển đổi lead thành đơn thuê"
        }, headers=owner_headers)
        assert conv_res.status_code == 201
        app_id = conv_res.json()["data"]["applicationId"]

        # 6. Review & Approve Application -> generates Contract
        review_res = await ac.post(f"/api/v1/rentals/applications/{app_id}/review", json={
            "decision": "APPROVED",
            "reviewNotes": "Hồ sơ chuẩn, duyệt cho thuê phòng BF-101."
        }, headers=owner_headers)
        assert review_res.status_code == 200
        contract_id = review_res.json()["data"]["contractId"]
        assert contract_id is not None

        # Verify room before sign is still not stuck
        room_check = await ac.get(f"/api/v1/rooms/{room_id}")
        assert room_check.status_code == 200

        # 7. Sign Contract (Tenant signs with OTP or Draw)
        sign_res = await ac.post(f"/api/v1/contracts/{contract_id}/sign", json={
            "signingMethod": "CANVAS_DRAW",
            "signatureData": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        }, headers=tenant_headers)
        assert sign_res.status_code == 200

        # 8. VERIFY ROOM STATUS MUST BE OCCUPIED
        room_after_sign = await ac.get(f"/api/v1/rooms/{room_id}")
        assert room_after_sign.status_code == 200
        assert room_after_sign.json()["data"]["status"] == "OCCUPIED"

        # 9. Test Rejection flow on Room 2
        room2_res = await ac.post("/api/v1/rooms", json={
            "building_id": bld_id,
            "floor_id": flr_id,
            "room_number": "BF-102",
            "room_type": "STUDIO",
            "base_price_monthly": 7500000,
            "area_sqm": 30,
            "max_occupants": 2,
            "status": "AVAILABLE"
        }, headers=owner_headers)
        room2_id = room2_res.json()["data"]["id"]

        lead2_res = await ac.post("/api/v1/crm/leads", json={
            "fullName": "Khách Reject",
            "phone": "0911223344",
            "email": "reject@gmail.com"
        }, headers=owner_headers)
        lead2_id = lead2_res.json()["data"]["id"]

        conv2_res = await ac.post(f"/api/v1/crm/leads/{lead2_id}/convert", json={
            "roomId": room2_id,
            "intendedStartDate": "2026-10-05",
            "leaseDurationMonths": 6
        }, headers=owner_headers)
        app2_id = conv2_res.json()["data"]["applicationId"]

        # Reject application
        reject_res = await ac.post(f"/api/v1/rentals/applications/{app2_id}/review", json={
            "decision": "REJECTED",
            "reviewNotes": "Không đủ điều kiện tài chính."
        }, headers=owner_headers)
        assert reject_res.status_code == 200

        # Room 2 MUST REMAIN AVAILABLE
        room2_after_reject = await ac.get(f"/api/v1/rooms/{room2_id}")
        assert room2_after_reject.json()["data"]["status"] == "AVAILABLE"


@pytest.mark.asyncio
async def test_monthly_batch_invoicing_idempotent():
    """Verify batch invoice generation creates invoices for active contracts and is strictly idempotent."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_login = await ac.post("/api/v1/auth/login", json={"email": "owner@homtel.vn", "password": "Owner@123"})
        owner_token = owner_login.json()["data"]["accessToken"]
        headers = {"Authorization": f"Bearer {owner_token}"}

        period = "2026-11"

        # First run: should create invoices for active contracts
        run1 = await ac.post("/api/v1/billing/invoices/generate-monthly", json={
            "period": period
        }, headers=headers)
        assert run1.status_code in (200, 201)
        data1 = run1.json()["data"]
        created1 = data1["invoices_created"]
        assert created1 >= 1, f"Expected at least 1 invoice created, got {created1}"

        # Second run with same period: MUST be 0 created, all skipped (idempotent!)
        run2 = await ac.post("/api/v1/billing/invoices/generate-monthly", json={
            "period": period
        }, headers=headers)
        assert run2.status_code in (200, 201)
        data2 = run2.json()["data"]
        assert data2["invoices_created"] == 0
        assert data2["invoices_skipped"] >= created1


@pytest.mark.asyncio
async def test_contract_renew_and_terminate_resets_room_status():
    """Verify contract renewal updates term, and contract termination explicitly resets room status to AVAILABLE."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_login = await ac.post("/api/v1/auth/login", json={"email": "owner@homtel.vn", "password": "Owner@123"})
        owner_token = owner_login.json()["data"]["accessToken"]
        headers = {"Authorization": f"Bearer {owner_token}"}

        # Find an active contract
        contracts_res = await ac.get("/api/v1/contracts?status=ACTIVE", headers=headers)
        assert contracts_res.status_code == 200
        contracts = contracts_res.json()["data"]
        assert len(contracts) >= 1, "Expected at least 1 active contract"
        target_contract = contracts[0]
        cid = target_contract["id"]
        rid = target_contract["room_id"]

        # 1. Renew contract
        renew_res = await ac.post(f"/api/v1/contracts/{cid}/renew", json={
            "newEndDate": "2028-12-31",
            "newRentAmount": 9900000,
            "notes": "Gia hạn thêm 2 năm"
        }, headers=headers)
        assert renew_res.status_code == 200
        assert renew_res.json()["data"]["newEndDate"] == "2028-12-31"
        assert renew_res.json()["data"]["rentAmount"] == 9900000

        # Room should still be OCCUPIED
        room_mid = await ac.get(f"/api/v1/rooms/{rid}")
        assert room_mid.json()["data"]["status"] == "OCCUPIED"

        # 2. Terminate contract
        term_res = await ac.post(f"/api/v1/contracts/{cid}/terminate", json={
            "terminationDate": "2026-10-01",
            "reason": "Khách dọn đi đúng hạn"
        }, headers=headers)
        assert term_res.status_code == 200
        assert term_res.json()["data"]["status"] == "TERMINATED"

        # 3. CRITICAL: ROOM MUST BE RESET TO AVAILABLE!
        room_after = await ac.get(f"/api/v1/rooms/{rid}")
        assert room_after.status_code == 200
        assert room_after.json()["data"]["status"] == "AVAILABLE", (
            f"Expected room {rid} to be AVAILABLE after termination, got {room_after.json()['data']['status']}"
        )
