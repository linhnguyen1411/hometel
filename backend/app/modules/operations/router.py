from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, get_optional_user, TokenPayload
from app.common.response import success_response, error_response
from .schemas import AiTriageRequest, QuickActionRequest
from .service import OperationsService

router = APIRouter(prefix="/operations", tags=["Operations & Smart Cockpit"])


@router.post("/ai-triage", summary="Chẩn đoán thông minh sự cố kỹ thuật (AI Triage)")
async def ai_triage(data: AiTriageRequest):
    if not data.description or not data.description.strip():
        return error_response(code="INVALID_PAYLOAD", message="Mô tả sự cố không được để trống", status_code=400)

    result = OperationsService.ai_triage(data.description, data.categoryHint)
    return success_response(result.model_dump())
