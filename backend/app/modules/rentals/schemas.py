from typing import Optional, List
from pydantic import BaseModel, Field


class CreateRentalApplicationRequest(BaseModel):
    roomId: str
    intendedStartDate: str
    leaseDurationMonths: int = 12
    notes: Optional[str] = None


class ReviewRentalApplicationRequest(BaseModel):
    action: Optional[str] = None
    decision: Optional[str] = None
    rejectionReason: Optional[str] = None
    reviewNotes: Optional[str] = None


class CreateContractRequest(BaseModel):
    roomId: str
    tenantId: str
    companyId: Optional[str] = None
    startDate: str
    endDate: str
    rentAmount: float
    depositAmount: float = 0.0
    paymentDayOfMonth: int = 5
    terms: Optional[str] = None


class SignContractRequest(BaseModel):
    method: Optional[str] = None
    signingMethod: Optional[str] = None
    signatureData: Optional[str] = None
    otpCode: Optional[str] = None
