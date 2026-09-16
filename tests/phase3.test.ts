import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestServer, createToken, testUsers } from './helpers.js';

describe('Phase 3: Building Diagram, Facade/Grid View, and Data Isolation Tests', () => {
  let baseUrl: string;
  let closeServer: () => Promise<void>;

  const superAdminToken = createToken(testUsers.superAdmin);
  const owner1Token = createToken(testUsers.owner1);
  const staff1Token = createToken(testUsers.staff1);
  const provider1Token = createToken(testUsers.provider1);
  const tenant1Token = createToken(testUsers.tenant1);

  before(async () => {
    const testEnv = await setupTestServer();
    baseUrl = testEnv.baseUrl;
    closeServer = testEnv.close;
  });

  after(async () => {
    if (closeServer) await closeServer();
  });

  // ==========================================
  // PART 1: Building 360 Facade & Grid Data API
  // ==========================================
  describe('Building 360 Aggregation API', () => {
    it('1.1 Owner can fetch Building 360 for Building 1 with summary and floors', async () => {
      const res = await fetch(`${baseUrl}/api/v1/operations/buildings/bld_1/360`, {
        headers: {
          Authorization: `Bearer ${owner1Token}`
        }
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.ok(body.data);

      const { building, summary, floors } = body.data;
      assert.equal(building.id, 'bld_1');
      assert.equal(building.name, 'Hoa Xuan Premier Residences');

      // Check summary calculations
      assert.ok(summary.totalRooms >= 8);
      assert.ok(summary.occupiedRooms >= 1);
      assert.ok(summary.occupancyRate >= 0 && summary.occupancyRate <= 100);
      assert.ok(typeof summary.collectionRate === 'number');

      // Check floor structure for Facade & Grid
      assert.ok(Array.isArray(floors));
      assert.ok(floors.length >= 4);

      // Verify each room has healthStatus and healthReason
      for (const floor of floors) {
        assert.ok(typeof floor.floor_number === 'number');
        for (const room of floor.rooms) {
          assert.ok(room.id);
          assert.ok(room.room_number);
          assert.ok(['HEALTHY', 'CRITICAL', 'ATTENTION', 'AVAILABLE'].includes(room.healthStatus));
          assert.ok(typeof room.healthReason === 'string');
        }
      }
    });

    it('1.2 Building 360 handles non-existent building ID gracefully (404)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/operations/buildings/non_existent_bld/360`, {
        headers: {
          Authorization: `Bearer ${owner1Token}`
        }
      });

      assert.equal(res.status, 404);
      const body = (await res.json()) as any;
      assert.equal(body.success, false);
    });
  });

  // ==========================================
  // PART 2: Role-based PII Data Isolation on Room 360
  // ==========================================
  describe('Room 360 API & Tenant PII Privacy Masking', () => {
    const occupiedRoomId = 'rm_bld1_101'; // Room with active tenant usr_tnt_1

    it('2.1 Owner retrieves UNMASKED tenant PII (Full privileged access)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/operations/rooms/${occupiedRoomId}/360`, {
        headers: {
          Authorization: `Bearer ${owner1Token}`
        }
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.ok(body.data);

      const { tenant, isPrivileged } = body.data;
      assert.equal(isPrivileged, true);
      assert.ok(tenant, 'Occupied room should have tenant');
      assert.equal(tenant.isMasked, false);

      // Full PII unmasked
      assert.equal(tenant.email, 'tenant1@gmail.com');
      assert.equal(tenant.phone, '+84 912 001 001');
      assert.ok(tenant.name);
    });

    it('2.2 Super Admin retrieves UNMASKED tenant PII', async () => {
      const res = await fetch(`${baseUrl}/api/v1/operations/rooms/${occupiedRoomId}/360`, {
        headers: {
          Authorization: `Bearer ${superAdminToken}`
        }
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);

      const { tenant, isPrivileged } = body.data;
      assert.equal(isPrivileged, true);
      assert.equal(tenant.isMasked, false);
      assert.equal(tenant.email, 'tenant1@gmail.com');
      assert.equal(tenant.phone, '+84 912 001 001');
    });

    it('2.3 Staff receives MASKED tenant PII (Data Privacy Protection)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/operations/rooms/${occupiedRoomId}/360`, {
        headers: {
          Authorization: `Bearer ${staff1Token}`
        }
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);

      const { tenant, isPrivileged } = body.data;
      assert.equal(isPrivileged, false);
      assert.ok(tenant);
      assert.equal(tenant.isMasked, true);

      // Phone must be masked with bullet/dots e.g. "+84 912 ••• 001"
      assert.notEqual(tenant.phone, '+84 912 001 001');
      assert.ok(tenant.phone.includes('•••'));

      // Email must be masked e.g. "t***1@gmail.com"
      assert.notEqual(tenant.email, 'tenant1@gmail.com');
      assert.ok(tenant.email.includes('***'));
    });

    it('2.4 Service Provider receives MASKED tenant PII', async () => {
      const res = await fetch(`${baseUrl}/api/v1/operations/rooms/${occupiedRoomId}/360`, {
        headers: {
          Authorization: `Bearer ${provider1Token}`
        }
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);

      const { tenant, isPrivileged } = body.data;
      assert.equal(isPrivileged, false);
      assert.ok(tenant);
      assert.equal(tenant.isMasked, true);
      assert.ok(tenant.phone.includes('•••'));
      assert.ok(tenant.email.includes('***'));
    });

    it('2.5 Room 360 returns meters, equipment, invoices, and timeline', async () => {
      const res = await fetch(`${baseUrl}/api/v1/operations/rooms/${occupiedRoomId}/360`, {
        headers: {
          Authorization: `Bearer ${owner1Token}`
        }
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      const { meters, equipment, invoices, timeline } = body.data;

      assert.ok(Array.isArray(meters));
      assert.ok(Array.isArray(equipment));
      assert.ok(equipment.length > 0, 'Seed room 101 should have equipment items');
      assert.ok(Array.isArray(invoices));
      assert.ok(Array.isArray(timeline));
      assert.ok(timeline.length > 0, 'Timeline should contain contract/invoice events');
    });
  });

  // ==========================================
  // PART 3: Room Status Lifecycle Management
  // ==========================================
  describe('Room Status Lifecycle Management', () => {
    const availableRoomId = 'rm_bld1_201';

    it('3.1 Owner switches room from AVAILABLE to MAINTENANCE', async () => {
      const res = await fetch(`${baseUrl}/api/v1/rooms/${availableRoomId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`
        },
        body: JSON.stringify({ status: 'MAINTENANCE' })
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.equal(body.data.status, 'MAINTENANCE');
    });

    it('3.2 Owner restores room from MAINTENANCE back to AVAILABLE', async () => {
      const res = await fetch(`${baseUrl}/api/v1/rooms/${availableRoomId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`
        },
        body: JSON.stringify({ status: 'AVAILABLE' })
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.equal(body.data.status, 'AVAILABLE');
    });

    it('3.3 Tenant cannot modify room status (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/rooms/${availableRoomId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant1Token}`
        },
        body: JSON.stringify({ status: 'MAINTENANCE' })
      });

      assert.equal(res.status, 403);
    });
  });
});
