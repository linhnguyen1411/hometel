from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_optional_user, require_role, TokenPayload
from app.common.response import success_response, error_response
from .service import PropertyService

router = APIRouter(tags=["Properties & Inventory"])


@router.get("/buildings", summary="Danh sách tòa nhà (Public & Filter)")
async def list_buildings(
    companyId: Optional[str] = Query(None),
    status: Optional[str] = Query("ACTIVE"),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * pageSize
    buildings = await PropertyService.list_buildings(
        db,
        company_id=companyId,
        status_filter=status,
        search=search,
        limit=pageSize,
        offset=offset,
    )
    return success_response(buildings)


@router.get("/rooms", summary="Danh sách phòng (Public Explorer & Filter)")
async def list_rooms(
    buildingId: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    roomType: Optional[str] = Query(None),
    maxPrice: Optional[float] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * pageSize
    rooms = await PropertyService.list_rooms(
        db,
        building_id=buildingId,
        status_filter=status,
        room_type=roomType,
        max_price=maxPrice,
        search=search,
        limit=pageSize,
        offset=offset,
    )
    return success_response(rooms)


@router.get("/rooms/{room_id}", summary="Chi tiết thông tin phòng")
async def get_room(room_id: str, db: AsyncSession = Depends(get_db)):
    room = await PropertyService.get_room_by_id(db, room_id)
    if not room:
        return error_response(code="ROOM_NOT_FOUND", message="Không tìm thấy phòng", status_code=404)
    return success_response(room)
