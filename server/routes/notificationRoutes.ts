import { Router } from 'express';
import { NotificationRepository } from '../db/repositories/notificationRepository.js';
import { sendSuccess } from '../utils/responseHelper.js';
import { authenticate, AuthenticatedRequest } from '../middleware/authMiddleware.js';

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
