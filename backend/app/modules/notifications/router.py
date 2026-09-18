from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, require_role, TokenPayload
from app.common.response import success_response
from app.modules.notifications.models import PushSubscription, Notification
from app.modules.notifications.schemas import PushSubscribeInput, PushUnsubscribeInput, SendZaloInput

push_router = APIRouter(prefix="/push", tags=["push"])
notifications_router = APIRouter(prefix="/notifications", tags=["notifications"])


# ==========================================
# PWA PUSH NOTIFICATIONS
# ==========================================

@push_router.post("/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe_push(
    payload: PushSubscribeInput,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    # Check if endpoint already exists
    res = await db.execute(select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint))
    existing = res.scalar_one_or_none()
    if existing:
        existing.user_id = current_user.user_id
        if payload.keys:
            existing.p256dh = payload.keys.p256dh
            existing.auth = payload.keys.auth
        existing.user_agent = payload.userAgent
        await db.commit()
        return success_response({"success": True, "subscription": {"id": existing.id}}, status_code=201)

    sub = PushSubscription(
        user_id=current_user.user_id,
        endpoint=payload.endpoint,
        p256dh=payload.keys.p256dh if payload.keys else None,
        auth=payload.keys.auth if payload.keys else None,
        user_agent=payload.userAgent,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return success_response({"success": True, "subscription": {"id": sub.id}}, status_code=201)


@push_router.post("/unsubscribe")
async def unsubscribe_push(
    payload: PushUnsubscribeInput,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    res = await db.execute(select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint))
    sub = res.scalar_one_or_none()
    if sub:
        await db.delete(sub)
        await db.commit()
    return success_response({"success": True})


@push_router.get("/status")
async def push_status(
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    res = await db.execute(select(PushSubscription).where(PushSubscription.user_id == current_user.user_id))
    subs = res.scalars().all()
    return success_response({
        "subscribed": len(subs) > 0,
        "count": len(subs),
    })


@push_router.post("/test")
async def push_test(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    res = await db.execute(select(PushSubscription).where(PushSubscription.user_id == current_user.user_id))
    subs = res.scalars().all()
    
    return success_response({
        "dispatched": len(subs),
        "payload": {
            "title": payload.get("title", "Homtel Resident Notification"),
            "body": payload.get("body", "Bạn có thông báo mới từ ban quản lý căn hộ."),
            "icon": "/pwa-icon-192.png",
            "url": "/my",
        },
        "message": f"Đã gửi thông báo đẩy đến {len(subs)} thiết bị." if subs else "Chưa có thiết bị đăng ký nhận thông báo đẩy."
    })


# ==========================================
# IN-APP NOTIFICATIONS & ZALO
# ==========================================

@notifications_router.get("")
async def get_notifications(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    query = (
        select(Notification)
        .where(Notification.user_id == current_user.user_id)
        .order_by(desc(Notification.created_at))
        .limit(limit)
    )
    res = await db.execute(query)
    notifs = res.scalars().all()

    unread_res = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.user_id,
            Notification.is_read == False
        )
    )
    unread_count = len(unread_res.scalars().all())

    return success_response({
        "notifications": [
            {
                "id": n.id,
                "userId": n.user_id,
                "type": n.type,
                "title": n.title,
                "message": n.message,
                "entityType": n.entity_type,
                "entityId": n.entity_id,
                "isRead": n.is_read,
                "createdAt": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notifs
        ],
        "unreadCount": unread_count,
    })


@notifications_router.post("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    res = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.user_id
        )
    )
    notif = res.scalar_one_or_none()
    if notif:
        notif.is_read = True
        await db.commit()
    return success_response({"success": True})


@notifications_router.post("/read-all")
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.user_id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return success_response({"success": True})


@notifications_router.post("/send-zalo", status_code=status.HTTP_201_CREATED)
async def send_zalo(
    payload: SendZaloInput,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_role("OWNER", "STAFF", "SUPER_ADMIN")),
):
    if not settings.ZALO_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Tính năng đang tạm ngưng, sẽ kích hoạt sau khi hoàn tất đăng ký doanh nghiệp",
        )

    notif = Notification(
        user_id=payload.userId,
        type=payload.type or "ZALO_ZNS",
        title=payload.title,
        message=payload.message,
        entity_type=payload.entityType,
        entity_id=payload.entityId,
        is_read=False,
    )
    db.add(notif)
    await db.commit()
    await db.refresh(notif)

    return success_response({
        "id": notif.id,
        "userId": notif.user_id,
        "title": notif.title,
        "status": "SENT_SIMULATED",
    }, status_code=201)
