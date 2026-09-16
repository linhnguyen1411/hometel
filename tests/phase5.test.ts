import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestServer, createToken, testUsers } from './helpers.js';

describe('Phase 5: Resident PWA, Push Notifications, and Provider Reviews Tests', () => {
  let baseUrl: string;
  let closeServer: () => Promise<void>;

  const tenant1Token = createToken(testUsers.tenant1);
  const tenant2Token = createToken(testUsers.tenant2);
  const provider1Token = createToken(testUsers.provider1);
  const owner1Token = createToken(testUsers.owner1);

  before(async () => {
    const testEnv = await setupTestServer();
    baseUrl = testEnv.baseUrl;
    closeServer = testEnv.close;

    // Idempotent test cleanup
    const db = (await import('../server/db/connection.js')).DatabaseClient.getDb();
    db.exec("DELETE FROM provider_reviews WHERE service_request_id = 'sr_2';");
    db.exec("DELETE FROM push_subscriptions WHERE user_id = 'usr_tnt_1';");
  });

  after(async () => {
    if (closeServer) await closeServer();
  });

  // =========================================================================
  // PART 1: Service Provider Review & Rating System
  // =========================================================================
  describe('Service Provider Review & Rating System', () => {
    it('1.1 Tenant 2 fetches pending reviews and sees completed work order sr_2', async () => {
      const res = await fetch(`${baseUrl}/api/v1/reviews/pending`, {
        headers: { Authorization: `Bearer ${tenant2Token}` }
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data), 'Data must be an array');
      const pendingSr2 = data.data.find((item: any) => item.service_request_id === 'sr_2');
      assert.ok(pendingSr2, 'sr_2 should be in pending reviews list for Tenant 2');
    });

    it('1.2 Validation: Tenant cannot submit review for an IN_PROGRESS work order (400)', async () => {
      // sr_1 is IN_PROGRESS belonging to tenant 1
      const res = await fetch(`${baseUrl}/api/v1/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant1Token}`
        },
        body: JSON.stringify({
          serviceRequestId: 'sr_1',
          rating: 5,
          comment: 'Premature review attempt'
        })
      });
      const data = await res.json();

      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error?.code, 'INVALID_STATUS');
    });

    it('1.3 Security: Tenant 1 cannot review Tenant 2 work order (403 Forbidden)', async () => {
      // sr_2 belongs to tenant 2
      const res = await fetch(`${baseUrl}/api/v1/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant1Token}`
        },
        body: JSON.stringify({
          serviceRequestId: 'sr_2',
          rating: 5,
          comment: 'Illegal review attempt on another resident work order'
        })
      });
      const data = await res.json();

      assert.strictEqual(res.status, 403);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error?.code, 'FORBIDDEN');
    });

    it('1.4 Tenant 2 submits valid 5-star review with quality and punctuality ratings (201)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant2Token}`
        },
        body: JSON.stringify({
          serviceRequestId: 'sr_2',
          rating: 5,
          punctualityRating: 5,
          qualityRating: 5,
          comment: 'Kỹ thuật viên đến đúng giờ, dọn dẹp rất sạch sẽ và chu đáo!',
          tags: ['nhanh_chong', 'chuyen_nghiep', 'sach_se']
        })
      });
      const data = await res.json();

      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.success, true);
      assert.ok(data.data?.id, 'Created review must have an id');
      assert.strictEqual(data.data.rating, 5);
      assert.strictEqual(data.data.provider_company_id, 'cmp_prv_1');
    });

    it('1.5 Idempotency: Duplicate review for same work order is rejected (409 Conflict)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant2Token}`
        },
        body: JSON.stringify({
          serviceRequestId: 'sr_2',
          rating: 4,
          comment: 'Second review attempt should fail'
        })
      });
      const data = await res.json();

      assert.strictEqual(res.status, 409);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error?.code, 'CONFLICT');
    });

    it('1.6 Provider reputation API aggregates star ratings and recent reviews correctly', async () => {
      const res = await fetch(`${baseUrl}/api/v1/reviews/provider/cmp_prv_1`);
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.data.totalReviews >= 1, 'Total reviews should be at least 1');
      assert.ok(data.data.averageRating >= 4.0, 'Average rating should be high');
      assert.strictEqual(data.data.positivePercentage, 100);
      assert.ok(Array.isArray(data.data.recentReviews), 'Recent reviews must be an array');
      const latest = data.data.recentReviews[0];
      assert.strictEqual(latest.service_request_id, 'sr_2');
      assert.strictEqual(latest.rating, 5);
    });

    it('1.7 Pending reviews no longer includes completed and reviewed order sr_2', async () => {
      const res = await fetch(`${baseUrl}/api/v1/reviews/pending`, {
        headers: { Authorization: `Bearer ${tenant2Token}` }
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      const pendingSr2 = data.data.find((item: any) => item.service_request_id === 'sr_2');
      assert.strictEqual(pendingSr2, undefined, 'sr_2 should no longer be pending review');
    });

    it('1.8 Security: Non-tenant / unauthenticated cannot submit review (401 / 403)', async () => {
      const unauthRes = await fetch(`${baseUrl}/api/v1/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceRequestId: 'sr_2', rating: 5 })
      });
      assert.strictEqual(unauthRes.status, 401);

      const ownerRes = await fetch(`${baseUrl}/api/v1/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`
        },
        body: JSON.stringify({ serviceRequestId: 'sr_2', rating: 5 })
      });
      assert.strictEqual(ownerRes.status, 403);
    });
  });

  // =========================================================================
  // PART 2: Resident PWA & Web Push Notification Infrastructure
  // =========================================================================
  describe('Resident PWA & Web Push Notifications', () => {
    const testEndpoint = `https://fcm.googleapis.com/fcm/send/test_pwa_token_${Date.now()}`;

    it('2.1 Resident registers Web Push subscription (201 Created)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant1Token}`
        },
        body: JSON.stringify({
          endpoint: testEndpoint,
          keys: {
            p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9P045SG2',
            auth: 'tBHItJI5svbpez7KI4CCXg'
          },
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
        })
      });
      const data = await res.json();

      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data?.subscription?.endpoint, testEndpoint);
    });

    it('2.2 Resident checks push notification subscription status (200 OK)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/push/status`, {
        headers: { Authorization: `Bearer ${tenant1Token}` }
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data?.subscribed, true);
      assert.ok(data.data?.count >= 1);
    });

    it('2.3 Resident triggers a test push notification dispatch (200 OK)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/push/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant1Token}`
        },
        body: JSON.stringify({
          title: 'Nhắc nhở hóa đơn tiền phòng',
          body: 'Hóa đơn tháng 09/2026 của bạn đã được phát hành.'
        })
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.data?.dispatched >= 1);
      assert.strictEqual(data.data?.payload?.title, 'Nhắc nhở hóa đơn tiền phòng');
    });

    it('2.4 Resident unsubscribes from Web Push notifications (200 OK)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/push/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant1Token}`
        },
        body: JSON.stringify({ endpoint: testEndpoint })
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
    });

    it('2.5 Security: Unauthenticated request cannot subscribe to push notifications (401)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'https://fake-endpoint.com' })
      });

      assert.strictEqual(res.status, 401);
    });
  });
});
