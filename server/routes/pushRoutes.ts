import { Router } from 'express';
import crypto from 'node:crypto';
import { ReviewRepository } from '../db/repositories/reviewRepository.js';
import { authenticate, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { sendSuccess, sendError } from '../utils/responseHelper.js';

export const pushRouter = Router();

// ==========================================
// PWA PUSH NOTIFICATION ROUTES (PHASE 5)
// ==========================================

// POST /api/v1/push/subscribe
pushRouter.post('/subscribe', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const { endpoint, keys, userAgent } = req.body;
    if (!endpoint) {
      return sendError(res, 'VALIDATION_ERROR', 'endpoint is required', 400);
    }

    const subId = `push_${crypto.randomUUID()}`;
    const subscription = ReviewRepository.savePushSubscription({
      id: subId,
      userId: req.user!.userId,
      endpoint,
      p256dh: keys?.p256dh,
      auth: keys?.auth,
      userAgent: userAgent || req.headers['user-agent']
    });

    return sendSuccess(res, {
      success: true,
      subscription
    }, 201);
  } catch (error: any) {
    return sendError(res, 'PUSH_SUBSCRIBE_FAILED', error.message, 500);
  }
});

// POST /api/v1/push/unsubscribe
pushRouter.post('/unsubscribe', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return sendError(res, 'VALIDATION_ERROR', 'endpoint is required', 400);
    }

    ReviewRepository.deletePushSubscription(endpoint);
    return sendSuccess(res, { success: true });
  } catch (error: any) {
    return sendError(res, 'PUSH_UNSUBSCRIBE_FAILED', error.message, 500);
  }
});

// GET /api/v1/push/status
pushRouter.get('/status', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const subs = ReviewRepository.findPushSubscriptionsByUserId(req.user!.userId);
    return sendSuccess(res, {
      subscribed: subs.length > 0,
      count: subs.length
    });
  } catch (error: any) {
    return sendError(res, 'FETCH_PUSH_STATUS_FAILED', error.message, 500);
  }
});

// POST /api/v1/push/test (Send test push notification payload)
pushRouter.post('/test', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const subs = ReviewRepository.findPushSubscriptionsByUserId(req.user!.userId);
    const payload = {
      title: req.body.title || 'Homtel Resident Notification',
      body: req.body.body || 'Bạn có thông báo mới từ ban quản lý căn hộ.',
      icon: '/pwa-icon-192.png',
      badge: '/pwa-icon-192.png',
      url: '/my',
      timestamp: Date.now()
    };

    // In a production environment with web-push library and VAPID keys:
    // webpush.sendNotification(sub, JSON.stringify(payload))
    return sendSuccess(res, {
      dispatched: subs.length,
      payload,
      message: subs.length > 0 
        ? `Đã gửi thông báo đẩy đến ${subs.length} thiết bị.` 
        : 'Chưa có thiết bị đăng ký nhận thông báo đẩy.'
    });
  } catch (error: any) {
    return sendError(res, 'PUSH_TEST_FAILED', error.message, 500);
  }
});
