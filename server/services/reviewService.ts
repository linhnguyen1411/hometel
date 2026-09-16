import crypto from 'node:crypto';
import { DatabaseClient } from '../db/connection.js';
import { ReviewRepository, ProviderReviewRow, ProviderReputationSummary } from '../db/repositories/reviewRepository.js';
import { ServiceRepository } from '../db/repositories/serviceRepository.js';
import { TokenPayload } from './authService.js';

export interface SubmitReviewInput {
  serviceRequestId: string;
  rating: number;
  punctualityRating?: number;
  qualityRating?: number;
  comment?: string;
  tags?: string[];
}

export class ReviewService {
  static submitReview(user: TokenPayload, input: SubmitReviewInput): ProviderReviewRow {
    const { serviceRequestId, rating, punctualityRating, qualityRating, comment, tags } = input;

    if (!serviceRequestId) {
      throw new Error('VALIDATION_ERROR: serviceRequestId is required');
    }

    if (!rating || rating < 1 || rating > 5) {
      throw new Error('VALIDATION_ERROR: rating must be between 1 and 5');
    }

    if (punctualityRating !== undefined && (punctualityRating < 1 || punctualityRating > 5)) {
      throw new Error('VALIDATION_ERROR: punctualityRating must be between 1 and 5');
    }

    if (qualityRating !== undefined && (qualityRating < 1 || qualityRating > 5)) {
      throw new Error('VALIDATION_ERROR: qualityRating must be between 1 and 5');
    }

    // Verify service request exists
    const request = ServiceRepository.findRequestById(serviceRequestId);
    if (!request) {
      throw new Error('NOT_FOUND: Service request not found');
    }

    // Verify user is the tenant of the service request
    if (user.role === 'TENANT' && request.tenant_id !== user.userId) {
      throw new Error('FORBIDDEN: You can only review your own service requests');
    }

    // Verify service request is completed
    if (request.status !== 'COMPLETED') {
      throw new Error('INVALID_STATUS: Only completed service requests can be reviewed');
    }

    // Check if review already exists
    const existingReview = ReviewRepository.findReviewByRequestId(serviceRequestId);
    if (existingReview) {
      throw new Error('CONFLICT: A review has already been submitted for this service request');
    }

    const reviewId = `rev_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    return DatabaseClient.withTransaction(() => {
      const review = ReviewRepository.createReview({
        id: reviewId,
        service_request_id: serviceRequestId,
        provider_company_id: request.provider_company_id,
        tenant_id: request.tenant_id,
        rating: Math.round(rating),
        punctuality_rating: punctualityRating ? Math.round(punctualityRating) : null,
        quality_rating: qualityRating ? Math.round(qualityRating) : null,
        comment: comment?.trim() || null,
        tags: tags && tags.length > 0 ? JSON.stringify(tags) : null,
        created_at: now
      });

      return review;
    });
  }

  static getProviderReputation(companyId: string): ProviderReputationSummary {
    if (!companyId) {
      throw new Error('VALIDATION_ERROR: companyId is required');
    }
    return ReviewRepository.getProviderReputation(companyId);
  }

  static getTenantPendingReviews(tenantId: string) {
    if (!tenantId) {
      throw new Error('VALIDATION_ERROR: tenantId is required');
    }
    return ReviewRepository.findPendingReviewsForTenant(tenantId);
  }
}
