import { Router } from 'express';
import { BillingService } from '../services/billingService.js';
import { BillingRepository } from '../db/repositories/billingRepository.js';
import { BuildingRepository } from '../db/repositories/buildingRepository.js';
import { RentalRepository } from '../db/repositories/rentalRepository.js';
import { sendSuccess, sendList, sendError } from '../utils/responseHelper.js';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { CompanyService } from '../services/companyService.js';

export const billingRouter = Router();

// ==========================================
// METERS & READINGS
// ==========================================

export const meterRouter = Router();

// GET /api/v1/meters/room/:roomId (Tenant can only view their active room, Owner/Staff can view their company rooms)
meterRouter.get('/room/:roomId', authenticate, (req: AuthenticatedRequest, res) => {
  const room = BuildingRepository.findRoomById(req.params.roomId);
  if (!room) return sendError(res, 'ROOM_NOT_FOUND', 'Room not found', 404);

  if (req.user!.role === 'TENANT') {
    const activeContract = RentalRepository.findActiveContractForTenant(req.user!.userId);
    if (!activeContract || activeContract.room_id !== req.params.roomId) {
      return sendError(res, 'FORBIDDEN', 'You do not have permission to view meters for this room', 403);
    }
  } else if (req.user!.role !== 'SUPER_ADMIN') {
    const building = BuildingRepository.findBuildingById(room.building_id);
    if (!building || !CompanyService.verifyCompanyAccess(req.user!, building.company_id)) {
      return sendError(res, 'FORBIDDEN_COMPANY_ACCESS', 'Access denied to this room', 403);
    }
  }

  const meters = BillingRepository.findMetersByRoom(req.params.roomId);
  const withReadings = meters.map(m => ({
    ...m,
    readings: BillingRepository.findReadingsByMeter(m.id, 5)
  }));
  return sendSuccess(res, withReadings);
});

// POST /api/v1/meters/readings (Record new reading - Only Owner/Staff/Super Admin)
meterRouter.post('/readings', authenticate, requireRole('OWNER', 'STAFF', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res) => {
  try {
    const { meterId, readingValue, readingDate, notes } = req.body;
    if (!meterId || readingValue === undefined || !readingDate) {
      return sendError(res, 'VALIDATION_ERROR', 'meterId, readingValue, and readingDate are required', 400);
    }

    const meter = BillingRepository.findMeterById(meterId);
    if (!meter) return sendError(res, 'METER_NOT_FOUND', 'Meter not found', 404);

    const room = BuildingRepository.findRoomById(meter.room_id);
    if (!room) return sendError(res, 'ROOM_NOT_FOUND', 'Room not found', 404);

    const building = BuildingRepository.findBuildingById(room.building_id);
    if (!building || !CompanyService.verifyCompanyAccess(req.user!, building.company_id)) {
      return sendError(res, 'FORBIDDEN_COMPANY_ACCESS', 'Access denied to record readings for this company property', 403);
    }

    const reading = BillingService.recordMeterReading(
      req.user!,
      meterId,
      parseFloat(readingValue),
      readingDate,
      notes
    );

    return sendSuccess(res, reading, 201);
  } catch (error: any) {
    if (error.message.includes('INVALID_READING_VALUE')) {
      return sendError(res, 'INVALID_READING_VALUE', error.message, 400);
    }
    return sendError(res, 'RECORD_READING_FAILED', error.message, 500);
  }
});

// ==========================================
// INVOICES
// ==========================================

export const invoiceRouter = Router();

// GET /api/v1/invoices
invoiceRouter.get('/', authenticate, (req: AuthenticatedRequest, res) => {
  const companyId = req.query.companyId as string;
  const status = req.query.status as string;
  const billingMonth = req.query.billingMonth as string;
  const search = req.query.search as string;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;

  if (req.user!.role === 'TENANT') {
    const invoices = BillingRepository.findAllInvoices({
      tenantId: req.user!.userId,
      status,
      billingMonth,
      search,
      limit: pageSize,
      offset: (page - 1) * pageSize
    });
    return sendSuccess(res, invoices);
  }

  if (companyId) {
    if (!CompanyService.verifyCompanyAccess(req.user!, companyId)) {
      return sendError(res, 'FORBIDDEN_COMPANY_ACCESS', 'Access denied to this company', 403);
    }
    const invoices = BillingRepository.findAllInvoices({
      companyId,
      status,
      billingMonth,
      search,
      limit: pageSize,
      offset: (page - 1) * pageSize
    });
    return sendSuccess(res, invoices);
  }

  if (req.user!.role === 'SUPER_ADMIN') {
    const invoices = BillingRepository.findAllInvoices({
      status,
      billingMonth,
      search,
      limit: pageSize,
      offset: (page - 1) * pageSize
    });
    return sendSuccess(res, invoices);
  }

  const firstCompany = req.user!.memberships[0]?.companyId;
  if (firstCompany) {
    const invoices = BillingRepository.findAllInvoices({
      companyId: firstCompany,
      status,
      billingMonth,
      search,
      limit: pageSize,
      offset: (page - 1) * pageSize
    });
    return sendSuccess(res, invoices);
  }

  return sendSuccess(res, []);
});

// GET /api/v1/invoices/:id
invoiceRouter.get('/:id', authenticate, (req: AuthenticatedRequest, res) => {
  const invoice = BillingRepository.findInvoiceById(req.params.id);
  if (!invoice) return sendError(res, 'INVOICE_NOT_FOUND', 'Invoice not found', 404);

  if (req.user!.role === 'TENANT' && invoice.tenant_id !== req.user!.userId) {
    return sendError(res, 'FORBIDDEN', 'Access denied to this invoice', 403);
  }
  if (req.user!.role !== 'TENANT' && !CompanyService.verifyCompanyAccess(req.user!, invoice.company_id)) {
    return sendError(res, 'FORBIDDEN', 'Access denied to this company invoice', 403);
  }

  const payments = BillingRepository.findPaymentsByInvoice(invoice.id);
  return sendSuccess(res, {
    ...invoice,
    payments
  });
});

// POST /api/v1/invoices/generate (Owner/Staff generates monthly invoice)
invoiceRouter.post('/generate', authenticate, requireRole('OWNER', 'STAFF', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res) => {
  try {
    const { contractId, billingMonth, dueDate, electricityConsumption, waterConsumption, includeInternet, includeGarbage, motorbikeCount, carCount, includeCleaning, discount, taxPercent, notes } = req.body;

    if (!contractId || !billingMonth) {
      return sendError(res, 'VALIDATION_ERROR', 'contractId and billingMonth are required', 400);
    }

    const invoice = BillingService.generateMonthlyInvoice(req.user!, {
      contractId,
      billingMonth,
      dueDate,
      electricityConsumption: electricityConsumption !== undefined ? parseFloat(electricityConsumption) : undefined,
      waterConsumption: waterConsumption !== undefined ? parseFloat(waterConsumption) : undefined,
      includeInternet,
      includeGarbage,
      motorbikeCount: motorbikeCount !== undefined ? parseInt(motorbikeCount) : undefined,
      carCount: carCount !== undefined ? parseInt(carCount) : undefined,
      includeCleaning,
      discount: discount ? parseFloat(discount) : 0,
      taxPercent: taxPercent ? parseFloat(taxPercent) : 0,
      notes
    });

    return sendSuccess(res, invoice, 201);
  } catch (error: any) {
    if (error.message.includes('FORBIDDEN')) {
      return sendError(res, 'FORBIDDEN', error.message, 403);
    }
    return sendError(res, 'GENERATE_INVOICE_FAILED', error.message, 500);
  }
});

// POST /api/v1/invoices/reconcile (Reconcile overdue debts)
invoiceRouter.post('/reconcile', authenticate, requireRole('OWNER', 'STAFF', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res) => {
  try {
    const { companyId, asOfDate } = req.body || {};
    const result = BillingService.reconcileDebt(req.user!, {
      companyId,
      asOfDate
    });
    return sendSuccess(res, result);
  } catch (error: any) {
    if (error.message.includes('FORBIDDEN')) {
      return sendError(res, 'FORBIDDEN', error.message, 403);
    }
    return sendError(res, 'RECONCILE_FAILED', error.message, 500);
  }
});

// ==========================================
// PAYMENTS
// ==========================================

export const paymentRouter = Router();

// POST /api/v1/payments (Process Payment with Atomic Balance Update)
paymentRouter.post('/', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const { invoiceId, amount, method, transactionReference, notes } = req.body;
    if (!invoiceId || amount === undefined || !method) {
      return sendError(res, 'VALIDATION_ERROR', 'invoiceId, amount, and method are required', 400);
    }

    const result = BillingService.processPayment(req.user!, {
      invoiceId,
      amount: parseFloat(amount),
      method,
      transactionReference,
      notes
    });

    return sendSuccess(res, result, 201);
  } catch (error: any) {
    if (error.message.includes('FORBIDDEN')) {
      return sendError(res, 'FORBIDDEN', error.message, 403);
    }
    if (error.message.includes('already fully paid')) {
      return sendError(res, 'ALREADY_PAID', error.message, 409);
    }
    return sendError(res, 'PAYMENT_FAILED', error.message, 500);
  }
});

// GET /api/v1/payments/vietqr/info/:invoiceId
paymentRouter.get('/vietqr/info/:invoiceId', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const invoice = BillingRepository.findInvoiceById(req.params.invoiceId);
    if (!invoice) return sendError(res, 'INVOICE_NOT_FOUND', 'Invoice not found', 404);

    if (req.user!.role === 'TENANT' && invoice.tenant_id !== req.user!.userId) {
      return sendError(res, 'FORBIDDEN', 'Access denied to this invoice', 403);
    }
    if (req.user!.role !== 'TENANT' && req.user!.role !== 'SUPER_ADMIN' && !CompanyService.verifyCompanyAccess(req.user!, invoice.company_id)) {
      return sendError(res, 'FORBIDDEN_COMPANY_ACCESS', 'Access denied to this company invoice', 403);
    }

    const vietQrInfo = BillingService.getVietQRInfo(req.params.invoiceId);
    return sendSuccess(res, vietQrInfo);
  } catch (error: any) {
    return sendError(res, 'VIETQR_INFO_FAILED', error.message, 500);
  }
});

// POST /api/v1/payments/vietqr/webhook & POST /api/v1/payments/webhook
const handleVietQRWebhook = async (req: any, res: any) => {
  try {
    const authHeader = (req.headers['x-api-key'] || req.headers['authorization']) as string | undefined;
    const result = await BillingService.processVietQRWebhook(req.body, authHeader);
    return sendSuccess(res, result);
  } catch (error: any) {
    if (error.message.includes('FORBIDDEN')) {
      return sendError(res, 'FORBIDDEN_INVALID_WEBHOOK_SECRET', error.message, 403);
    }
    return sendError(res, 'WEBHOOK_PROCESSING_FAILED', error.message, 500);
  }
};

paymentRouter.post('/vietqr/webhook', handleVietQRWebhook);
paymentRouter.post('/webhook', handleVietQRWebhook);

// GET /api/v1/payments (List payments)
paymentRouter.get('/', authenticate, (req: AuthenticatedRequest, res) => {
  const companyId = req.query.companyId as string;
  const status = req.query.status as string;

  if (req.user!.role === 'TENANT') {
    const payments = BillingRepository.findAllPayments({ tenantId: req.user!.userId, status });
    return sendSuccess(res, payments);
  }

  if (companyId) {
    if (!CompanyService.verifyCompanyAccess(req.user!, companyId)) {
      return sendError(res, 'FORBIDDEN_COMPANY_ACCESS', 'Access denied to this company', 403);
    }
    const payments = BillingRepository.findAllPayments({ companyId, status });
    return sendSuccess(res, payments);
  }

  if (req.user!.role === 'SUPER_ADMIN') {
    const payments = BillingRepository.findAllPayments({ status });
    return sendSuccess(res, payments);
  }

  const firstCompany = req.user!.memberships[0]?.companyId;
  if (firstCompany) {
    const payments = BillingRepository.findAllPayments({ companyId: firstCompany, status });
    return sendSuccess(res, payments);
  }

  return sendSuccess(res, []);
});
