import uuid
from decimal import Decimal
from typing import Optional, List
from datetime import datetime
from sqlalchemy import String, Integer, Float, ForeignKey, Text, Boolean, DateTime, Numeric, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

from app.core.database import Base, TimestampMixin


class Meter(Base, TimestampMixin):
    __tablename__ = "meters"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"mtr_{uuid.uuid4().hex[:12]}")
    room_id: Mapped[str] = mapped_column(String(50), ForeignKey("rooms.id", ondelete="CASCADE"), index=True, nullable=False)
    type: Mapped[str] = mapped_column(String(30), nullable=False)  # ELECTRICITY or WATER
    serial_number: Mapped[str] = mapped_column(String(100), nullable=False)
    initial_reading: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=Decimal("0.000"), nullable=False)
    current_reading: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=Decimal("0.000"), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE", nullable=False)

    meter_type = synonym("type")
    last_reading = synonym("current_reading")

    # Relationships
    room: Mapped["Room"] = relationship("Room", foreign_keys=[room_id])
    readings: Mapped[List["MeterReading"]] = relationship("MeterReading", back_populates="meter", cascade="all, delete-orphan")


class MeterReading(Base, TimestampMixin):
    __tablename__ = "meter_readings"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"rdg_{uuid.uuid4().hex[:12]}")
    meter_id: Mapped[str] = mapped_column(String(50), ForeignKey("meters.id", ondelete="CASCADE"), index=True, nullable=False)
    previous_reading: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    reading_value: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    consumption: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    reading_date: Mapped[str] = mapped_column(String(30), nullable=False)
    recorded_by: Mapped[str] = mapped_column(String(50), ForeignKey("users.id"), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    ocr_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ocr_raw_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    meter: Mapped["Meter"] = relationship("Meter", back_populates="readings")


class Invoice(Base, TimestampMixin):
    __tablename__ = "invoices"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"inv_{uuid.uuid4().hex[:12]}")
    invoice_number: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    tenant_id: Mapped[str] = mapped_column(String(50), ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False)
    contract_id: Mapped[str] = mapped_column(String(50), ForeignKey("rental_contracts.id", ondelete="RESTRICT"), index=True, nullable=False)
    company_id: Mapped[str] = mapped_column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), index=True, nullable=False)
    room_id: Mapped[str] = mapped_column(String(50), ForeignKey("rooms.id", ondelete="RESTRICT"), index=True, nullable=False)
    issue_date: Mapped[str] = mapped_column(String(30), nullable=False)
    due_date: Mapped[str] = mapped_column(String(30), nullable=False)
    billing_month: Mapped[str] = mapped_column(String(20), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    discount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    tax: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    outstanding_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="ISSUED", index=True, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("contract_id", "billing_month", name="uq_invoice_contract_period"),
    )

    period_month = synonym("billing_month")
    total_amount = synonym("total")

    items: Mapped[List["InvoiceItem"]] = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    payments: Mapped[List["Payment"]] = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(Base, TimestampMixin):
    __tablename__ = "invoice_items"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"item_{uuid.uuid4().hex[:12]}")
    invoice_id: Mapped[str] = mapped_column(String(50), ForeignKey("invoices.id", ondelete="CASCADE"), index=True, nullable=False)
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), default=Decimal("1.000"), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    item_type = synonym("type")

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="items")


class Payment(Base, TimestampMixin):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"pay_{uuid.uuid4().hex[:12]}")
    invoice_id: Mapped[str] = mapped_column(String(50), ForeignKey("invoices.id", ondelete="RESTRICT"), index=True, nullable=False)
    tenant_id: Mapped[str] = mapped_column(String(50), ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False)
    company_id: Mapped[str] = mapped_column(String(50), ForeignKey("companies.id", ondelete="RESTRICT"), index=True, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    method: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="SUCCESS", nullable=False)
    transaction_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    paid_at: Mapped[str] = mapped_column(String(50), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("transaction_reference", name="uq_payment_reference"),
        CheckConstraint("amount > 0", name="chk_payment_positive_amount"),
    )

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="payments")

