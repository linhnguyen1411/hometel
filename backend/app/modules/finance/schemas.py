from typing import Optional
from pydantic import BaseModel, Field


class RecordExpenseInput(BaseModel):
    buildingId: str
    category: str
    description: str
    amount: float = Field(..., gt=0)
    expenseDate: Optional[str] = None
    periodMonth: Optional[str] = None
    vendorName: Optional[str] = None
    receiptUrl: Optional[str] = None
