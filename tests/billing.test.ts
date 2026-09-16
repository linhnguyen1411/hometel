import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestServer, createToken, testUsers } from './helpers.js';

describe('Billing & Financial Flow Integration Tests', () => {
  let baseUrl: string;
  let closeServer: () => Promise<void>;

  const ownerToken = createToken(testUsers.owner1);
  const otherOwnerToken = createToken(testUsers.owner2);
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

  it('Flow 1: Complete lifecycle — Invoice Generation -> Partial Payment -> Full Payment', async () => {
    // 1. Owner generates invoice for contract ctr_1 (Tenant 1)
    const genRes = await fetch(`${baseUrl}/api/v1/invoices/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        contractId: 'ctr_1',
        billingMonth: '2026-11',
        electricityConsumption: 100,
        waterConsumption: 10,
        includeInternet: true,
        includeGarbage: true
      })
    });

    assert.equal(genRes.status, 201, 'Invoice generation should return 201');
    const genBody = (await genRes.json()) as any;
    assert.equal(genBody.success, true);
    const invoice = genBody.data;

    assert.ok(invoice.id);
    assert.equal(invoice.status, 'ISSUED');
    assert.equal(invoice.paid_amount, 0);
    assert.ok(invoice.total > 0);
    assert.equal(invoice.outstanding_amount, invoice.total);

    const invoiceId = invoice.id;
    const initialTotal = invoice.total;

    // 2. Tenant 1 makes a PARTIAL payment (half of the total)
    const partialAmount = Math.floor(initialTotal / 2);
    const pay1Res = await fetch(`${baseUrl}/api/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`
      },
      body: JSON.stringify({
        invoiceId,
        amount: partialAmount,
        method: 'BANK_TRANSFER',
        transactionReference: 'TX_PARTIAL_001'
      })
    });

    assert.equal(pay1Res.status, 201, 'Partial payment should return 201');
    const pay1Body = (await pay1Res.json()) as any;
    assert.equal(pay1Body.success, true);

    const updatedInv1 = pay1Body.data.invoice;
    assert.equal(updatedInv1.status, 'PARTIALLY_PAID', 'Status should be PARTIALLY_PAID after partial payment');
    assert.equal(updatedInv1.paid_amount, partialAmount);
    assert.equal(updatedInv1.outstanding_amount, initialTotal - partialAmount);

    // 3. Tenant 1 completes FULL payment of remaining balance
    const remainingAmount = updatedInv1.outstanding_amount;
    const pay2Res = await fetch(`${baseUrl}/api/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`
      },
      body: JSON.stringify({
        invoiceId,
        amount: remainingAmount,
        method: 'BANK_TRANSFER',
        transactionReference: 'TX_FULL_002'
      })
    });

    assert.equal(pay2Res.status, 201, 'Remaining payment should return 201');
    const pay2Body = (await pay2Res.json()) as any;
    assert.equal(pay2Body.success, true);

    const updatedInv2 = pay2Body.data.invoice;
    assert.equal(updatedInv2.status, 'PAID', 'Status should transition to PAID when fully settled');
    assert.equal(updatedInv2.paid_amount, initialTotal);
    assert.equal(updatedInv2.outstanding_amount, 0, 'Outstanding amount should be 0');

    // 4. Overpayment/Duplicate payment check
    const overpayRes = await fetch(`${baseUrl}/api/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`
      },
      body: JSON.stringify({
        invoiceId,
        amount: 50000,
        method: 'CASH'
      })
    });
    assert.equal(overpayRes.status, 409, 'Payment against already paid invoice should return 409 Conflict');
  });

  it('Flow 2: Overdue Debt Reconciliation Flow', async () => {
    // 1. Owner generates an invoice with a due date in the past
    const genPastRes = await fetch(`${baseUrl}/api/v1/invoices/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        contractId: 'ctr_1',
        billingMonth: '2026-01',
        dueDate: '2026-01-10', // Past due date
        includeInternet: false,
        includeGarbage: false
      })
    });

    assert.equal(genPastRes.status, 201);
    const pastInv = (await genPastRes.json()).data;
    assert.equal(pastInv.status, 'ISSUED');

    // 2. Owner triggers debt reconciliation
    const reconRes = await fetch(`${baseUrl}/api/v1/invoices/reconcile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        companyId: 'cmp_own_1',
        asOfDate: '2026-01-15'
      })
    });

    assert.equal(reconRes.status, 200, 'Reconcile should return 200');
    const reconBody = (await reconRes.json()) as any;
    assert.equal(reconBody.success, true);
    assert.ok(reconBody.data.updatedCount >= 1, 'At least 1 invoice should have been marked overdue');
    assert.ok(reconBody.data.invoiceIds.includes(pastInv.id));

    // 3. Verify the invoice status is now OVERDUE
    const getInvRes = await fetch(`${baseUrl}/api/v1/invoices/${pastInv.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const retrievedInv = (await getInvRes.json()).data;
    assert.equal(retrievedInv.status, 'OVERDUE', 'Invoice status should be OVERDUE after reconciliation');
  });

  it('RBAC Tests: Unauthorized and Forbidden (403) enforcement', async () => {
    // 1. Tenant cannot generate invoices -> 403 Forbidden
    const tenantGenRes = await fetch(`${baseUrl}/api/v1/invoices/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`
      },
      body: JSON.stringify({ contractId: 'ctr_1', billingMonth: '2026-12' })
    });
    assert.equal(tenantGenRes.status, 403, 'Tenant generating invoice must be rejected with 403');

    // 2. Tenant cannot trigger debt reconciliation -> 403 Forbidden
    const tenantReconRes = await fetch(`${baseUrl}/api/v1/invoices/reconcile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`
      },
      body: JSON.stringify({ companyId: 'cmp_own_1' })
    });
    assert.equal(tenantReconRes.status, 403, 'Tenant reconciling debt must be rejected with 403');

    // 3. Tenant cannot record meter reading -> 403 Forbidden
    const tenantMeterRes = await fetch(`${baseUrl}/api/v1/meters/readings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`
      },
      body: JSON.stringify({
        meterId: 'mtr_elc_rm_bld1_101',
        readingValue: 9999,
        readingDate: '2026-09-16'
      })
    });
    assert.equal(tenantMeterRes.status, 403, 'Tenant recording meter reading must be rejected with 403');

    // 4. Other Owner (cmp_own_2) cannot generate invoice for cmp_own_1 contract -> 403 Forbidden
    const wrongOwnerGenRes = await fetch(`${baseUrl}/api/v1/invoices/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherOwnerToken}`
      },
      body: JSON.stringify({ contractId: 'ctr_1', billingMonth: '2026-12' })
    });
    assert.equal(wrongOwnerGenRes.status, 403, 'Owner of different company must be rejected with 403');

    // 5. Tenant 2 cannot pay Tenant 1 invoice -> 403 Forbidden
    // First, find or create an active invoice for Tenant 1
    const t1InvoicesRes = await fetch(`${baseUrl}/api/v1/invoices?status=ISSUED`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const t1Invoices = (await t1InvoicesRes.json()).data;
    if (t1Invoices.length > 0) {
      const targetInv = t1Invoices.find((i: any) => i.tenant_id === 'usr_tnt_1');
      if (targetInv) {
        const t2PayRes = await fetch(`${baseUrl}/api/v1/payments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tenant2Token}`
          },
          body: JSON.stringify({
            invoiceId: targetInv.id,
            amount: 500000,
            method: 'CASH'
          })
        });
        assert.equal(t2PayRes.status, 403, 'Tenant paying another tenant invoice must be rejected with 403');
      }
    }

    // 6. Unauthenticated request -> 401 Unauthorized
    const unauthRes = await fetch(`${baseUrl}/api/v1/invoices`);
    assert.equal(unauthRes.status, 401, 'Unauthenticated request must return 401');
  });
});
