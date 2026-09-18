from typing import Optional, List
from pydantic import BaseModel, Field


class OcrScanRequest(BaseModel):
    meterId: str
    imageBase64OrUrl: str
    meterType: str = "ELECTRICITY"


class CommitOcrReadingRequest(BaseModel):
    readingValue: float
    readingDate: Optional[str] = None
    notes: Optional[str] = None
    imageUrl: Optional[str] = None
    ocrConfidence: Optional[float] = None
    ocrRawText: Optional[str] = None
    autoDraftInvoice: bool = False


class GenerateInvoiceRequest(BaseModel):
    contractId: str
    billingMonth: str
    dueDate: Optional[str] = None
    electricityReading: Optional[float] = None
    waterReading: Optional[float] = None
    serviceIds: List[str] = []


class RecordPaymentRequest(BaseModel):
    invoiceId: str
    amount: float
    method: str = "BANK_TRANSFER"
    transactionReference: Optional[str] = None
    notes: Optional[str] = None


class VietQrWebhookPayload(BaseModel):
    transactionId: str
    amount: float
    description: str
    referenceNumber: Optional[str] = None
    bankCode: Optional[str] = None
