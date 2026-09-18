import uuid
from typing import Optional
from sqlalchemy import String, Integer, Float, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin


class Lead(Base, TimestampMixin):
    __tablename__ = "leads"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"lead_{uuid.uuid4().hex[:12]}")
    company_id: Mapped[str] = mapped_column(String(50), ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str] = mapped_column(String(30), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    source: Mapped[str] = mapped_column(String(50), default="WEBSITE", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="NEW", index=True, nullable=False)
    budget_min: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    budget_max: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    preferred_room_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    move_in_date: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assigned_staff_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    company: Mapped["Company"] = relationship("Company", foreign_keys=[company_id])
    assigned_staff: Mapped[Optional["User"]] = relationship("User", foreign_keys=[assigned_staff_id])


class Tour(Base, TimestampMixin):
    __tablename__ = "tours"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"tour_{uuid.uuid4().hex[:12]}")
    company_id: Mapped[str] = mapped_column(String(50), ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False)
    lead_id: Mapped[str] = mapped_column(String(50), ForeignKey("leads.id", ondelete="CASCADE"), index=True, nullable=False)
    room_id: Mapped[str] = mapped_column(String(50), ForeignKey("rooms.id", ondelete="CASCADE"), index=True, nullable=False)
    host_staff_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    scheduled_at: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="SCHEDULED", index=True, nullable=False)
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    lead: Mapped["Lead"] = relationship("Lead", foreign_keys=[lead_id])
    room: Mapped["Room"] = relationship("Room", foreign_keys=[room_id])
    host_staff: Mapped[Optional["User"]] = relationship("User", foreign_keys=[host_staff_id])
