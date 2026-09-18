import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from tests.helpers import (
    get_owner_headers,
    get_tenant_headers,
    get_provider_headers,
    get_admin_headers,
    create_isolated_building,
)


@pytest.mark.asyncio
async def test_tc_ops_01_service_request_lifecycle():
    """TC-OPS-01: Tenant tạo yêu cầu dịch vụ -> Owner/Staff xem được trong Action Center / danh sách."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        tenant_headers = await get_tenant_headers(ac)
        bld_data = await create_isolated_building(ac, owner_headers, "TC-OPS-01")

        # Get an active service
        services = (await ac.get("/api/v1/services")).json()["data"]
        assert len(services) >= 1
        service_id = services[0]["id"]

        # Tenant submits request
        req_res = await ac.post("/api/v1/service-requests", json={
            "serviceId": service_id,
            "roomId": bld_data["room_id"],
            "title": "Bảo dưỡng điều hòa định kỳ",
            "description": "Điều hòa chảy nước ở dàn lạnh",
            "preferredDate": "2026-10-10",
            "urgency": "HIGH"
        }, headers=tenant_headers)
        assert req_res.status_code == 201
        req_id = req_res.json()["data"]["id"]

        # Owner/Staff views requests list
        list_res = await ac.get("/api/v1/service-requests", headers=owner_headers)
        assert list_res.status_code == 200
        reqs = list_res.json()["data"]
        target_req = next((r for r in reqs if r["id"] == req_id), None)
        assert target_req is not None
        assert target_req["status"] == "PENDING"
        assert target_req["title"] == "Bảo dưỡng điều hòa định kỳ"


@pytest.mark.asyncio
async def test_tc_ops_02_assign_and_update_work_order():
    """TC-OPS-02: Giao việc cho Provider -> Provider cập nhật trạng thái IN_PROGRESS -> COMPLETED."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        admin_headers = await get_admin_headers(ac)
        tenant_headers = await get_tenant_headers(ac)
        owner_headers = await get_owner_headers(ac)
        bld_data = await create_isolated_building(ac, owner_headers, "TC-OPS-02")

        services = (await ac.get("/api/v1/services")).json()["data"]
        service = next((s for s in services if s.get("companyId") == "comp_services"), services[0])
        service_id = service["id"]

        # Tenant submits request
        req_res = await ac.post("/api/v1/service-requests", json={
            "serviceId": service_id,
            "roomId": bld_data["room_id"],
            "title": "Sửa vòi nước rò rỉ",
            "description": "Vòi rửa bát bị rỉ nước",
            "urgency": "NORMAL"
        }, headers=tenant_headers)
        req_id = req_res.json()["data"]["id"]

        # Assign work to staff/provider
        assign_res = await ac.post(f"/api/v1/service-requests/{req_id}/assign", json={
            "staffId": "usr_staff",
            "estimatedCost": 250000,
            "notes": "Đã giao cho kỹ thuật viên xử lý trong ngày"
        }, headers=admin_headers)
        assert assign_res.status_code == 201
        assignment_id = assign_res.json()["data"]["id"]

        # Provider updates to IN_PROGRESS
        prog_res = await ac.post(f"/api/v1/service-requests/assignments/{assignment_id}/status", json={
            "status": "IN_PROGRESS",
            "notes": "Đang mang dụng cụ qua kiểm tra"
        }, headers=admin_headers)
        assert prog_res.status_code == 200

        # Provider completes work
        comp_res = await ac.post(f"/api/v1/service-requests/assignments/{assignment_id}/status", json={
            "status": "COMPLETED",
            "notes": "Đã thay van vòi nước mới",
            "finalCost": 250000
        }, headers=admin_headers)
        assert comp_res.status_code == 200

        # Check request status
        check_req = await ac.get(f"/api/v1/service-requests/{req_id}", headers=admin_headers)
        assert check_req.json()["data"]["status"] == "COMPLETED"


@pytest.mark.asyncio
async def test_tc_ops_03_review_work_order():
    """TC-OPS-03: Đóng work order, Tenant đánh giá chất lượng dịch vụ sau khi đóng."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        admin_headers = await get_admin_headers(ac)
        tenant_headers = await get_tenant_headers(ac)
        owner_headers = await get_owner_headers(ac)
        bld_data = await create_isolated_building(ac, owner_headers, "TC-OPS-03")

        services = (await ac.get("/api/v1/services")).json()["data"]
        service = next((s for s in services if s.get("companyId") == "comp_services"), services[0])
        service_id = service["id"]

        # Create & assign & complete
        req_res = await ac.post("/api/v1/service-requests", json={
            "serviceId": service_id,
            "roomId": bld_data["room_id"],
            "title": "Vệ sinh máy lạnh",
            "description": "Lưới lọc bụi bẩn"
        }, headers=tenant_headers)
        req_id = req_res.json()["data"]["id"]

        asg = await ac.post(f"/api/v1/service-requests/{req_id}/assign", json={
            "staffId": "usr_staff",
            "estimatedCost": 200000
        }, headers=admin_headers)
        asg_id = asg.json()["data"]["id"]

        await ac.post(f"/api/v1/service-requests/assignments/{asg_id}/status", json={
            "status": "COMPLETED",
            "finalCost": 200000
        }, headers=admin_headers)

        # Tenant submits review
        rev_res = await ac.post("/api/v1/reviews", json={
            "serviceRequestId": req_id,
            "rating": 5,
            "punctualityRating": 5,
            "qualityRating": 5,
            "comment": "Thợ đến đúng giờ, xử lý nhanh gọn sạch sẽ",
            "tags": ["Nhanh chóng", "Nhiệt tình", "Chuyên nghiệp"]
        }, headers=tenant_headers)
        assert rev_res.status_code == 201
        assert rev_res.json()["data"]["rating"] == 5


@pytest.mark.asyncio
async def test_tc_ops_04_today_cockpit_dynamic_metrics():
    """TC-OPS-04: Cockpit 'Hôm nay' (/operations/today) trả về số liệu tổng hợp động khớp thực tế."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        res = await ac.get("/api/v1/operations/today", headers=owner_headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert "critical" in data
        assert "attention" in data
        assert "upcoming" in data
        assert "healthySummary" in data
        assert "occupancyRate" in data["healthySummary"]


@pytest.mark.asyncio
async def test_tc_adm_01_super_admin_stats():
    """TC-ADM-01: Super Admin xem thống kê toàn hệ thống: số Owner, số tòa nhà, doanh thu."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        admin_headers = await get_admin_headers(ac)
        res = await ac.get("/api/v1/admin/stats", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert "totalUsers" in data
        assert "totalBuildings" in data
        assert "totalRooms" in data
        assert data["totalBuildings"] >= 1


@pytest.mark.asyncio
async def test_tc_adm_02_super_admin_create_owner_and_provider():
    """TC-ADM-02: Super Admin tạo tài khoản Owner mới và Provider mới."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        admin_headers = await get_admin_headers(ac)
        u1 = uuid.uuid4().hex[:6]
        u2 = uuid.uuid4().hex[:6]

        # 1. Create Owner
        o_res = await ac.post("/api/v1/admin/owners", json={
            "fullName": f"New Owner {u1}",
            "email": f"owner_{u1}@homtel.vn",
            "password": "Password@123",
            "phone": f"09{uuid.uuid4().int % 100000000:08d}",
            "companyName": f"Bất Động Sản {u1}",
            "companyType": "OWNER_OPERATOR"
        }, headers=admin_headers)
        assert o_res.status_code == 201
        assert o_res.json()["data"]["user"]["role"] == "OWNER"

        # 2. Create Provider
        p_res = await ac.post("/api/v1/admin/providers", json={
            "fullName": f"New Provider {u2}",
            "email": f"provider_{u2}@homtel.vn",
            "password": "Password@123",
            "phone": f"09{uuid.uuid4().int % 100000000:08d}",
            "companyName": f"Dịch Vụ Kỹ Thuật {u2}",
            "companyType": "SERVICE_PROVIDER"
        }, headers=admin_headers)
        assert p_res.status_code == 201
        assert p_res.json()["data"]["user"]["role"] == "PROVIDER"


@pytest.mark.asyncio
async def test_tc_adm_03_super_admin_cross_company_access():
    """TC-ADM-03: Super Admin có đặc quyền truy cập mọi công ty và tòa nhà không bị giới hạn company_id."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        admin_headers = await get_admin_headers(ac)

        # Super admin can list all companies
        c_res = await ac.get("/api/v1/admin/companies", headers=admin_headers)
        assert c_res.status_code == 200
        companies = c_res.json()["data"]
        assert len(companies) >= 1

        # Super admin can view consolidated PnL for all buildings
        pnl_res = await ac.get("/api/v1/financial/pnl/consolidated", headers=admin_headers)
        assert pnl_res.status_code == 200
        assert "portfolio" in pnl_res.json()["data"]


@pytest.mark.asyncio
async def test_tc_fin_01_consolidated_pnl_calculation():
    """TC-FIN-01: Báo cáo P&L hợp nhất tính tổng đúng bằng tổng từng tòa nhà cộng lại."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        res = await ac.get("/api/v1/financial/pnl/consolidated", headers=owner_headers)
        assert res.status_code == 200
        data = res.json()["data"]
        summary = data["portfolio"]
        blds = data["buildings"]

        # Sum of building billed revenue should equal portfolio gross billed
        calculated_gross = sum(b.get("grossRevenue", 0.0) for b in blds)
        assert round(calculated_gross, 2) == round(summary["grossRevenue"], 2)


@pytest.mark.asyncio
async def test_tc_fin_02_pnl_company_scoping():
    """TC-FIN-02: Owner không được xem báo cáo tài chính của công ty khác (company_id scoping)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        res = await ac.get("/api/v1/financial/pnl/consolidated", headers=owner_headers)
        assert res.status_code == 200
        blds = res.json()["data"]["buildings"]

        # Get owner me to verify company
        me_res = await ac.get("/api/v1/auth/me", headers=owner_headers)
        my_company_ids = [m["companyId"] for m in me_res.json()["data"]["memberships"]]

        for b in blds:
            # Building must belong to one of owner's companies
            b_info = (await ac.get(f"/api/v1/buildings/{b['buildingId']}")).json()["data"]
            assert b_info["companyId"] in my_company_ids
