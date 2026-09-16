import { Router } from 'express';
import { ReviewService } from '../services/reviewService.js';
import { ReviewRepository } from '../db/repositories/reviewRepository.js';
import { authenticate, requireRole, optionalAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { sendSuccess, sendError } from '../utils/responseHelper.js';

export const reviewRouter = Router();

// ==========================================
// SERVICE PROVIDER REVIEWS & RATINGS (PHASE 5)
// ==========================================

// POST /api/v1/reviews (Tenant submits review for completed work order)
reviewRouter.post('/', authenticate, requireRole('TENANT', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res) => {
  try {
    const { serviceRequestId, rating, punctualityRating, qualityRating, comment, tags } = req.body;

    const review = ReviewService.submitReview(req.user!, {
      serviceRequestId,
      rating: Number(rating),
      punctualityRating: punctualityRating !== undefined ? Number(punctualityRating) : undefined,
      qualityRating: qualityRating !== undefined ? Number(qualityRating) : undefined,
      comment,
      tags: Array.isArray(tags) ? tags : undefined
    });

    return sendSuccess(res, review, 201);
  } catch (error: any) {
    const msg = error.message || '';
    if (msg.startsWith('NOT_FOUND:')) {
      return sendError(res, 'NOT_FOUND', msg.replace('NOT_FOUND: ', ''), 404);
    }
    if (msg.startsWith('FORBIDDEN:')) {
      return sendError(res, 'FORBIDDEN', msg.replace('FORBIDDEN: ', ''), 403);
    }
    if (msg.startsWith('INVALID_STATUS:')) {
      return sendError(res, 'INVALID_STATUS', msg.replace('INVALID_STATUS: ', ''), 400);
    }
    if (msg.startsWith('CONFLICT:')) {
      return sendError(res, 'CONFLICT', msg.replace('CONFLICT: ', ''), 409);
    }
    if (msg.startsWith('VALIDATION_ERROR:')) {
      return sendError(res, 'VALIDATION_ERROR', msg.replace('VALIDATION_ERROR: ', ''), 400);
    }
    return sendError(res, 'SUBMIT_REVIEW_FAILED', msg, 500);
  }
});

// GET /api/v1/reviews/pending (Tenant fetches list of completed work orders awaiting review)
reviewRouter.get('/pending', authenticate, requireRole('TENANT', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = req.user!.userId;
    const pending = ReviewService.getTenantPendingReviews(tenantId);
    return sendSuccess(res, pending);
  } catch (error: any) {
    return sendError(res, 'FETCH_PENDING_REVIEWS_FAILED', error.message, 500);
  }
});

// GET /api/v1/reviews/provider/:providerId (Public/Protected: Get reputation & ratings of a provider)
reviewRouter.get('/provider/:providerId', optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { providerId } = req.params;
    const reputation = ReviewService.getProviderReputation(providerId);
    return sendSuccess(res, reputation);
  } catch (error: any) {
    return sendError(res, 'FETCH_PROVIDER_REVIEWS_FAILED', error.message, 500);
  }
});

// GET /api/v1/reviews/request/:requestId (Get review for specific work order)
reviewRouter.get('/request/:requestId', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const { requestId } = req.params;
    const review = ReviewRepository.findReviewByRequestId(requestId);
    if (!review) {
      return sendError(res, 'REVIEW_NOT_FOUND', 'No review found for this work order', 404);
    }
    return sendSuccess(res, review);
  } catch (error: any) {
    return sendError(res, 'FETCH_REVIEW_FAILED', error.message, 500);
  }
});
