import uuid
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Integer, Float, ForeignKey, Text, Boolean, DateTime, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin



class RentalApplication(Base, TimestampMixin):
    __tablename__ = "rental_applications"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"app_{uuid.uuid4().hex[:12]}")
    room_id: Mapped[str] = mapped_column(String(50), ForeignKey("rooms.id", ondelete="CASCADE"), index=True, nullable=False)
    applicant_id: Mapped[str] = mapped_column(String(50), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="PENDING", index=True, nullable=False)
    intended_start_date: Mapped[str] = mapped_column(String(30), nullable=False)
    lease_duration_months: Mapped[int] = mapped_column(Integer, default=12, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    room: Mapped["Room"] = relationship("Room", foreign_keys=[room_id])
    applicant: Mapped["User"] = relationship("User", foreign_keys=[applicant_id])


class RentalContract(Base, TimestampMixin):
    __tablename__ = "rental_contracts"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"cnt_{uuid.uuid4().hex[:12]}")
    contract_number: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    room_id: Mapped[str] = mapped_column(String(50), ForeignKey("rooms.id", ondelete="RESTRICT"), index=True, nullable=False)
    tenant_id: Mapped[str] = mapped_column(String(50), ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False)
    company_id: Mapped[str] = mapped_column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), index=True, nullable=False)
    start_date: Mapped[str] = mapped_column(String(30), nullable=False)
    end_date: Mapped[str] = mapped_column(String(30), nullable=False)
    rent_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    deposit_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    payment_day_of_month: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="DRAFT", index=True, nullable=False)
    signed_at: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    signature_hash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    terms: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    room: Mapped["Room"] = relationship("Room", foreign_keys=[room_id])
    tenant: Mapped["User"] = relationship("User", foreign_keys=[tenant_id])
    company: Mapped["Company"] = relationship("Company", foreign_keys=[company_id])
    signatures: Mapped[List["ContractESignature"]] = relationship("ContractESignature", back_populates="contract", cascade="all, delete-orphan")


class ContractESignature(Base, TimestampMixin):
    __tablename__ = "contract_e_signatures"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"sig_{uuid.uuid4().hex[:12]}")
    contract_id: Mapped[str] = mapped_column(String(50), ForeignKey("rental_contracts.id", ondelete="CASCADE"), index=True, nullable=False)
    tenant_id: Mapped[str] = mapped_column(String(50), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    method: Mapped[str] = mapped_column(String(30), nullable=False)  # DRAW or OTP
    signature_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    evidence_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    certificate_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    signed_at: Mapped[str] = mapped_column(String(50), nullable=False)

    contract: Mapped["RentalContract"] = relationship("RentalContract", back_populates="signatures")


class OtpVerification(Base, TimestampMixin):
    __tablename__ = "otp_verifications"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"otp_{uuid.uuid4().hex[:12]}")
    contract_id: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    tenant_id: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    otp_code: Mapped[str] = mapped_column(String(10), nullable=False)
    expires_at: Mapped[str] = mapped_column(String(50), nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
