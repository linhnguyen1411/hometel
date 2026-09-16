import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestServer, createToken, testUsers } from './helpers.js';

describe('Global RBAC Matrix & Endpoint Protection Tests', () => {
  let baseUrl: string;
  let closeServer: () => Promise<void>;

  const superAdminToken = createToken(testUsers.superAdmin);
  const ownerToken = createToken(testUsers.owner1);
  const tenantToken = createToken(testUsers.tenant1);
  const providerToken = createToken(testUsers.provider1);

  before(async () => {
    const testEnv = await setupTestServer();
    baseUrl = testEnv.baseUrl;
    closeServer = testEnv.close;
  });

  after(async () => {
    if (closeServer) await closeServer();
  });

  it('SuperAdmin endpoints: Only SUPER_ADMIN allowed', async () => {
    // Owner attempting to access admin stats -> 403
    const ownerRes = await fetch(`${baseUrl}/api/v1/admin/stats`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(ownerRes.status, 403, 'Owner must be rejected from /api/v1/admin/* with 403');

    // Tenant attempting to access admin stats -> 403
    const tenantRes = await fetch(`${baseUrl}/api/v1/admin/stats`, {
      headers: { Authorization: `Bearer ${tenantToken}` }
    });
    assert.equal(tenantRes.status, 403, 'Tenant must be rejected from /api/v1/admin/* with 403');

    // Super Admin accessing stats -> 200
    const adminRes = await fetch(`${baseUrl}/api/v1/admin/stats`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    assert.equal(adminRes.status, 200, 'Super Admin must have access with 200');
  });

  it('Building & Room creation endpoints: Tenant rejected with 403', async () => {
    // Tenant creating building -> 403
    const bldRes = await fetch(`${baseUrl}/api/v1/buildings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantToken}`
      },
      body: JSON.stringify({ name: 'Hacked Building', address: '123 Test St' })
    });
    assert.equal(bldRes.status, 403, 'Tenant cannot create buildings');

    // Tenant creating room -> 403
    const roomRes = await fetch(`${baseUrl}/api/v1/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantToken}`
      },
      body: JSON.stringify({ buildingId: 'bld_1', floorId: 'flr_1', roomNumber: '999' })
    });
    assert.equal(roomRes.status, 403, 'Tenant cannot create rooms');
  });

  it('Rental review & contract creation: Tenant rejected with 403', async () => {
    // Tenant reviewing application -> 403
    const reviewRes = await fetch(`${baseUrl}/api/v1/rentals/applications/app_1/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantToken}`
      },
      body: JSON.stringify({ action: 'APPROVE' })
    });
    assert.equal(reviewRes.status, 403, 'Tenant cannot review rental applications');

    // Tenant creating contract -> 403
    const contractRes = await fetch(`${baseUrl}/api/v1/contracts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantToken}`
      },
      body: JSON.stringify({ roomId: 'rm_bld1_101', tenantId: 'usr_tnt_1', startDate: '2026-10-01' })
    });
    assert.equal(contractRes.status, 403, 'Tenant cannot create contracts');
  });

  it('Service Catalog management: Non-provider/non-admin rejected with 403', async () => {
    // Tenant creating service -> 403
    const srvRes = await fetch(`${baseUrl}/api/v1/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantToken}`
      },
      body: JSON.stringify({ name: 'Illegal Service', category: 'HVAC', basePrice: 100000 })
    });
    assert.equal(srvRes.status, 403, 'Tenant cannot create services');

    // Owner creating service -> 403 (Services belong to Service Providers)
    const ownerSrvRes = await fetch(`${baseUrl}/api/v1/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({ name: 'Owner Service', category: 'CLEANING', basePrice: 100000 })
    });
    assert.equal(ownerSrvRes.status, 403, 'Owner cannot create service items');
  });

  it('Operations Cockpit & Action Center: Tenant rejected with 403', async () => {
    const todayRes = await fetch(`${baseUrl}/api/v1/operations/today`, {
      headers: { Authorization: `Bearer ${tenantToken}` }
    });
    assert.equal(todayRes.status, 403, 'Tenant cannot access Operations Today Cockpit');

    const actionsRes = await fetch(`${baseUrl}/api/v1/operations/actions`, {
      headers: { Authorization: `Bearer ${tenantToken}` }
    });
    assert.equal(actionsRes.status, 403, 'Tenant cannot access Operations Action Center');

    const insightsRes = await fetch(`${baseUrl}/api/v1/operations/ai-insights`, {
      headers: { Authorization: `Bearer ${tenantToken}` }
    });
    assert.equal(insightsRes.status, 403, 'Tenant cannot access AI Operational Insights');
  });
});
