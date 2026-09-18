import uuid
from httpx import AsyncClient


async def get_login_headers(ac: AsyncClient, email: str, password: str) -> dict:
    """Login and return authorization headers with Bearer token."""
    res = await ac.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    token = res.json()["data"]["accessToken"]
    return {"Authorization": f"Bearer {token}"}


async def get_owner_headers(ac: AsyncClient) -> dict:
    return await get_login_headers(ac, "owner@homtel.vn", "Owner@123")


async def get_staff_headers(ac: AsyncClient) -> dict:
    return await get_login_headers(ac, "staff@homtel.vn", "Staff@123")


async def get_tenant_headers(ac: AsyncClient) -> dict:
    return await get_login_headers(ac, "tenant@homtel.vn", "Tenant@123")


async def get_provider_headers(ac: AsyncClient) -> dict:
    return await get_login_headers(ac, "provider@homtel.vn", "Provider@123")


async def get_admin_headers(ac: AsyncClient) -> dict:
    return await get_login_headers(ac, "admin@homtel.vn", "Admin@123")


async def create_isolated_building(ac: AsyncClient, headers: dict, name_prefix: str = "Test Bld") -> dict:
    """Helper to create a dedicated building, floor, and room for test isolation."""
    unique_id = uuid.uuid4().hex[:6]
    bld_name = f"{name_prefix} {unique_id}"
    b_res = await ac.post("/api/v1/buildings", json={
        "name": bld_name,
        "address": f"{unique_id} Le Duan St, Ward 1",
        "city": "Hồ Chí Minh",
        "district": "Quận 1",
        "total_floors": 3
    }, headers=headers)
    assert b_res.status_code == 201, f"Create building failed: {b_res.text}"
    bld_id = b_res.json()["data"]["id"]

    f_res = await ac.post(f"/api/v1/buildings/{bld_id}/floors", json={
        "floorNumber": 1,
        "name": "Tầng 1"
    }, headers=headers)
    assert f_res.status_code == 201, f"Create floor failed: {f_res.text}"
    floor_id = f_res.json()["data"]["id"]

    r_res = await ac.post("/api/v1/rooms", json={
        "building_id": bld_id,
        "floor_id": floor_id,
        "room_number": f"P101-{unique_id}",
        "room_type": "STUDIO",
        "base_price_monthly": 6500000,
        "area_sqm": 30.0,
        "max_occupants": 2,
        "status": "AVAILABLE"
    }, headers=headers)
    assert r_res.status_code == 201, f"Create room failed: {r_res.text}"
    room_id = r_res.json()["data"]["id"]

    return {
        "building_id": bld_id,
        "building_name": bld_name,
        "floor_id": floor_id,
        "room_id": room_id,
        "room_number": f"P101-{unique_id}",
    }
