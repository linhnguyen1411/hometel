import { Router } from 'express';
import { NotificationRepository } from '../db/repositories/notificationRepository.js';
import { sendSuccess, sendError } from '../utils/responseHelper.js';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { ZaloService } from '../services/zaloService.js';

export const notificationRouter = Router();

// GET /api/v1/notifications
notificationRouter.get('/', authenticate, (req: AuthenticatedRequest, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const notifications = NotificationRepository.findByUser(req.user!.userId, limit);
  const unreadCount = NotificationRepository.getUnreadCount(req.user!.userId);

  return sendSuccess(res, {
    notifications,
    unreadCount
  });
});

// POST /api/v1/notifications/:id/read
notificationRouter.post('/:id/read', authenticate, (req: AuthenticatedRequest, res) => {
  const updated = NotificationRepository.markAsRead(req.params.id, req.user!.userId);
  return sendSuccess(res, { success: updated });
});

// POST /api/v1/notifications/read-all
notificationRouter.post('/read-all', authenticate, (req: AuthenticatedRequest, res) => {
  const count = NotificationRepository.markAllAsRead(req.user!.userId);
  return sendSuccess(res, { markedCount: count });
});

// POST /api/v1/notifications/send-zalo (Owner, Staff, Super Admin can send Zalo notification)
notificationRouter.post('/send-zalo', authenticate, requireRole('OWNER', 'STAFF', 'SUPER_ADMIN'), async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, type, title, message, entityType, entityId, extraData } = req.body;
    if (!userId || !title || !message) {
      return sendError(res, 'VALIDATION_ERROR', 'userId, title, and message are required', 400);
    }

    const notif = await ZaloService.sendZns(
      userId,
      type || 'CUSTOM',
      title,
      message,
      entityType,
      entityId,
      extraData
    );

    return sendSuccess(res, notif, 201);
  } catch (error: any) {
    return sendError(res, 'SEND_ZALO_FAILED', error.message, 500);
  }
});

