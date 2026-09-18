from typing import Optional, List
from pydantic import BaseModel, Field


class CreateServiceRequest(BaseModel):
    companyId: str
    name: str
    slug: str
    description: Optional[str] = None
    category: str
    priceType: str = "FIXED"
    basePrice: float = 0.0
    imageUrl: Optional[str] = None


class SubmitServiceRequestInput(BaseModel):
    serviceId: str
    title: str
    description: str
    preferredDate: Optional[str] = None
    urgency: str = "MEDIUM"
    roomId: Optional[str] = None


class ReviewServiceRequestInput(BaseModel):
    action: str = Field(..., pattern="^(APPROVE|REJECT)$")
    rejectionReason: Optional[str] = None
    estimatedCost: Optional[float] = None


class AssignStaffInput(BaseModel):
    staffId: str
    estimatedCost: Optional[float] = None
    notes: Optional[str] = None


class SubmitProviderReviewInput(BaseModel):
    serviceRequestId: str
    rating: int = Field(..., ge=1, le=5)
    punctualityRating: Optional[int] = Field(None, ge=1, le=5)
    qualityRating: Optional[int] = Field(None, ge=1, le=5)
    comment: Optional[str] = None
    tags: Optional[List[str]] = None
