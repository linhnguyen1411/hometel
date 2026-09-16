import { DatabaseClient } from '../connection.js';

export interface ProviderReviewRow {
  id: string;
  service_request_id: string;
  provider_company_id: string;
  tenant_id: string;
  rating: number;
  punctuality_rating: number | null;
  quality_rating: number | null;
  comment: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewWithDetailsRow extends ProviderReviewRow {
  tenant_name?: string;
  service_title?: string;
  service_category?: string;
  company_name?: string;
}

export interface ProviderReputationSummary {
  providerCompanyId: string;
  totalReviews: number;
  averageRating: number;
  averagePunctuality: number;
  averageQuality: number;
  positivePercentage: number;
  ratingDistribution: { [star: number]: number };
  recentReviews: ReviewWithDetailsRow[];
}

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
  user_agent: string | null;
  created_at: string;
}

export class ReviewRepository {
  private static getDb() {
    return DatabaseClient.getDb();
  }

  static createReview(review: Omit<ProviderReviewRow, 'updated_at'>): ProviderReviewRow {
    const db = this.getDb();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO provider_reviews (
        id, service_request_id, provider_company_id, tenant_id,
        rating, punctuality_rating, quality_rating, comment, tags,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      review.id,
      review.service_request_id,
      review.provider_company_id,
      review.tenant_id,
      review.rating,
      review.punctuality_rating ?? null,
      review.quality_rating ?? null,
      review.comment ?? null,
      review.tags ?? null,
      review.created_at,
      now
    );

    return {
      ...review,
      updated_at: now
    };
  }

  static findReviewByRequestId(serviceRequestId: string): ProviderReviewRow | null {
    const db = this.getDb();
    const stmt = db.prepare(`
      SELECT * FROM provider_reviews WHERE service_request_id = ?
    `);
    const row = stmt.get(serviceRequestId);
    return (row as unknown as ProviderReviewRow) || null;
  }

  static findReviewsByProviderCompanyId(companyId: string, limit = 20): ReviewWithDetailsRow[] {
    const db = this.getDb();
    const stmt = db.prepare(`
      SELECT 
        pr.*,
        u.full_name as tenant_name,
        sr.title as service_title,
        s.category as service_category,
        c.name as company_name
      FROM provider_reviews pr
      JOIN users u ON pr.tenant_id = u.id
      JOIN service_requests sr ON pr.service_request_id = sr.id
      JOIN services s ON sr.service_id = s.id
      JOIN companies c ON pr.provider_company_id = c.id
      WHERE pr.provider_company_id = ?
      ORDER BY pr.created_at DESC
      LIMIT ?
    `);
    return stmt.all(companyId, limit) as unknown as ReviewWithDetailsRow[];
  }

  static getProviderReputation(companyId: string): ProviderReputationSummary {
    const db = this.getDb();
    
    // Aggregation
    const aggStmt = db.prepare(`
      SELECT 
        COUNT(*) as total_reviews,
        AVG(rating) as avg_rating,
        AVG(punctuality_rating) as avg_punctuality,
        AVG(quality_rating) as avg_quality,
        SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) as positive_count,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as star_5,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as star_4,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as star_3,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as star_2,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as star_1
      FROM provider_reviews
      WHERE provider_company_id = ?
    `);
    const agg = aggStmt.get(companyId) as any;

    const totalReviews = Number(agg?.total_reviews || 0);
    const avgRating = totalReviews > 0 ? Math.round(Number(agg?.avg_rating || 0) * 10) / 10 : 5.0;
    const avgPunctuality = totalReviews > 0 ? Math.round(Number(agg?.avg_punctuality || 0) * 10) / 10 : 5.0;
    const avgQuality = totalReviews > 0 ? Math.round(Number(agg?.avg_quality || 0) * 10) / 10 : 5.0;
    const positivePercentage = totalReviews > 0 ? Math.round((Number(agg?.positive_count || 0) / totalReviews) * 100) : 100;

    const recentReviews = this.findReviewsByProviderCompanyId(companyId, 5);

    return {
      providerCompanyId: companyId,
      totalReviews,
      averageRating: avgRating,
      averagePunctuality: avgPunctuality,
      averageQuality: avgQuality,
      positivePercentage,
      ratingDistribution: {
        5: Number(agg?.star_5 || 0),
        4: Number(agg?.star_4 || 0),
        3: Number(agg?.star_3 || 0),
        2: Number(agg?.star_2 || 0),
        1: Number(agg?.star_1 || 0)
      },
      recentReviews
    };
  }

  static findPendingReviewsForTenant(tenantId: string): any[] {
    const db = this.getDb();
    const stmt = db.prepare(`
      SELECT 
        sr.id as service_request_id,
        sr.title,
        sr.description,
        sr.preferred_date,
        sr.created_at,
        sr.final_cost,
        s.name as service_name,
        s.category as service_category,
        c.id as provider_company_id,
        c.name as provider_company_name
      FROM service_requests sr
      JOIN services s ON sr.service_id = s.id
      JOIN companies c ON sr.provider_company_id = c.id
      LEFT JOIN provider_reviews pr ON sr.id = pr.service_request_id
      WHERE sr.tenant_id = ? 
        AND sr.status = 'COMPLETED'
        AND pr.id IS NULL
      ORDER BY sr.updated_at DESC
    `);
    return stmt.all(tenantId) as any[];
  }

  // PUSH SUBSCRIPTIONS
  static savePushSubscription(sub: {
    id: string;
    userId: string;
    endpoint: string;
    p256dh?: string;
    auth?: string;
    userAgent?: string;
  }): PushSubscriptionRow {
    const db = this.getDb();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET
        user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent
    `);
    stmt.run(sub.id, sub.userId, sub.endpoint, sub.p256dh || null, sub.auth || null, sub.userAgent || null, now);
    
    return {
      id: sub.id,
      user_id: sub.userId,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh || null,
      auth: sub.auth || null,
      user_agent: sub.userAgent || null,
      created_at: now
    };
  }

  static findPushSubscriptionsByUserId(userId: string): PushSubscriptionRow[] {
    const db = this.getDb();
    const stmt = db.prepare(`SELECT * FROM push_subscriptions WHERE user_id = ?`);
    return stmt.all(userId) as unknown as PushSubscriptionRow[];
  }

  static deletePushSubscription(endpoint: string): void {
    const db = this.getDb();
    const stmt = db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`);
    stmt.run(endpoint);
  }
}
