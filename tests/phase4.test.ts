import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestServer, createToken, testUsers } from './helpers.js';

describe('Phase 4: OCR Meter Reading, CRM Tours/Leads, and Consolidated P&L Tests', () => {
  let baseUrl: string;
  let closeServer: () => Promise<void>;

  const superAdminToken = createToken(testUsers.superAdmin);
  const owner1Token = createToken(testUsers.owner1);
  const staff1Token = createToken(testUsers.staff1);
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
  // PART 1: OCR Meter Reading & Auto-Draft Invoicing
  // ==========================================
  describe('OCR Meter Scanning & Auto-Draft Invoicing', () => {
    const testMeterId = 'mtr_elec_rm_bld1_101'; // Seed meter for rm_bld1_101

    it('1.1 Owner/Staff scans meter photo and extracts reading with AI confidence', async () => {
      const res = await fetch(`${baseUrl}/api/v1/meters/ocr-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`
        },
        body: JSON.stringify({
          meterId: testMeterId,
          imageBase64OrUrl: 'data:image/jpeg;base64,reading=298.5',
          meterType: 'ELECTRICITY',
          previousReading: 280
        })
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.ok(body.data);

      const data = body.data;
      assert.equal(data.extractedReading, 298.5);
      assert.equal(data.previousReading, 280);
      assert.equal(data.consumption, 18.5);
      assert.ok(data.confidence >= 0.9);
      assert.equal(data.isAnomaly, false);
    });

    it('1.2 OCR flags anomaly when consumption is abnormally excessive', async () => {
      const res = await fetch(`${baseUrl}/api/v1/meters/ocr-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staff1Token}`
        },
        body: JSON.stringify({
          meterId: testMeterId,
          imageBase64OrUrl: 'data:image/jpeg;base64,reading=820',
          meterType: 'ELECTRICITY',
          previousReading: 280
        })
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);

      const data = body.data;
      assert.equal(data.extractedReading, 820);
      assert.equal(data.consumption, 540);
      assert.equal(data.isAnomaly, true);
      assert.ok(data.anomalyWarning && data.anomalyWarning.includes('Cảnh báo'));
    });

    it('1.3 OCR rejects invalid reading lower than previous reading (400)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/meters/ocr-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`
        },
        body: JSON.stringify({
          meterId: testMeterId,
          imageBase64OrUrl: 'data:image/jpeg;base64,reading=200',
          meterType: 'ELECTRICITY',
          previousReading: 280
        })
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as any;
      assert.equal(body.success, false);
    });

    it('1.4 Staff commits OCR reading with auto-draft monthly invoice', async () => {
      const readingDate = new Date().toISOString().substring(0, 10);
      const res = await fetch(`${baseUrl}/api/v1/meters/${testMeterId}/commit-ocr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staff1Token}`
        },
        body: JSON.stringify({
          readingValue: 305.5,
          readingDate,
          imageUrl: 'https://storage.homtel.vn/meters/sample_scan.jpg',
          ocrConfidence: 0.98,
          ocrRawText: '305.5',
          autoDraftInvoice: true,
          billingMonth: '2026-11' // Fresh billing month
        })
      });

      assert.equal(res.status, 201);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.ok(body.data.reading);
      assert.equal(body.data.reading.reading_value, 305.5);

      // Verify invoice was automatically drafted for the room
      if (body.data.generatedInvoice) {
        assert.ok(body.data.generatedInvoice.id);
        assert.equal(body.data.generatedInvoice.billing_month, '2026-11');
      }
    });

    it('1.5 Security: Tenant cannot call OCR endpoints (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/meters/ocr-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant1Token}`
        },
        body: JSON.stringify({
          meterId: testMeterId,
          imageBase64OrUrl: 'data:image/jpeg;base64,reading=320',
          meterType: 'ELECTRICITY',
          previousReading: 305.5
        })
      });

      assert.equal(res.status, 403);
    });
  });

  // ==========================================
  // PART 2: CRM Leads, Tours & Conversion Funnel
  // ==========================================
  describe('CRM Leads, Tours & Conversion Funnel', () => {
    let createdLeadId: string;
    let createdTourId: string;

    it('2.1 Owner creates a new prospective lead', async () => {
      const res = await fetch(`${baseUrl}/api/v1/crm/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`
        },
        body: JSON.stringify({
          fullName: 'Bui Quang Huy',
          phone: '+84 905 888 777',
          email: 'quanghuy@crmtest.com',
          source: 'FACEBOOK',
          budgetMin: 8000000,
          budgetMax: 10000000,
          preferredRoomType: 'ONE_BEDROOM',
          notes: 'Muốn thuê căn view sông, dọn vào tháng sau'
        })
      });

      assert.equal(res.status, 201);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.ok(body.data.id);
      assert.equal(body.data.status, 'NEW');
      createdLeadId = body.data.id;
    });

    it('2.2 Owner retrieves leads and verifies funnel metrics incremented', async () => {
      const res = await fetch(`${baseUrl}/api/v1/crm/leads`, {
        headers: {
          Authorization: `Bearer ${owner1Token}`
        }
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data.leads));
      assert.ok(body.data.funnel.TOTAL >= 1);
      assert.ok(body.data.funnel.NEW >= 1);

      const found = body.data.leads.find((l: any) => l.id === createdLeadId);
      assert.ok(found);
      assert.equal(found.full_name, 'Bui Quang Huy');
    });

    it('2.3 Staff schedules a room viewing tour for the lead', async () => {
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().substring(0, 16);
      const res = await fetch(`${baseUrl}/api/v1/crm/tours`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staff1Token}`
        },
        body: JSON.stringify({
          leadId: createdLeadId,
          roomId: 'rm_bld1_201', // Available room
          scheduledAt: tomorrow
        })
      });

      assert.equal(res.status, 201);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.ok(body.data.id);
      assert.equal(body.data.status, 'SCHEDULED');
      createdTourId = body.data.id;

      // Verify lead status transitioned to TOUR_SCHEDULED
      const leadCheck = await (await fetch(`${baseUrl}/api/v1/crm/leads/${createdLeadId}`, {
        headers: { Authorization: `Bearer ${owner1Token}` }
      })).json() as any;
      assert.equal(leadCheck.data.status, 'TOUR_SCHEDULED');
    });

    it('2.4 Staff completes room tour with rating and feedback', async () => {
      const res = await fetch(`${baseUrl}/api/v1/crm/tours/${createdTourId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staff1Token}`
        },
        body: JSON.stringify({
          status: 'COMPLETED',
          rating: 5,
          feedback: 'Khách hàng rất thích phòng 201 ban công thoáng, đồng ý ký đơn thuê'
        })
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.equal(body.data.status, 'COMPLETED');
      assert.equal(body.data.rating, 5);

      // Verify lead status transitioned to TOUR_COMPLETED
      const leadCheck = await (await fetch(`${baseUrl}/api/v1/crm/leads/${createdLeadId}`, {
        headers: { Authorization: `Bearer ${owner1Token}` }
      })).json() as any;
      assert.equal(leadCheck.data.status, 'TOUR_COMPLETED');
    });

    it('2.5 1-Click convert Lead into formal Rental Application', async () => {
      const res = await fetch(`${baseUrl}/api/v1/crm/leads/${createdLeadId}/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`
        },
        body: JSON.stringify({
          roomId: 'rm_bld1_201',
          intendedStartDate: '2026-11-01',
          leaseDurationMonths: 12,
          occupantsCount: 2
        })
      });

      assert.equal(res.status, 201);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.ok(body.data.application);
      assert.ok(body.data.tenantUser);
      assert.equal(body.data.tenantUser.fullName, 'Bui Quang Huy');

      // Lead status is now CONVERTED
      const leadCheck = await (await fetch(`${baseUrl}/api/v1/crm/leads/${createdLeadId}`, {
        headers: { Authorization: `Bearer ${owner1Token}` }
      })).json() as any;
      assert.equal(leadCheck.data.status, 'CONVERTED');
    });

    it('2.6 Security: Tenant cannot access CRM routes (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/crm/leads`, {
        headers: {
          Authorization: `Bearer ${tenant1Token}`
        }
      });

      assert.equal(res.status, 403);
    });
  });

  // ==========================================
  // PART 3: Multi-Building Consolidated Financial P&L
  // ==========================================
  describe('Multi-Building Consolidated Financial P&L', () => {
    it('3.1 Owner retrieves consolidated P&L report across all buildings', async () => {
      const res = await fetch(`${baseUrl}/api/v1/finance/pnl/consolidated?periodMonth=2026-08`, {
        headers: {
          Authorization: `Bearer ${owner1Token}`
        }
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.ok(body.data);

      const { portfolio, buildings } = body.data;
      assert.ok(portfolio.totalBuildings >= 1);
      assert.ok(portfolio.totalRooms >= 8);
      assert.ok(typeof portfolio.grossRevenue === 'number');
      assert.ok(typeof portfolio.revenueCollected === 'number');
      assert.ok(typeof portfolio.netOperatingIncome === 'number');
      assert.ok(typeof portfolio.operatingMargin === 'number');
      assert.ok(typeof portfolio.collectionRate === 'number');
      assert.ok(typeof portfolio.momRevenueGrowth === 'number');

      // Building list breakdown
      assert.ok(Array.isArray(buildings));
      assert.ok(buildings.length >= 1);
      for (const b of buildings) {
        assert.ok(b.buildingId);
        assert.ok(b.buildingName);
        assert.ok(typeof b.grossRevenue === 'number');
        assert.ok(typeof b.netOperatingIncome === 'number');
        assert.ok(typeof b.collectionRate === 'number');
      }
    });

    it('3.2 Owner records an operational expense for Building 1', async () => {
      const res = await fetch(`${baseUrl}/api/v1/finance/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`
        },
        body: JSON.stringify({
          buildingId: 'bld_1',
          category: 'MAINTENANCE_REPAIR',
          description: 'Sửa chữa bảo dưỡng thang máy định kỳ tháng 8',
          amount: 2500000,
          expenseDate: '2026-08-15',
          periodMonth: '2026-08',
          vendorName: 'Thang Máy Schindler'
        })
      });

      assert.equal(res.status, 201);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.ok(body.data.id);
      assert.equal(body.data.amount, 2500000);
      assert.equal(body.data.category, 'MAINTENANCE_REPAIR');
    });

    it('3.3 Recorded expense impacts OpEx and reduces Net Operating Income (NOI)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/finance/pnl/consolidated?periodMonth=2026-08`, {
        headers: {
          Authorization: `Bearer ${owner1Token}`
        }
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      const bld1 = body.data.buildings.find((b: any) => b.buildingId === 'bld_1');
      assert.ok(bld1);
      assert.ok(bld1.totalOperatingExpense >= 2500000);
      assert.equal(bld1.netOperatingIncome, bld1.grossRevenue - bld1.totalOperatingExpense);
    });

    it('3.4 Security: Tenant cannot access consolidated P&L (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/finance/pnl/consolidated`, {
        headers: {
          Authorization: `Bearer ${tenant1Token}`
        }
      });

      assert.equal(res.status, 403);
    });
  });
});
