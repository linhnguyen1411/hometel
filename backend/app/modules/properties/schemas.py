from typing import Optional, List
from datetime import date
from pydantic import BaseModel, Field


class FloorDto(BaseModel):
    id: str
    floorNumber: int
    name: str
    description: Optional[str] = None


class BuildingDto(BaseModel):
    id: str
    companyId: str
    name: str
    slug: str
    description: Optional[str] = None
    address: str
    city: str
    district: Optional[str] = None
    ward: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    imageUrl: Optional[str] = None
    status: str
    floors: Optional[List[FloorDto]] = None


class RoomDto(BaseModel):
    id: str
    companyId: str
    buildingId: str
    floorId: str
    roomNumber: str
    slug: str
    roomType: str
    area: float
    baseRent: float
    capacity: int
    status: str
    furnishing: str
    description: Optional[str] = None
    amenities: List[str] = []
    images: List[str] = []
    buildingName: Optional[str] = None
    buildingAddress: Optional[str] = None
    floorNumber: Optional[int] = None


class CreateBuildingRequest(BaseModel):
    companyId: str
    name: str
    slug: str
    address: str
    city: str = "Da Nang"
    district: Optional[str] = None
    ward: Optional[str] = None
    description: Optional[str] = None
    imageUrl: Optional[str] = None


class CreateRoomRequest(BaseModel):
    buildingId: str
    floorId: str
    roomNumber: str
    roomType: str = "STUDIO"
    area: float
    baseRent: float
    capacity: int = 2
    furnishing: str = "FULLY_FURNISHED"
    description: Optional[str] = None
    amenities: List[str] = []
    images: List[str] = []
