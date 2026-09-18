from typing import Optional
from pydantic import BaseModel, Field


class CreateLeadInput(BaseModel):
    fullName: str
    phone: str
    email: Optional[str] = None
    companyId: Optional[str] = None
    source: str = "WEBSITE"
    budgetMin: Optional[float] = None
    budgetMax: Optional[float] = None
    preferredRoomType: Optional[str] = None
    moveInDate: Optional[str] = None
    notes: Optional[str] = None
    assignedStaffId: Optional[str] = None


class UpdateLeadInput(BaseModel):
    fullName: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = None
    budgetMin: Optional[float] = None
    budgetMax: Optional[float] = None
    preferredRoomType: Optional[str] = None
    moveInDate: Optional[str] = None
    notes: Optional[str] = None
    assignedStaffId: Optional[str] = None


class ScheduleTourInput(BaseModel):
    leadId: str
    roomId: str
    scheduledAt: str
    hostStaffId: Optional[str] = None


class CompleteTourInput(BaseModel):
    status: str
    feedback: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5)


class ConvertLeadInput(BaseModel):
    roomId: str
    intendedStartDate: str
    leaseDurationMonths: int = 12
    occupantsCount: int = 1
    notes: Optional[str] = None
