import crypto from 'node:crypto';
import { withTransaction } from '../db/connection.js';
import { BillingRepository, MeterReadingRow, InvoiceRow, InvoiceItemRow, PaymentRow } from '../db/repositories/billingRepository.js';
import { BuildingRepository } from '../db/repositories/buildingRepository.js';
import { RentalRepository } from '../db/repositories/rentalRepository.js';
import { NotificationRepository } from '../db/repositories/notificationRepository.js';
import { AuditRepository } from '../db/repositories/auditRepository.js';
import { TokenPayload } from './authService.js';
import { CompanyService } from './companyService.js';
import { ZaloService } from './zaloService.js';

export class BillingService {
  /**
   * Record Meter Reading
   * Validates that reading_value >= previous_reading
   */
  static recordMeterReading(
    auth: TokenPayload,
    meterId: string,
    readingValue: number,
    readingDate: string,
    notes?: string
  ): MeterReadingRow {
    const meter = BillingRepository.findMeterById(meterId);
    if (!meter) throw new Error('METER_NOT_FOUND');

    const previousReading = meter.current_reading;
    if (readingValue < previousReading) {
      throw new Error(`INVALID_READING_VALUE: New reading (${readingValue}) cannot be lower than previous reading (${previousReading})`);
    }

    const consumption = readingValue - previousReading;
    const readingId = 'mr_' + crypto.randomUUID().substring(0, 8);

    const reading = BillingRepository.recordMeterReading({
      id: readingId,
      meter_id: meterId,
      previous_reading: previousReading,
      reading_value: readingValue,
      consumption,
      reading_date: readingDate,
      recorded_by: auth.userId,
      notes: notes || null
    });

    return reading;
  }

  /**
   * Generate Invoice based on:
   * - Active contract rent
   * - Latest meter readings (electricity & water)
   * - Effective building configurations for the billing date
   */
  static generateMonthlyInvoice(
    auth: TokenPayload,
    data: {
      contractId: string;
      billingMonth: string; // e.g. '2026-09'
      dueDate?: string;
      electricityConsumption?: number;
      waterConsumption?: number;
      includeInternet?: boolean;
      includeGarbage?: boolean;
      motorbikeCount?: number;
      carCount?: number;
      includeCleaning?: boolean;
      discount?: number;
      taxPercent?: number;
      notes?: string;
    }
  ): InvoiceRow {
    const contract = RentalRepository.findContractById(data.contractId);
    if (!contract) throw new Error('CONTRACT_NOT_FOUND');

    if (!CompanyService.verifyCompanyAccess(auth, contract.company_id)) {
      throw new Error('FORBIDDEN_COMPANY_ACCESS');
    }

    const room = BuildingRepository.findRoomById(contract.room_id);
    if (!room) throw new Error('ROOM_NOT_FOUND');

    const now = new Date();
    const issueDate = now.toISOString().split('T')[0];

    // Default due date: 10 days after issue
    const dueObj = new Date(now);
    dueObj.setDate(dueObj.getDate() + 10);
    const dueDate = data.dueDate || dueObj.toISOString().split('T')[0];

    // Fetch active configuration for the building at the billing issue date (Effective date versioning!)
    const activeConfig = BuildingRepository.getActiveConfigurationForDate(room.building_id, issueDate);
    const elecPrice = activeConfig?.electricity_unit_price ?? 3500;
    const waterPrice = activeConfig?.water_unit_price ?? 15000;
    const netPrice = activeConfig?.internet_price ?? 100000;
    const garbagePrice = activeConfig?.garbage_price ?? 50000;
    const motoFee = activeConfig?.parking_fee_motorbike ?? 100000;
    const carFee = activeConfig?.parking_fee_car ?? 800000;
    const cleanFee = activeConfig?.cleaning_fee ?? 150000;

    const items: InvoiceItemRow[] = [];
    let subtotal = 0;

    // 1. Rent Item
    const rentItem: InvoiceItemRow = {
      id: 'item_' + crypto.randomUUID().substring(0, 8),
      invoice_id: '',
      type: 'RENT',
      description: `Monthly Room Rent - Room ${room.room_number} (${data.billingMonth})`,
      quantity: 1,
      unit_price: contract.rent_amount,
      amount: contract.rent_amount,
      metadata: JSON.stringify({ contractNumber: contract.contract_number, roomNumber: room.room_number })
    };
    items.push(rentItem);
    subtotal += rentItem.amount;

    // 2. Electricity (if provided or query meter)
    let elecUsage = data.electricityConsumption;
    if (elecUsage === undefined) {
      // Find electricity meter
      const meters = BillingRepository.findMetersByRoom(room.id);
      const elecMeter = meters.find(m => m.type === 'ELECTRICITY');
      if (elecMeter) {
        const readings = BillingRepository.findReadingsByMeter(elecMeter.id, 1);
        elecUsage = readings.length > 0 ? readings[0].consumption : 0;
      } else {
        elecUsage = 0;
      }
    }

    if (elecUsage > 0) {
      const elecAmt = elecUsage * elecPrice;
      items.push({
        id: 'item_' + crypto.randomUUID().substring(0, 8),
        invoice_id: '',
        type: 'ELECTRICITY',
        description: `Electricity (${elecUsage} kWh @ ${elecPrice.toLocaleString()} VND/kWh)`,
        quantity: elecUsage,
        unit_price: elecPrice,
        amount: elecAmt,
        metadata: JSON.stringify({ consumption: elecUsage, unitPrice: elecPrice, configId: activeConfig?.id })
      });
      subtotal += elecAmt;
    }

    // 3. Water
    let waterUsage = data.waterConsumption;
    if (waterUsage === undefined) {
      const meters = BillingRepository.findMetersByRoom(room.id);
      const waterMeter = meters.find(m => m.type === 'WATER');
      if (waterMeter) {
        const readings = BillingRepository.findReadingsByMeter(waterMeter.id, 1);
        waterUsage = readings.length > 0 ? readings[0].consumption : 0;
      } else {
        waterUsage = 0;
      }
    }

    if (waterUsage > 0) {
      const waterAmt = waterUsage * waterPrice;
      items.push({
        id: 'item_' + crypto.randomUUID().substring(0, 8),
        invoice_id: '',
        type: 'WATER',
        description: `Water Supply (${waterUsage} m³ @ ${waterPrice.toLocaleString()} VND/m³)`,
        quantity: waterUsage,
        unit_price: waterPrice,
        amount: waterAmt,
        metadata: JSON.stringify({ consumption: waterUsage, unitPrice: waterPrice, configId: activeConfig?.id })
      });
      subtotal += waterAmt;
    }

    // 4. Internet
    if (data.includeInternet !== false) {
      items.push({
        id: 'item_' + crypto.randomUUID().substring(0, 8),
        invoice_id: '',
        type: 'INTERNET',
        description: 'High-speed Fiber Internet Fee',
        quantity: 1,
        unit_price: netPrice,
        amount: netPrice,
        metadata: JSON.stringify({ unitPrice: netPrice })
      });
      subtotal += netPrice;
    }

    // 5. Garbage
    if (data.includeGarbage !== false) {
      items.push({
        id: 'item_' + crypto.randomUUID().substring(0, 8),
        invoice_id: '',
        type: 'GARBAGE',
        description: 'Waste Collection & Environmental Sanitation Fee',
        quantity: 1,
        unit_price: garbagePrice,
        amount: garbagePrice,
        metadata: JSON.stringify({ unitPrice: garbagePrice })
      });
      subtotal += garbagePrice;
    }

    // 6. Motorbike Parking
    if (data.motorbikeCount && data.motorbikeCount > 0) {
      const motoAmt = data.motorbikeCount * motoFee;
      items.push({
        id: 'item_' + crypto.randomUUID().substring(0, 8),
        invoice_id: '',
        type: 'PARKING',
        description: `Motorbike Parking (${data.motorbikeCount} vehicle${data.motorbikeCount > 1 ? 's' : ''})`,
        quantity: data.motorbikeCount,
        unit_price: motoFee,
        amount: motoAmt,
        metadata: JSON.stringify({ vehicleType: 'MOTORBIKE', count: data.motorbikeCount })
      });
      subtotal += motoAmt;
    }

    // 7. Car Parking
    if (data.carCount && data.carCount > 0) {
      const carAmt = data.carCount * carFee;
      items.push({
        id: 'item_' + crypto.randomUUID().substring(0, 8),
        invoice_id: '',
        type: 'PARKING',
        description: `Car Parking Lot (${data.carCount} vehicle${data.carCount > 1 ? 's' : ''})`,
        quantity: data.carCount,
        unit_price: carFee,
        amount: carAmt,
        metadata: JSON.stringify({ vehicleType: 'CAR', count: data.carCount })
      });
      subtotal += carAmt;
    }

    // 8. Cleaning
    if (data.includeCleaning) {
      items.push({
        id: 'item_' + crypto.randomUUID().substring(0, 8),
        invoice_id: '',
        type: 'CLEANING',
        description: 'Common Area Cleaning & Maintenance Service',
        quantity: 1,
        unit_price: cleanFee,
        amount: cleanFee,
        metadata: JSON.stringify({ unitPrice: cleanFee })
      });
      subtotal += cleanFee;
    }

    const discount = data.discount || 0;
    const taxPercent = data.taxPercent || 0;
    const taxable = Math.max(0, subtotal - discount);
    const tax = Math.round(taxable * (taxPercent / 100));
    const total = taxable + tax;

    const invoiceId = 'inv_' + crypto.randomUUID().substring(0, 8);
    const suffix = crypto.randomUUID().substring(0, 4).toUpperCase();
    const invoiceNumber = `INV-${room.room_number}-${data.billingMonth.replace('-', '')}-${suffix}`;

    return withTransaction(() => {
      const invoice = BillingRepository.createInvoiceWithItems(
        {
          id: invoiceId,
          invoice_number: invoiceNumber,
          tenant_id: contract.tenant_id,
          contract_id: contract.id,
          company_id: contract.company_id,
          room_id: room.id,
          issue_date: issueDate,
          due_date: dueDate,
          billing_month: data.billingMonth,
          subtotal,
          discount,
          tax,
          total,
          paid_amount: 0,
          outstanding_amount: total,
          status: 'ISSUED',
          notes: data.notes || `Invoice for billing period ${data.billingMonth}`
        },
        items
      );

      // Notify tenant
      NotificationRepository.create({
        id: 'notif_' + crypto.randomUUID().substring(0, 8),
        user_id: contract.tenant_id,
        type: 'INVOICE_ISSUED',
        title: `New Invoice Issued: ${invoiceNumber}`,
        message: `Your monthly invoice for ${data.billingMonth} totaling ${total.toLocaleString()} VND is due on ${dueDate}.`,
        entity_type: 'INVOICE',
        entity_id: invoiceId
      });

      // Audit Log
      AuditRepository.create({
        id: 'aud_' + crypto.randomUUID().substring(0, 8),
        actor_id: auth.userId,
        action: 'ISSUE_INVOICE',
        entity_type: 'INVOICE',
        entity_id: invoiceId,
        old_value: null,
        new_value: JSON.stringify({ invoiceNumber, total, billingMonth: data.billingMonth, tenantId: contract.tenant_id })
      });

      return invoice;
    });
  }

  /**
   * Process Payment Transaction (Financial Transaction Integrity)
   * Atomic operation updating payment record, invoice balances, status, and audit log.
   */
  static processPayment(
    auth: TokenPayload,
    data: {
      invoiceId: string;
      amount: number;
      method: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'ONLINE' | 'OTHER';
      transactionReference?: string;
      notes?: string;
    }
  ): { payment: PaymentRow; invoice: InvoiceRow } {
    const invoice = BillingRepository.findInvoiceById(data.invoiceId);
    if (!invoice) throw new Error('INVOICE_NOT_FOUND');

    // Verification: Tenant paying their own invoice, OR Company Admin/Staff recording payment
    const isTenant = auth.userId === invoice.tenant_id;
    const isCompanyStaff = CompanyService.verifyCompanyAccess(auth, invoice.company_id);

    if (!isTenant && !isCompanyStaff && auth.role !== 'SUPER_ADMIN') {
      throw new Error('FORBIDDEN_PAYMENT_OPERATION');
    }

    if (data.amount <= 0) {
      throw new Error('INVALID_PAYMENT_AMOUNT: Amount must be greater than 0');
    }

    const paymentId = 'pay_' + crypto.randomUUID().substring(0, 8);
    const now = new Date().toISOString();
    const reference = data.transactionReference || `TX-${Date.now().toString(36).toUpperCase()}-${paymentId.slice(-4).toUpperCase()}`;

    const result = BillingRepository.createPaymentTransaction(
      {
        id: paymentId,
        invoice_id: data.invoiceId,
        tenant_id: invoice.tenant_id,
        company_id: invoice.company_id,
        amount: data.amount,
        method: data.method,
        status: 'SUCCESS',
        transaction_reference: reference,
        paid_at: now,
        notes: data.notes || `Payment via ${data.method} - Ref: ${reference}`
      },
      auth.userId
    );

    // Notify tenant of payment confirmation
    NotificationRepository.create({
      id: 'notif_' + crypto.randomUUID().substring(0, 8),
      user_id: invoice.tenant_id,
      type: 'PAYMENT_RECEIVED',
      title: 'Payment Successful',
      message: `Payment of ${data.amount.toLocaleString()} VND received for invoice ${invoice.invoice_number}. New balance: ${result.invoice.outstanding_amount.toLocaleString()} VND.`,
      entity_type: 'PAYMENT',
      entity_id: paymentId
    });

    return result;
  }

  /**
   * Automatic or On-demand Debt Reconciliation:
   * Scans for past-due unpaid or partially-paid invoices and marks them as OVERDUE.
   */
  static reconcileDebt(
    auth: TokenPayload,
    options?: { companyId?: string; asOfDate?: string }
  ): { updatedCount: number; invoiceIds: string[] } {
    const companyId = options?.companyId || auth.memberships[0]?.companyId;
    if (companyId && !CompanyService.verifyCompanyAccess(auth, companyId)) {
      throw new Error('FORBIDDEN_COMPANY_ACCESS');
    }

    const result = BillingRepository.reconcileOverdueInvoices(
      auth.role === 'SUPER_ADMIN' ? options?.companyId : companyId,
      options?.asOfDate
    );

    if (result.updatedCount > 0) {
      AuditRepository.create({
        id: 'aud_' + crypto.randomUUID().substring(0, 8),
        actor_id: auth.userId,
        actor_email: auth.email,
        action: 'RECONCILE_OVERDUE_INVOICES',
        entity_type: 'INVOICE',
        entity_id: result.invoiceIds.join(','),
        new_value: JSON.stringify({ count: result.updatedCount, asOfDate: options?.asOfDate })
      });
    }

    return result;
  }

  /**
   * Get VietQR NAPAS 247 Dynamic Payment Info for an Invoice
   */
  static getVietQRInfo(invoiceId: string) {
    const invoice = BillingRepository.findInvoiceById(invoiceId);
    if (!invoice) throw new Error('INVOICE_NOT_FOUND');

    const bankId = process.env.VIETQR_BANK_ID || 'MB';
    const bankName = process.env.VIETQR_BANK_NAME || 'Ngân hàng Quân Đội (MBBank)';
    const accountNo = process.env.VIETQR_ACCOUNT_NO || '0905123456';
    const accountName = process.env.VIETQR_ACCOUNT_NAME || 'HOMTEL RESIDENTIAL DA NANG';

    const transferContent = `HOMTEL ${invoice.invoice_number}`;
    const amount = invoice.outstanding_amount;

    // Standard VietQR QuickLink (NAPAS 247 Compliant)
    const qrImageUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(accountName)}`;

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      billingMonth: invoice.billing_month,
      roomNumber: invoice.room_number,
      buildingName: invoice.building_name,
      amount,
      bankId,
      bankName,
      accountNo,
      accountName,
      transferContent,
      qrImageUrl,
      invoiceStatus: invoice.status,
      isFullyPaid: invoice.status === 'PAID' || invoice.outstanding_amount <= 0
    };
  }

  /**
   * VietQR Bank Transfer Webhook Auto-Reconciliation (SePay / Casso / VietQR format)
   * Automatically recognizes incoming bank transfers, creates payment record and clears debt.
   */
  static async processVietQRWebhook(
    payload: any,
    authHeader?: string
  ): Promise<{ success: boolean; processedCount: number; transactions: any[] }> {
    // 1. Verify Webhook Secret if configured
    const expectedSecret = process.env.VIETQR_WEBHOOK_SECRET || process.env.SEPAY_WEBHOOK_SECRET;
    if (expectedSecret && authHeader) {
      const cleanHeader = authHeader.replace(/^(Apikey|Bearer)\s+/i, '').trim();
      if (cleanHeader !== expectedSecret) {
        throw new Error('FORBIDDEN_INVALID_WEBHOOK_SECRET');
      }
    }

    // 2. Normalize transaction items (supports both SePay single object and Casso data array)
    const items: any[] = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
      ? payload
      : payload
      ? [payload]
      : [];

    const processedList: any[] = [];

    for (const item of items) {
      // Ignore outgoing transfer
      if (item.transferType === 'out' || item.type === 'OUT') {
        continue;
      }

      const content = String(item.content || item.description || '');
      const rawAmount = Number(item.transferAmount || item.amount || 0);
      const reference = String(item.referenceCode || item.tid || item.id || `TX_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);

      if (rawAmount <= 0) continue;

      // Idempotency: skip if transaction already processed
      const existingPay = BillingRepository.findPaymentByReference(reference);
      if (existingPay) {
        processedList.push({
          reference,
          status: 'SKIPPED_ALREADY_PROCESSED',
          paymentId: existingPay.id,
          invoiceId: existingPay.invoice_id
        });
        continue;
      }

      // 3. Extract Invoice Number or ID from transfer content
      // Matches INV-<room>-<month>-<suffix> or inv_<hex>
      const invMatch = content.match(/INV-[A-Za-z0-9-]+/) || content.match(/inv_[a-z0-9_]+/);
      let matchedInvoice: any = null;

      if (invMatch) {
        matchedInvoice = BillingRepository.findInvoiceByNumber(invMatch[0]) || BillingRepository.findInvoiceById(invMatch[0]);
      }

      // Fallback: If no invoice number matched in content, search by outstanding amount
      if (!matchedInvoice) {
        const candidateInvoices = BillingRepository.findAllInvoices({ status: 'ISSUED' });
        matchedInvoice = candidateInvoices.find(inv => inv.outstanding_amount === rawAmount);
      }

      if (!matchedInvoice) {
        processedList.push({
          reference,
          status: 'UNMATCHED_INVOICE',
          amount: rawAmount,
          content
        });
        continue;
      }

      // Check if invoice is already fully paid
      if (matchedInvoice.outstanding_amount <= 0 || matchedInvoice.status === 'PAID') {
        processedList.push({
          reference,
          status: 'INVOICE_ALREADY_PAID',
          invoiceId: matchedInvoice.id,
          invoiceNumber: matchedInvoice.invoice_number,
          amount: rawAmount
        });
        continue;
      }

      // 4. Process Payment Transaction Atomically
      const paymentAmount = Math.min(rawAmount, matchedInvoice.outstanding_amount);
      const result = BillingRepository.createPaymentTransaction(
        {
          id: 'pay_vqr_' + crypto.randomUUID().substring(0, 8),
          invoice_id: matchedInvoice.id,
          tenant_id: matchedInvoice.tenant_id,
          company_id: matchedInvoice.company_id,
          amount: paymentAmount,
          method: 'BANK_TRANSFER',
          status: 'SUCCESS',
          transaction_reference: reference,
          paid_at: item.transactionDate || item.when || new Date().toISOString(),
          notes: `VietQR Webhook auto-reconciled: ${reference} (${content})`
        },
        matchedInvoice.tenant_id
      );

      // 5. Send Zalo ZNS and In-App notification
      try {
        await ZaloService.sendZns(
          matchedInvoice.tenant_id,
          'PAYMENT_RECEIVED',
          'Xác nhận thanh toán thành công',
          `Hệ thống Homtel đã nhận thanh toán ${paymentAmount.toLocaleString()} VND qua VietQR cho hóa đơn ${matchedInvoice.invoice_number}. Số dư còn lại: ${result.invoice.outstanding_amount.toLocaleString()} VND.`,
          'PAYMENT',
          result.payment.id
        );
      } catch (e) {
        console.warn('Could not dispatch Zalo ZNS for payment:', e);
      }

      // 6. Record Audit Log
      AuditRepository.create({
        id: 'aud_' + crypto.randomUUID().substring(0, 8),
        actor_id: matchedInvoice.tenant_id,
        actor_email: 'vietqr-webhook@homtel.vn',
        action: 'VIETQR_AUTO_RECONCILE',
        entity_type: 'INVOICE',
        entity_id: matchedInvoice.id,
        new_value: JSON.stringify({
          reference,
          amount: paymentAmount,
          invoiceNumber: matchedInvoice.invoice_number,
          newStatus: result.invoice.status,
          outstanding: result.invoice.outstanding_amount
        })
      });

      processedList.push({
        reference,
        status: 'RECONCILED',
        invoiceId: matchedInvoice.id,
        invoiceNumber: matchedInvoice.invoice_number,
        paidAmount: paymentAmount,
        invoiceStatus: result.invoice.status,
        outstanding: result.invoice.outstanding_amount
      });
    }

    return {
      success: true,
      processedCount: processedList.filter(p => p.status === 'RECONCILED').length,
      transactions: processedList
    };
  }
}
