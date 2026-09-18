import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from tests.helpers import get_owner_headers, get_tenant_headers, create_isolated_building


@pytest.mark.asyncio
async def test_tc_crm_01_lead_lifecycle():
    """TC-CRM-01: Tạo lead mới, cập nhật trạng thái lead."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = await get_owner_headers(ac)
        unique_phone = f"09{uuid.uuid4().int % 100000000:08d}"

        # 1. Create lead
        res = await ac.post("/api/v1/crm/leads", json={
            "fullName": f"Khách Hàng {uuid.uuid4().hex[:4]}",
            "phone": unique_phone,
            "email": f"lead_{uuid.uuid4().hex[:6]}@example.com",
            "source": "FACEBOOK",
            "budgetMin": 5000000,
            "budgetMax": 8000000,
            "preferredRoomType": "STUDIO",
            "moveInDate": "2026-10-01",
            "notes": "Quan tâm căn hộ tầng cao view sông"
        }, headers=headers)
        assert res.status_code == 201
        lead_id = res.json()["data"]["id"]
        assert res.json()["data"]["status"] == "NEW"

        # 2. Update lead status to CONTACTED
        patch_res = await ac.patch(f"/api/v1/crm/leads/{lead_id}", json={
            "status": "CONTACTED",
            "notes": "Đã gọi điện tư vấn nhu cầu"
        }, headers=headers)
        assert patch_res.status_code == 200
        assert patch_res.json()["data"]["status"] == "CONTACTED"

        # 3. Retrieve lead detail
        get_res = await ac.get(f"/api/v1/crm/leads/{lead_id}", headers=headers)
        assert get_res.status_code == 200
        assert get_res.json()["data"]["status"] == "CONTACTED"


@pytest.mark.asyncio
async def test_tc_crm_02_schedule_tour():
    """TC-CRM-02: Đặt lịch tour xem phòng gắn với 1 phòng cụ thể."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = await get_owner_headers(ac)
        bld_data = await create_isolated_building(ac, headers, "TC-CRM-02")

        # Create lead
        lead_res = await ac.post("/api/v1/crm/leads", json={
            "fullName": "Khách Đặt Tour",
            "phone": f"09{uuid.uuid4().int % 100000000:08d}",
            "email": f"tour_{uuid.uuid4().hex[:6]}@example.com",
            "source": "ZALO"
        }, headers=headers)
        lead_id = lead_res.json()["data"]["id"]

        # Schedule tour
        tour_res = await ac.post("/api/v1/crm/tours", json={
            "leadId": lead_id,
            "roomId": bld_data["room_id"],
            "scheduledAt": "2026-10-05T14:30:00"
        }, headers=headers)
        assert tour_res.status_code == 201
        tour_data = tour_res.json()["data"]
        assert tour_data["status"] == "SCHEDULED"
        assert tour_data["roomId"] == bld_data["room_id"]
        assert tour_data["leadId"] == lead_id

        # Verify lead status updated to TOURED
        lead_check = await ac.get(f"/api/v1/crm/leads/{lead_id}", headers=headers)
        assert lead_check.json()["data"]["status"] == "TOURED"


@pytest.mark.asyncio
async def test_tc_crm_03_complete_tour_with_feedback():
    """TC-CRM-03: Hoàn thành tour (COMPLETED) kèm feedback và rating."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = await get_owner_headers(ac)
        bld_data = await create_isolated_building(ac, headers, "TC-CRM-03")

        lead_res = await ac.post("/api/v1/crm/leads", json={
            "fullName": "Khách Hoàn Thành Tour",
            "phone": f"09{uuid.uuid4().int % 100000000:08d}"
        }, headers=headers)
        lead_id = lead_res.json()["data"]["id"]

        tour_res = await ac.post("/api/v1/crm/tours", json={
            "leadId": lead_id,
            "roomId": bld_data["room_id"],
            "scheduledAt": "2026-10-06T10:00:00"
        }, headers=headers)
        tour_id = tour_res.json()["data"]["id"]

        # Complete tour with feedback
        comp_res = await ac.patch(f"/api/v1/crm/tours/{tour_id}", json={
            "status": "COMPLETED",
            "feedback": "Khách ưng ý phòng, view đẹp, yêu cầu bổ sung lò vi sóng",
            "rating": 5
        }, headers=headers)
        assert comp_res.status_code == 200
        comp_data = comp_res.json()["data"]
        assert comp_data["status"] == "COMPLETED"
        assert comp_data["rating"] == 5
        assert "ưng ý" in comp_data["feedback"]


@pytest.mark.asyncio
async def test_tc_crm_04_cancel_tour_room_status_unaffected():
    """TC-CRM-04: Hủy tour — phòng liên quan không bị khóa trạng thái sai (vẫn AVAILABLE)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = await get_owner_headers(ac)
        bld_data = await create_isolated_building(ac, headers, "TC-CRM-04")

        lead_res = await ac.post("/api/v1/crm/leads", json={
            "fullName": "Khách Hủy Lịch",
            "phone": f"09{uuid.uuid4().int % 100000000:08d}"
        }, headers=headers)
        lead_id = lead_res.json()["data"]["id"]

        tour_res = await ac.post("/api/v1/crm/tours", json={
            "leadId": lead_id,
            "roomId": bld_data["room_id"],
            "scheduledAt": "2026-10-07T16:00:00"
        }, headers=headers)
        tour_id = tour_res.json()["data"]["id"]

        # Cancel tour
        cancel_res = await ac.patch(f"/api/v1/crm/tours/{tour_id}", json={
            "status": "CANCELLED",
            "feedback": "Khách bận việc đột xuất xin dời lịch"
        }, headers=headers)
        assert cancel_res.status_code == 200
        assert cancel_res.json()["data"]["status"] == "CANCELLED"

        # Verify room remains AVAILABLE
        room_check = await ac.get(f"/api/v1/rooms/{bld_data['room_id']}")
        assert room_check.json()["data"]["status"] == "AVAILABLE"


@pytest.mark.asyncio
async def test_tc_crm_05_convert_lead_to_application():
    """TC-CRM-05: Convert lead thành đơn thuê (rental application) sinh đúng application."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = await get_owner_headers(ac)
        bld_data = await create_isolated_building(ac, headers, "TC-CRM-05")

        lead_res = await ac.post("/api/v1/crm/leads", json={
            "fullName": "Khách Chuyển Đổi Thuê",
            "phone": f"09{uuid.uuid4().int % 100000000:08d}",
            "email": f"convert_{uuid.uuid4().hex[:6]}@example.com"
        }, headers=headers)
        lead_id = lead_res.json()["data"]["id"]

        # Convert lead
        conv_res = await ac.post(f"/api/v1/crm/leads/{lead_id}/convert", json={
            "roomId": bld_data["room_id"],
            "intendedStartDate": "2026-10-15",
            "leaseDurationMonths": 12,
            "notes": "Hợp đồng 1 năm trả trước 2 tháng"
        }, headers=headers)
        assert conv_res.status_code == 201
        conv_data = conv_res.json()["data"]
        assert conv_data["status"] == "CONVERTED"
        app_id = conv_data["applicationId"]
        assert app_id is not None

        # Verify application in rentals list
        apps_res = await ac.get("/api/v1/rentals/applications", headers=headers)
        assert apps_res.status_code == 200
        apps = apps_res.json()["data"]
        target_app = next((a for a in apps if a["id"] == app_id), None)
        assert target_app is not None
        assert target_app["roomId"] == bld_data["room_id"]
        assert target_app["status"] == "PENDING"


@pytest.mark.asyncio
async def test_tc_app_01_approve_application_generates_draft_contract():
    """TC-APP-01: Duyệt hồ sơ thuê (APPROVED) — sinh hợp đồng DRAFT đúng thông tin."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        tenant_headers = await get_tenant_headers(ac)
        bld_data = await create_isolated_building(ac, owner_headers, "TC-APP-01")

        # Tenant submits application
        submit_res = await ac.post("/api/v1/rentals/applications", json={
            "roomId": bld_data["room_id"],
            "intendedStartDate": "2026-11-01",
            "leaseDurationMonths": 6,
            "notes": "Đơn thuê căn hộ test duyệt"
        }, headers=tenant_headers)
        assert submit_res.status_code == 201
        app_id = submit_res.json()["data"]["id"]

        # Owner approves application
        review_res = await ac.post(f"/api/v1/rentals/applications/{app_id}/review", json={
            "decision": "APPROVED",
            "reviewNotes": "Hồ sơ tài chính và nhân thân hợp lệ, duyệt cho thuê."
        }, headers=owner_headers)
        assert review_res.status_code == 200
        review_data = review_res.json()["data"]
        assert review_data["status"] == "APPROVED"
        contract_id = review_data["contractId"]
        assert contract_id is not None

        # Verify contract generated in DRAFT status
        contracts_res = await ac.get("/api/v1/contracts", headers=owner_headers)
        assert contracts_res.status_code == 200
        contracts = contracts_res.json()["data"]
        target_contract = next((c for c in contracts if c["id"] == contract_id), None)
        assert target_contract is not None
        assert target_contract["status"] == "DRAFT"
        assert target_contract["roomId"] == bld_data["room_id"]
        assert target_contract["startDate"] == "2026-11-01"


@pytest.mark.asyncio
async def test_tc_app_02_reject_application_room_remains_available():
    """TC-APP-02: Từ chối hồ sơ thuê (REJECTED) — phòng giữ nguyên AVAILABLE, không có hợp đồng nào được tạo."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        tenant_headers = await get_tenant_headers(ac)
        bld_data = await create_isolated_building(ac, owner_headers, "TC-APP-02")

        # Tenant submits application
        submit_res = await ac.post("/api/v1/rentals/applications", json={
            "roomId": bld_data["room_id"],
            "intendedStartDate": "2026-11-15",
            "leaseDurationMonths": 3,
            "notes": "Đơn thuê test từ chối"
        }, headers=tenant_headers)
        app_id = submit_res.json()["data"]["id"]

        # Owner rejects application
        reject_res = await ac.post(f"/api/v1/rentals/applications/{app_id}/review", json={
            "decision": "REJECTED",
            "rejectionReason": "Thời hạn thuê quá ngắn, không đáp ứng tối thiểu 6 tháng."
        }, headers=owner_headers)
        assert reject_res.status_code == 200
        reject_data = reject_res.json()["data"]
        assert reject_data["status"] == "REJECTED"
        assert reject_data["contractId"] is None

        # Verify room remains AVAILABLE
        room_check = await ac.get(f"/api/v1/rooms/{bld_data['room_id']}")
        assert room_check.json()["data"]["status"] == "AVAILABLE"
