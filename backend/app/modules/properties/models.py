import uuid
from typing import List, Optional
from datetime import date
from sqlalchemy import String, Numeric, Integer, Float, ForeignKey, Text, JSON, Date, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin


class Building(Base, TimestampMixin):
    __tablename__ = "buildings"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"bld_{uuid.uuid4().hex[:12]}")
    company_id: Mapped[str] = mapped_column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(220), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    city: Mapped[str] = mapped_column(String(100), default="Da Nang", nullable=False)
    district: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    ward: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False)

    # Relationships
    floors: Mapped[List["Floor"]] = relationship("Floor", back_populates="building", cascade="all, delete-orphan", order_by="Floor.floor_number")
    rooms: Mapped[List["Room"]] = relationship("Room", back_populates="building", cascade="all, delete-orphan")
    configurations: Mapped[List["BuildingConfiguration"]] = relationship("BuildingConfiguration", back_populates="building", cascade="all, delete-orphan")


class Floor(Base, TimestampMixin):
    __tablename__ = "floors"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"flr_{uuid.uuid4().hex[:12]}")
    building_id: Mapped[str] = mapped_column(String(50), ForeignKey("buildings.id", ondelete="CASCADE"), index=True, nullable=False)
    floor_number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (UniqueConstraint("building_id", "floor_number", name="uq_building_floor"),)

    building: Mapped["Building"] = relationship("Building", back_populates="floors")
    rooms: Mapped[List["Room"]] = relationship("Room", back_populates="floor", cascade="all, delete-orphan")


class Room(Base, TimestampMixin):
    __tablename__ = "rooms"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"rom_{uuid.uuid4().hex[:12]}")
    company_id: Mapped[str] = mapped_column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), index=True, nullable=False)
    building_id: Mapped[str] = mapped_column(String(50), ForeignKey("buildings.id", ondelete="CASCADE"), index=True, nullable=False)
    floor_id: Mapped[str] = mapped_column(String(50), ForeignKey("floors.id", ondelete="CASCADE"), index=True, nullable=False)
    room_number: Mapped[str] = mapped_column(String(50), nullable=False)
    slug: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    room_type: Mapped[str] = mapped_column(String(50), default="STUDIO", nullable=False)
    area: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)
    base_rent: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="AVAILABLE", index=True, nullable=False)
    furnishing: Mapped[str] = mapped_column(String(30), default="FULLY_FURNISHED", nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    amenities: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    images: Mapped[Optional[list]] = mapped_column(JSON, default=list)

    __table_args__ = (UniqueConstraint("building_id", "room_number", name="uq_building_room"),)

    building: Mapped["Building"] = relationship("Building", back_populates="rooms")
    floor: Mapped["Floor"] = relationship("Floor", back_populates="rooms")


class BuildingConfiguration(Base, TimestampMixin):
    __tablename__ = "building_configurations"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"cfg_{uuid.uuid4().hex[:12]}")
    building_id: Mapped[str] = mapped_column(String(50), ForeignKey("buildings.id", ondelete="CASCADE"), index=True, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Unit rates (VND)
    electricity_unit_price: Mapped[float] = mapped_column(Numeric(10, 2), default=3500, nullable=False)
    water_unit_price: Mapped[float] = mapped_column(Numeric(10, 2), default=15000, nullable=False)
    internet_price: Mapped[float] = mapped_column(Numeric(12, 2), default=100000, nullable=False)
    garbage_price: Mapped[float] = mapped_column(Numeric(12, 2), default=50000, nullable=False)
    parking_fee_motorbike: Mapped[float] = mapped_column(Numeric(12, 2), default=100000, nullable=False)
    parking_fee_car: Mapped[float] = mapped_column(Numeric(12, 2), default=800000, nullable=False)
    cleaning_fee: Mapped[float] = mapped_column(Numeric(12, 2), default=150000, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    building: Mapped["Building"] = relationship("Building", back_populates="configurations")
