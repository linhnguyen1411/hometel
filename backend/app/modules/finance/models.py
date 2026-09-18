import uuid
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Float, ForeignKey, Text, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin



class BuildingExpense(Base, TimestampMixin):
    __tablename__ = "building_expenses"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: f"exp_{uuid.uuid4().hex[:12]}")
    building_id: Mapped[str] = mapped_column(String(50), ForeignKey("buildings.id", ondelete="CASCADE"), index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    expense_date: Mapped[str] = mapped_column(String(30), nullable=False)
    period_month: Mapped[str] = mapped_column(String(10), index=True, nullable=False)
    vendor_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    receipt_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    building: Mapped["Building"] = relationship("Building", foreign_keys=[building_id])
    creator: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by])
