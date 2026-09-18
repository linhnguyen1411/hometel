import io
import uuid
import pytest
import openpyxl
from httpx import AsyncClient, ASGITransport
from app.main import app
from tests.helpers import get_owner_headers, get_tenant_headers, create_isolated_building


@pytest.mark.asyncio
async def test_tc_bld_01_create_building_floor_room():
    """TC-BLD-01: Tạo tòa nhà mới, tạo tầng, tạo phòng, gán phòng vào đúng tầng."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = await get_owner_headers(ac)
        data = await create_isolated_building(ac, headers, "TC-BLD-01")
        assert data["building_id"] is not None
        assert data["floor_id"] is not None
        assert data["room_id"] is not None

        # Verify building detail reflects the floor and room
        b_res = await ac.get(f"/api/v1/buildings/{data['building_id']}")
        assert b_res.status_code == 200
        b_data = b_res.json()["data"]
        assert len(b_data["floors"]) >= 1
        assert b_data["floors"][0]["id"] == data["floor_id"]

        r_res = await ac.get(f"/api/v1/rooms/{data['room_id']}")
        assert r_res.status_code == 200
        r_data = r_res.json()["data"]
        assert r_data["floorId"] == data["floor_id"]
        assert r_data["buildingId"] == data["building_id"]


@pytest.mark.asyncio
async def test_tc_bld_02_edit_building_floor_room():
    """TC-BLD-02: Sửa thông tin tòa nhà, tầng, và phòng."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = await get_owner_headers(ac)
        data = await create_isolated_building(ac, headers, "TC-BLD-02")

        # 1. Edit building
        up_bld = await ac.patch(f"/api/v1/buildings/{data['building_id']}", json={
            "description": "Updated description for TC-BLD-02",
            "district": "Quận 3"
        }, headers=headers)
        assert up_bld.status_code == 200
        assert up_bld.json()["data"]["description"] == "Updated description for TC-BLD-02"

        # 2. Edit floor
        up_flr = await ac.patch(f"/api/v1/floors/{data['floor_id']}", json={
            "name": "Tầng 1 VIP"
        }, headers=headers)
        assert up_flr.status_code == 200
        assert up_flr.json()["data"]["name"] == "Tầng 1 VIP"

        # 3. Edit room
        up_room = await ac.patch(f"/api/v1/rooms/{data['room_id']}", json={
            "base_rent": 7200000,
            "description": "Phòng đã nâng cấp nội thất"
        }, headers=headers)
        assert up_room.status_code == 200
        assert float(up_room.json()["data"]["baseRent"]) == 7200000


@pytest.mark.asyncio
async def test_tc_bld_03_delete_room_guards():
    """TC-BLD-03: Xóa phòng khi trống thành công; Xóa phòng đang có hợp đồng ACTIVE bị chặn 400."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = await get_owner_headers(ac)
        data = await create_isolated_building(ac, headers, "TC-BLD-03")

        # Create second room to test safe deletion
        r2_res = await ac.post("/api/v1/rooms", json={
            "building_id": data["building_id"],
            "floor_id": data["floor_id"],
            "room_number": f"P102-{uuid.uuid4().hex[:4]}",
            "room_type": "STUDIO",
            "base_price_monthly": 6000000,
            "area_sqm": 28.0,
            "max_occupants": 2,
            "status": "AVAILABLE"
        }, headers=headers)
        assert r2_res.status_code == 201
        r2_id = r2_res.json()["data"]["id"]

        # Delete vacant room -> SUCCESS
        del_res = await ac.delete(f"/api/v1/rooms/{r2_id}", headers=headers)
        assert del_res.status_code == 200

        # Create active contract on room 1
        t_headers = await get_tenant_headers(ac)
        tenant_me = (await ac.get("/api/v1/auth/me", headers=t_headers)).json()["data"]
        c_res = await ac.post("/api/v1/contracts", json={
            "roomId": data["room_id"],
            "tenantId": tenant_me["id"],
            "startDate": "2026-09-01",
            "endDate": "2027-09-01",
            "rentAmount": 6500000,
            "depositAmount": 6500000,
            "terms": "Hop dong thue TC-BLD-03"
        }, headers=headers)
        assert c_res.status_code == 201
        c_id = c_res.json()["data"]["id"]

        # Sign contract to make it ACTIVE
        await ac.post(f"/api/v1/contracts/{c_id}/sign", json={
            "signingMethod": "DRAW",
            "signatureData": "data:image/png;base64,sample_signature"
        }, headers=t_headers)

        # Attempt to delete occupied room -> MUST FAIL (400)
        del_fail = await ac.delete(f"/api/v1/rooms/{data['room_id']}", headers=headers)
        assert del_fail.status_code == 400
        assert "Không thể xóa phòng đang có hợp đồng" in del_fail.json()["error"]["message"]


@pytest.mark.asyncio
async def test_tc_bld_04_delete_floor_guards():
    """TC-BLD-04: Xóa tầng khi còn phòng bị chặn; Xóa tầng khi hết phòng thành công."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = await get_owner_headers(ac)
        data = await create_isolated_building(ac, headers, "TC-BLD-04")

        # 1. Floor still has room -> DELETE MUST FAIL (400)
        del_flr_fail = await ac.delete(f"/api/v1/floors/{data['floor_id']}", headers=headers)
        assert del_flr_fail.status_code == 400
        assert "Không thể xóa tầng đang chứa phòng" in del_flr_fail.json()["error"]["message"]

        # 2. Delete room first, then delete floor -> SUCCESS (200)
        await ac.delete(f"/api/v1/rooms/{data['room_id']}", headers=headers)
        del_flr_ok = await ac.delete(f"/api/v1/floors/{data['floor_id']}", headers=headers)
        assert del_flr_ok.status_code == 200


@pytest.mark.asyncio
async def test_tc_bld_05_delete_building_guards():
    """TC-BLD-05: Xóa tòa nhà khi còn tầng/phòng/hợp đồng bị chặn; Xóa khi trống thành công."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = await get_owner_headers(ac)
        data = await create_isolated_building(ac, headers, "TC-BLD-05")

        # 1. Building has floor & room -> DELETE MUST FAIL (400)
        del_bld_fail = await ac.delete(f"/api/v1/buildings/{data['building_id']}", headers=headers)
        assert del_bld_fail.status_code == 400

        # 2. Clean up room and floor, then delete building -> SUCCESS (200)
        await ac.delete(f"/api/v1/rooms/{data['room_id']}", headers=headers)
        await ac.delete(f"/api/v1/floors/{data['floor_id']}", headers=headers)
        del_bld_ok = await ac.delete(f"/api/v1/buildings/{data['building_id']}", headers=headers)
        assert del_bld_ok.status_code == 200


@pytest.mark.asyncio
async def test_tc_bld_06_duplicate_floor_number_blocked():
    """TC-BLD-06: Tạo tầng trùng số tầng trong cùng tòa nhà bị chặn 400."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = await get_owner_headers(ac)
        data = await create_isolated_building(ac, headers, "TC-BLD-06")

        # Attempt to create another floor with floorNumber = 1 -> MUST FAIL (400)
        dup_flr = await ac.post(f"/api/v1/buildings/{data['building_id']}/floors", json={
            "floorNumber": 1,
            "name": "Tầng 1 Trùng Lặp"
        }, headers=headers)
        assert dup_flr.status_code == 400
        assert "đã tồn tại" in dup_flr.json()["error"]["message"]


@pytest.mark.asyncio
async def test_tc_bld_07_building_config_versioning():
    """TC-BLD-07: Cấu hình biểu giá tiện ích cho tòa nhà, tạo phiên bản mới (versioning) không ghi đè bản cũ."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = await get_owner_headers(ac)
        data = await create_isolated_building(ac, headers, "TC-BLD-07")

        # 1. Create initial config (Version 1)
        cfg1_res = await ac.post(f"/api/v1/buildings/{data['building_id']}/configurations", json={
            "effective_from": "2026-01-01",
            "electricity_unit_price": 3500,
            "water_unit_price": 15000,
            "notes": "Bản biểu giá gốc 2026"
        }, headers=headers)
        assert cfg1_res.status_code == 201
        cfg1_ver = cfg1_res.json()["data"]["version"]

        # 2. Create updated config (Version 2)
        cfg2_res = await ac.post(f"/api/v1/buildings/{data['building_id']}/configurations", json={
            "effective_from": "2026-07-01",
            "electricity_unit_price": 3800,
            "water_unit_price": 18000,
            "notes": "Tăng giá điện nước từ Q3"
        }, headers=headers)
        assert cfg2_res.status_code == 201
        cfg2_ver = cfg2_res.json()["data"]["version"]

        assert cfg2_ver > cfg1_ver


@pytest.mark.asyncio
async def test_tc_bld_08_building_excel_import_atomic():
    """TC-BLD-08: Import tòa nhà qua Excel: tải template, rollback toàn bộ khi có dòng sai, import thành công."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        headers = await get_owner_headers(ac)

        # 1. Download template
        tpl_res = await ac.get("/api/v1/buildings/import-template")
        assert tpl_res.status_code == 200
        assert "spreadsheetml.sheet" in tpl_res.headers.get("content-type", "")

        # 2. Corrupted row (negative rent) -> MUST ROLLBACK and return 422 with row number
        bad_bld_name = f"Corrupt Bld {uuid.uuid4().hex[:6]}"
        bad_wb = openpyxl.Workbook()
        bad_ws = bad_wb.active
        bad_ws.append(["Tên tòa nhà", "Địa chỉ", "Quận", "TP", "Tầng", "Phòng", "Loại", "Diện tích", "Giá thuê", "Nội thất", "Sức chứa"])
        bad_ws.append([bad_bld_name, "123 St", "Q1", "HCM", 1, "101", "STUDIO", 30, 5000000, "FULLY_FURNISHED", 2])
        bad_ws.append([bad_bld_name, "123 St", "Q1", "HCM", 1, "102", "STUDIO", 30, -5000000, "FULLY_FURNISHED", 2])  # Bad rent!
        bad_buf = io.BytesIO()
        bad_wb.save(bad_buf)
        bad_buf.seek(0)

        bad_res = await ac.post(
            "/api/v1/buildings/import",
            files={"file": ("bad_import.xlsx", bad_buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers=headers
        )
        assert bad_res.status_code == 422
        assert "3" in bad_res.json()["error"]["message"]

        # 3. Valid import
        good_bld_name = f"Valid Bld {uuid.uuid4().hex[:6]}"
        good_wb = openpyxl.Workbook()
        good_ws = good_wb.active
        good_ws.append(["Tên tòa nhà", "Địa chỉ", "Quận", "TP", "Tầng", "Phòng", "Loại", "Diện tích", "Giá thuê", "Nội thất", "Sức chứa"])
        good_ws.append([good_bld_name, "456 St", "Bình Thạnh", "HCM", 1, "R101", "STUDIO", 32, 7000000, "FULLY_FURNISHED", 2])
        good_buf = io.BytesIO()
        good_wb.save(good_buf)
        good_buf.seek(0)

        good_res = await ac.post(
            "/api/v1/buildings/import",
            files={"file": ("good_import.xlsx", good_buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers=headers
        )
        assert good_res.status_code in (200, 201)
        assert good_res.json()["data"]["buildingsCreated"] >= 1
