from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class QuickActionRequest(BaseModel):
    actionType: str
    payload: Dict[str, Any] = {}


class AiTriageRequest(BaseModel):
    description: str
    categoryHint: Optional[str] = None


class AiTriageResponse(BaseModel):
    category: str
    urgency: str
    possibleIssues: List[str] = []
    suggestedChecks: List[str] = []
    recommendedService: Optional[Dict[str, Any]] = None
