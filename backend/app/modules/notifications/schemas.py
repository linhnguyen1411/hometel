from typing import Optional, Dict, Any
from pydantic import BaseModel


class PushKeys(BaseModel):
    p256dh: Optional[str] = None
    auth: Optional[str] = None


class PushSubscribeInput(BaseModel):
    endpoint: str
    keys: Optional[PushKeys] = None
    userAgent: Optional[str] = None


class PushUnsubscribeInput(BaseModel):
    endpoint: str


class SendZaloInput(BaseModel):
    userId: str
    type: Optional[str] = "CUSTOM"
    title: str
    message: str
    entityType: Optional[str] = None
    entityId: Optional[str] = None
    extraData: Optional[Dict[str, Any]] = None
