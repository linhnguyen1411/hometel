import uuid
from decimal import Decimal
from typing import Optional, List
from datetime import datetime
from sqlalchemy import String, Integer, Float, ForeignKey, Text, Boolean, DateTime, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin


class Service(Base, TimestampMixin):
    __tablename__ = "services"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"srv_{uuid.uuid4().hex[:12]}")
    company_id: Mapped[str] = mapped_column(String(50), ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(220), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    price_type: Mapped[str] = mapped_column(String(30), default="FIXED", nullable=False)
    base_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False)

    # Relationships
    company: Mapped["Company"] = relationship("Company", foreign_keys=[company_id])
    requests: Mapped[List["ServiceRequest"]] = relationship("ServiceRequest", back_populates="service", cascade="all, delete-orphan")


class ServiceRequest(Base, TimestampMixin):
    __tablename__ = "service_requests"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"sr_{uuid.uuid4().hex[:12]}")
    service_id: Mapped[str] = mapped_column(String(50), ForeignKey("services.id", ondelete="RESTRICT"), index=True, nullable=False)
    provider_company_id: Mapped[str] = mapped_column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), index=True, nullable=False)
    tenant_id: Mapped[str] = mapped_column(String(50), ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False)
    room_id: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    preferred_date: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    urgency: Mapped[str] = mapped_column(String(30), default="MEDIUM", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="PENDING", index=True, nullable=False)
    estimated_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    final_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    service: Mapped["Service"] = relationship("Service", back_populates="requests")
    provider_company: Mapped["Company"] = relationship("Company", foreign_keys=[provider_company_id])
    tenant: Mapped["User"] = relationship("User", foreign_keys=[tenant_id])
    room: Mapped[Optional["Room"]] = relationship("Room", foreign_keys=[room_id])
    assignments: Mapped[List["ServiceAssignment"]] = relationship("ServiceAssignment", back_populates="service_request", cascade="all, delete-orphan")
    review: Mapped[Optional["ProviderReview"]] = relationship("ProviderReview", back_populates="service_request", uselist=False, cascade="all, delete-orphan")


class ServiceAssignment(Base, TimestampMixin):
    __tablename__ = "service_assignments"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"asg_{uuid.uuid4().hex[:12]}")
    service_request_id: Mapped[str] = mapped_column(String(50), ForeignKey("service_requests.id", ondelete="CASCADE"), index=True, nullable=False)
    staff_id: Mapped[str] = mapped_column(String(50), ForeignKey("users.id"), index=True, nullable=False)
    assigned_at: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="ASSIGNED", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    service_request: Mapped["ServiceRequest"] = relationship("ServiceRequest", back_populates="assignments")
    staff: Mapped["User"] = relationship("User", foreign_keys=[staff_id])


class ProviderReview(Base, TimestampMixin):
    __tablename__ = "provider_reviews"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"rev_{uuid.uuid4().hex[:12]}")
    service_request_id: Mapped[str] = mapped_column(String(50), ForeignKey("service_requests.id", ondelete="CASCADE"), unique=True, nullable=False)
    provider_company_id: Mapped[str] = mapped_column(String(50), ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False)
    tenant_id: Mapped[str] = mapped_column(String(50), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    punctuality_rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    quality_rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    service_request: Mapped["ServiceRequest"] = relationship("ServiceRequest", back_populates="review")
    tenant: Mapped["User"] = relationship("User", foreign_keys=[tenant_id])
    provider_company: Mapped["Company"] = relationship("Company", foreign_keys=[provider_company_id])
