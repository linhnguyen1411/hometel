import io
import uuid
import asyncio
import pytest
import openpyxl
from httpx import AsyncClient, ASGITransport
from app.main import app
from tests.helpers import (
    get_owner_headers,
    get_tenant_headers,
    get_admin_headers,
    create_isolated_building,
)


@pytest.mark.asyncio
async def test_tc_edg_01_renew_end_date_before_start_date():
    """TC-EDG-01: Gia hạn hợp đồng với ngày kết thúc nhỏ hơn hoặc bằng ngày bắt đầu bị từ chối 400."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        tenant_headers = await get_tenant_headers(ac)
        tenant_me = (await ac.get("/api/v1/auth/me", headers=tenant_headers)).json()["data"]
        bld_data = await create_isolated_building(ac, owner_headers, "TC-EDG-01")

        # Create & sign contract
        c_res = await ac.post("/api/v1/contracts", json={
            "roomId": bld_data["room_id"],
            "tenantId": tenant_me["id"],
            "startDate": "2026-06-01",
            "endDate": "2027-06-01",
            "rentAmount": 6000000,
            "depositAmount": 6000000,
        }, headers=owner_headers)
        assert c_res.status_code == 201
        contract_id = c_res.json()["data"]["id"]

        await ac.post(f"/api/v1/contracts/{contract_id}/sign", json={"signingMethod": "DRAW"}, headers=tenant_headers)

        # Attempt to renew with newEndDate <= startDate (2026-05-01 <= 2026-06-01)
        renew_res = await ac.post(f"/api/v1/contracts/{contract_id}/renew", json={
            "newEndDate": "2026-05-01",
            "newRentAmount": 6500000
        }, headers=owner_headers)
        assert renew_res.status_code == 400
        assert "lớn hơn ngày bắt đầu" in renew_res.text


@pytest.mark.asyncio
async def test_tc_edg_02_negative_room_price_and_area_validation():
    """TC-EDG-02: Tạo phòng với diện tích <= 0 hoặc giá âm bị chặn 422 Unprocessable Entity."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        bld_data = await create_isolated_building(ac, owner_headers, "TC-EDG-02")
        bld_id = bld_data["building_id"]
        floor_id = bld_data["floor_id"]

        # Case 1: Negative area
        res_neg_area = await ac.post("/api/v1/rooms", json={
            "buildingId": bld_id,
            "floorId": floor_id,
            "roomNumber": "P-NEG-1",
            "area": -15.0,
            "baseRent": 5000000
        }, headers=owner_headers)
        assert res_neg_area.status_code == 422

        # Case 2: Zero area
        res_zero_area = await ac.post("/api/v1/rooms", json={
            "buildingId": bld_id,
            "floorId": floor_id,
            "roomNumber": "P-ZERO-1",
            "area": 0.0,
            "baseRent": 5000000
        }, headers=owner_headers)
        assert res_zero_area.status_code == 422

        # Case 3: Negative rent
        res_neg_rent = await ac.post("/api/v1/rooms", json={
            "buildingId": bld_id,
            "floorId": floor_id,
            "roomNumber": "P-NEG-2",
            "area": 25.0,
            "baseRent": -5000000
        }, headers=owner_headers)
        assert res_neg_rent.status_code == 422


@pytest.mark.asyncio
async def test_tc_edg_03_non_existent_entity_returns_404():
    """TC-EDG-03: Truy vấn entity không tồn tại trả về JSON 404 chuẩn, không rơi vào lỗi sập server 500."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)

        # 1. Non-existent building
        b_res = await ac.get("/api/v1/buildings/bld_non_existent_123456789", headers=owner_headers)
        assert b_res.status_code == 404
        assert b_res.headers["content-type"].startswith("application/json")

        # 2. Non-existent room
        r_res = await ac.get("/api/v1/rooms/room_non_existent_123456789", headers=owner_headers)
        assert r_res.status_code == 404
        assert r_res.headers["content-type"].startswith("application/json")

        # 3. Non-existent contract
        c_res = await ac.get("/api/v1/contracts/ctr_non_existent_123456789", headers=owner_headers)
        assert c_res.status_code == 404
        assert c_res.headers["content-type"].startswith("application/json")

        # 4. Non-existent invoice
        i_res = await ac.get("/api/v1/billing/invoices/inv_non_existent_123456789", headers=owner_headers)
        assert i_res.status_code == 404
        assert i_res.headers["content-type"].startswith("application/json")


@pytest.mark.asyncio
async def test_tc_edg_04_excel_import_atomic_rollback_on_bad_row():
    """TC-EDG-04: Nhập Excel công tơ bị lỗi ở một dòng -> toàn bộ giao dịch rollback, trả 422, không lưu dữ liệu rác."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        bld_data = await create_isolated_building(ac, owner_headers, "TC-EDG-04")

        # Fetch initial reading of room's electricity meter
        m_res = await ac.get(f"/api/v1/billing/meters/room/{bld_data['room_id']}", headers=owner_headers)
        elec_meter = next(m for m in m_res.json()["data"] if m.get("type") == "ELECTRICITY" or m.get("meterType") == "ELECTRICITY")
        initial_reading = elec_meter.get("currentReading") or 0.0

        # Build Excel with 2 rows:
        # Row 1: Valid reading (initial + 100)
        # Row 2: Corrupted non-numeric reading ("CORRUPTED_TEXT")
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Meter Readings"
        ws.append(["Tên tòa nhà", "Số phòng", "Loại công tơ", "Chỉ số mới", "Ngày đọc", "Ghi chú"])
        ws.append([bld_data["building_name"], bld_data["room_number"], "DIEN", initial_reading + 100, "2026-09-17", "Hợp lệ"])
        ws.append([bld_data["building_name"], bld_data["room_number"], "DIEN", "CORRUPTED_INVALID_NUMBER", "2026-09-17", "Lỗi dữ liệu"])

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)

        # Upload Excel file
        upload_res = await ac.post(
            "/api/v1/billing/meters/bulk-import",
            files={"file": ("corrupted_import.xlsx", buf.read(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers=owner_headers,
        )
        assert upload_res.status_code == 422
        assert "không hợp lệ" in upload_res.json()["error"]["message"]

        # Verify atomic rollback: Row 1 must NOT be saved!
        m_verify = await ac.get(f"/api/v1/billing/meters/room/{bld_data['room_id']}", headers=owner_headers)
        elec_meter_after = next(m for m in m_verify.json()["data"] if m.get("type") == "ELECTRICITY" or m.get("meterType") == "ELECTRICITY")
        assert elec_meter_after.get("currentReading") == initial_reading


@pytest.mark.asyncio
async def test_tc_edg_05_concurrent_contract_signing():
    """TC-EDG-05: Ký hợp đồng đồng thời: request đầu tiên thành công, request sau nhận 409 ALREADY_ACTIVE."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        owner_headers = await get_owner_headers(ac)
        tenant_headers = await get_tenant_headers(ac)
        tenant_me = (await ac.get("/api/v1/auth/me", headers=tenant_headers)).json()["data"]
        bld_data = await create_isolated_building(ac, owner_headers, "TC-EDG-05")

        # Create draft contract
        c_res = await ac.post("/api/v1/contracts", json={
            "roomId": bld_data["room_id"],
            "tenantId": tenant_me["id"],
            "startDate": "2026-10-01",
            "endDate": "2027-10-01",
            "rentAmount": 8000000,
            "depositAmount": 8000000,
        }, headers=owner_headers)
        assert c_res.status_code == 201
        contract_id = c_res.json()["data"]["id"]

        # Call sign sequentially or simultaneously
        sign1 = await ac.post(f"/api/v1/contracts/{contract_id}/sign", json={"signingMethod": "DRAW"}, headers=tenant_headers)
        assert sign1.status_code == 200
        assert sign1.json()["data"]["status"] == "ACTIVE"

        # Second attempt must return 409 Conflict
        sign2 = await ac.post(f"/api/v1/contracts/{contract_id}/sign", json={"signingMethod": "DRAW"}, headers=tenant_headers)
        assert sign2.status_code == 409
        assert sign2.json()["error"]["code"] == "ALREADY_ACTIVE"
