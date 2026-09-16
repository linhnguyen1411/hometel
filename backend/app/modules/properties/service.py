from typing import List, Optional
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from .models import Building, Floor, Room, BuildingConfiguration
from .schemas import BuildingDto, RoomDto, FloorDto, CreateBuildingRequest, CreateRoomRequest


class PropertyService:
    @classmethod
    async def list_buildings(
        cls,
        session: AsyncSession,
        company_id: Optional[str] = None,
        status_filter: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[BuildingDto]:
        stmt = select(Building).options(selectinload(Building.floors))
        conditions = []

        if company_id:
            conditions.append(Building.company_id == company_id)
        if status_filter:
            conditions.append(Building.status == status_filter)
        if search:
            conditions.append(Building.name.ilike(f"%{search}%") | Building.address.ilike(f"%{search}%"))

        if conditions:
            stmt = stmt.where(and_(*conditions))

        stmt = stmt.order_by(Building.created_at.desc()).limit(limit).offset(offset)
        result = await session.execute(stmt)
        buildings = result.scalars().all()

        return [
            BuildingDto(
                id=b.id,
                companyId=b.company_id,
                name=b.name,
                slug=b.slug,
                description=b.description,
                address=b.address,
                city=b.city,
                district=b.district,
                ward=b.ward,
                latitude=b.latitude,
                longitude=b.longitude,
                imageUrl=b.image_url,
                status=b.status,
                floors=[
                    FloorDto(
                        id=f.id,
                        floorNumber=f.floor_number,
                        name=f.name,
                        description=f.description,
                    )
                    for f in b.floors
                ],
            )
            for b in buildings
        ]

    @classmethod
    async def list_rooms(
        cls,
        session: AsyncSession,
        building_id: Optional[str] = None,
        status_filter: Optional[str] = None,
        room_type: Optional[str] = None,
        max_price: Optional[float] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[RoomDto]:
        stmt = (
            select(Room)
            .options(selectinload(Room.building), selectinload(Room.floor))
        )
        conditions = []

        if building_id:
            conditions.append(Room.building_id == building_id)
        if status_filter:
            conditions.append(Room.status == status_filter)
        if room_type:
            conditions.append(Room.room_type == room_type)
        if max_price is not None and max_price > 0:
            conditions.append(Room.base_rent <= max_price)
        if search:
            conditions.append(
                Room.room_number.ilike(f"%{search}%") | Room.description.ilike(f"%{search}%")
            )

        if conditions:
            stmt = stmt.where(and_(*conditions))

        stmt = stmt.order_by(Room.created_at.desc()).limit(limit).offset(offset)
        result = await session.execute(stmt)
        rooms = result.scalars().all()

        return [
            RoomDto(
                id=r.id,
                companyId=r.company_id,
                buildingId=r.building_id,
                floorId=r.floor_id,
                roomNumber=r.room_number,
                slug=r.slug,
                roomType=r.room_type,
                area=float(r.area),
                baseRent=float(r.base_rent),
                capacity=r.capacity,
                status=r.status,
                furnishing=r.furnishing,
                description=r.description,
                amenities=r.amenities or [],
                images=r.images or [],
                buildingName=r.building.name if r.building else None,
                buildingAddress=r.building.address if r.building else None,
                floorNumber=r.floor.floor_number if r.floor else None,
            )
            for r in rooms
        ]

    @classmethod
    async def get_room_by_id(cls, session: AsyncSession, room_id: str) -> Optional[RoomDto]:
        stmt = (
            select(Room)
            .options(selectinload(Room.building), selectinload(Room.floor))
            .where(Room.id == room_id)
        )
        result = await session.execute(stmt)
        r = result.scalar_one_or_none()
        if not r:
            return None

        return RoomDto(
            id=r.id,
            companyId=r.company_id,
            buildingId=r.building_id,
            floorId=r.floor_id,
            roomNumber=r.room_number,
            slug=r.slug,
            roomType=r.room_type,
            area=float(r.area),
            baseRent=float(r.base_rent),
            capacity=r.capacity,
            status=r.status,
            furnishing=r.furnishing,
            description=r.description,
            amenities=r.amenities or [],
            images=r.images or [],
            buildingName=r.building.name if r.building else None,
            buildingAddress=r.building.address if r.building else None,
            floorNumber=r.floor.floor_number if r.floor else None,
        )
