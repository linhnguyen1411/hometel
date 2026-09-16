import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestServer, createToken, testUsers } from './helpers.js';

describe('Phase 2: VietQR Webhook, Zalo ZNS, and E-Signature Tests', () => {
  let baseUrl: string;
  let closeServer: () => Promise<void>;

  const ownerToken = createToken(testUsers.owner1);
  const tenant1Token = createToken(testUsers.tenant1);
  const tenant2Token = createToken(testUsers.tenant2);

  before(async () => {
    const testEnv = await setupTestServer();
    baseUrl = testEnv.baseUrl;
    closeServer = testEnv.close;
  });

  after(async () => {
    if (closeServer) await closeServer();
  });

  // ==========================================
  // PART 1: VietQR Info & Webhook Auto-Reconciliation
  // ==========================================
  describe('VietQR Dynamic QR & Webhook Auto-Reconciliation', () => {
    let testInvoice: any;

    it('1.1 Owner generates a fresh invoice to test VietQR', async () => {
      const res = await fetch(`${baseUrl}/api/v1/invoices/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`
        },
        body: JSON.stringify({
          contractId: 'ctr_1',
          billingMonth: '2026-12',
          electricityConsumption: 50,
          waterConsumption: 5
        })
      });

      assert.equal(res.status, 201);
      const data = (await res.json()) as any;
      assert.equal(data.success, true);
      testInvoice = data.data;
      assert.ok(testInvoice.id);
      assert.ok(testInvoice.outstanding_amount > 0);
    });

    it('1.2 Tenant 1 retrieves VietQR payment info (NAPAS 247 compliant)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/payments/vietqr/info/${testInvoice.id}`, {
        headers: {
          Authorization: `Bearer ${tenant1Token}`
        }
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      const vqr = body.data;

      assert.equal(vqr.invoiceId, testInvoice.id);
      assert.equal(vqr.amount, testInvoice.outstanding_amount);
      assert.ok(vqr.qrImageUrl.includes('vietqr.io'));
      assert.ok(vqr.transferContent.includes(testInvoice.invoice_number));
      assert.ok(vqr.accountNo);
    });

    it('1.3 Security: Tenant 2 cannot access Tenant 1 VietQR invoice info (403)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/payments/vietqr/info/${testInvoice.id}`, {
        headers: {
          Authorization: `Bearer ${tenant2Token}`
        }
      });

      assert.equal(res.status, 403);
      const body = (await res.json()) as any;
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'FORBIDDEN');
    });

    let processedRefCode: string;
    let processedWebhookPayload: any;

    it('1.4 VietQR Webhook: Automatically reconciles invoice debt on bank transfer notification', async () => {
      processedRefCode = `VQR_TX_${Date.now()}`;
      processedWebhookPayload = {
        referenceCode: processedRefCode,
        transferAmount: testInvoice.outstanding_amount,
        content: `HOMTEL ${testInvoice.invoice_number} chuyen tien phong`,
        transactionDate: new Date().toISOString()
      };

      const res = await fetch(`${baseUrl}/api/v1/payments/vietqr/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(processedWebhookPayload)
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.equal(body.data.processedCount, 1);
      assert.equal(body.data.transactions[0].status, 'RECONCILED');
      assert.equal(body.data.transactions[0].invoiceStatus, 'PAID');
      assert.equal(body.data.transactions[0].outstanding, 0);

      // Verify invoice is indeed marked as PAID in database
      const invCheckRes = await fetch(`${baseUrl}/api/v1/invoices/${testInvoice.id}`, {
        headers: {
          Authorization: `Bearer ${tenant1Token}`
        }
      });
      const invCheck = (await invCheckRes.json()) as any;
      assert.equal(invCheck.data.status, 'PAID');
      assert.equal(invCheck.data.outstanding_amount, 0);
    });

    it('1.5 Idempotency: Duplicate webhook with same reference is safely skipped', async () => {
      // Send the exact same webhook payload as 1.4
      const res = await fetch(`${baseUrl}/api/v1/payments/vietqr/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processedWebhookPayload)
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.equal(body.data.processedCount, 0);
      assert.equal(body.data.transactions[0].status, 'SKIPPED_ALREADY_PROCESSED');
      assert.equal(body.data.transactions[0].reference, processedRefCode);
    });
  });

  // ==========================================
  // PART 2: Zalo ZNS Notifications & RBAC
  // ==========================================
  describe('Zalo ZNS Multichannel Notifications & RBAC', () => {
    it('2.1 Owner can dispatch Zalo ZNS notification to resident', async () => {
      const res = await fetch(`${baseUrl}/api/v1/notifications/send-zalo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`
        },
        body: JSON.stringify({
          userId: 'usr_tnt_1',
          type: 'PAYMENT_REMINDER',
          title: 'Nhắc hạn đóng tiền phòng tháng 12',
          message: 'Hóa đơn tháng 12 của bạn sẽ đến hạn vào ngày 05/12.',
          entityType: 'INVOICE',
          entityId: 'inv_test'
        })
      });

      assert.equal(res.status, 201);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.equal(body.data.channel, 'ZALO_ZNS');
      assert.equal(body.data.user_id, 'usr_tnt_1');
    });

    it('2.2 Security: Tenant cannot dispatch broadcast ZNS notifications (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/notifications/send-zalo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant1Token}`
        },
        body: JSON.stringify({
          userId: 'usr_tnt_2',
          title: 'Spam',
          message: 'Spam content'
        })
      });

      assert.equal(res.status, 403);
      const body = (await res.json()) as any;
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'FORBIDDEN');
    });
  });

  // ==========================================
  // PART 3: Electronic Contract Signing (E-Signature)
  // ==========================================
  describe('Electronic Contract Signing & Legal Evidence', () => {
    let pendingContractId: string;

    it('3.1 Owner creates a contract in PENDING status for Tenant 1', async () => {
      const res = await fetch(`${baseUrl}/api/v1/contracts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`
        },
        body: JSON.stringify({
          roomId: 'rm_bld1_401',
          tenantId: 'usr_tnt_1',
          startDate: '2026-10-01',
          endDate: '2027-10-01',
          rentAmount: 8500000,
          depositAmount: 8500000,
          status: 'PENDING',
          terms: 'Standard 1-year apartment lease agreement.'
        })
      });

      assert.equal(res.status, 201);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      pendingContractId = body.data.id;
      assert.equal(body.data.status, 'PENDING');
    });

    it('3.2 Tenant 1 requests OTP for electronic contract signing', async () => {
      const res = await fetch(`${baseUrl}/api/v1/contracts/${pendingContractId}/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant1Token}`
        },
        body: JSON.stringify({ channel: 'ZALO' })
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      assert.ok(body.data.otpCode, 'OTP code should be generated and returned in test mode');
      assert.equal(body.data.expiresInSeconds, 600);
    });

    it('3.3 Security: Tenant 2 cannot sign Tenant 1 contract (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/contracts/${pendingContractId}/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant2Token}`
        },
        body: JSON.stringify({
          signingMethod: 'CANVAS_DRAW',
          signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        })
      });

      assert.equal(res.status, 403);
      const body = (await res.json()) as any;
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'FORBIDDEN');
    });

    it('3.4 Tenant 1 signing with wrong OTP returns 400 INVALID_OTP', async () => {
      const res = await fetch(`${baseUrl}/api/v1/contracts/${pendingContractId}/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant1Token}`
        },
        body: JSON.stringify({
          signingMethod: 'OTP',
          otpCode: '000000' // wrong OTP
        })
      });

      assert.equal(res.status, 400);
      const body = (await res.json()) as any;
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'INVALID_OTP');
    });

    it('3.5 Tenant 1 signs contract with Canvas drawing successfully', async () => {
      const sampleSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA' +
        'AAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO' +
        '9TXL0Y4OHwAAAABJRU5ErkJggg==';

      const res = await fetch(`${baseUrl}/api/v1/contracts/${pendingContractId}/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant1Token}`
        },
        body: JSON.stringify({
          signingMethod: 'CANVAS_DRAW',
          signatureData: sampleSignature
        })
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      const contract = body.data.contract;
      const evidence = body.data.evidence;

      assert.equal(contract.status, 'ACTIVE');
      assert.equal(contract.signing_method, 'CANVAS_DRAW');
      assert.ok(contract.signed_at);
      assert.ok(evidence.evidenceHash);
      assert.equal(evidence.signingMethod, 'CANVAS_DRAW');

      // Verify room status changed to OCCUPIED
      const roomRes = await fetch(`${baseUrl}/api/v1/rooms/rm_bld1_401`);
      const roomBody = (await roomRes.json()) as any;
      assert.equal(roomBody.data.status, 'OCCUPIED');
    });

    it('3.6 Re-signing an already ACTIVE contract is prevented (409 Conflict)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/contracts/${pendingContractId}/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant1Token}`
        },
        body: JSON.stringify({
          signingMethod: 'CANVAS_DRAW',
          signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA'
        })
      });

      assert.equal(res.status, 409);
      const body = (await res.json()) as any;
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'CONTRACT_ALREADY_SIGNED');
    });

    it('3.7 Tenant 1 retrieves legal E-Signature evidence certificate', async () => {
      const res = await fetch(`${baseUrl}/api/v1/contracts/${pendingContractId}/evidence`, {
        headers: {
          Authorization: `Bearer ${tenant1Token}`
        }
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as any;
      assert.equal(body.success, true);
      const cert = body.data;

      assert.equal(cert.contractId, pendingContractId);
      assert.equal(cert.status, 'ACTIVE');
      assert.equal(cert.signingMethod, 'CANVAS_DRAW');
      assert.ok(cert.evidence.evidenceHash);
      assert.ok(cert.signatureData);
    });
  });
});
