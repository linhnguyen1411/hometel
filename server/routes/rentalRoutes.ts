import { Router } from 'express';
import { RentalService } from '../services/rentalService.js';
import { RentalRepository } from '../db/repositories/rentalRepository.js';
import { sendSuccess, sendError } from '../utils/responseHelper.js';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { CompanyService } from '../services/companyService.js';

export const rentalRouter = Router();

// ==========================================
// RENTAL APPLICATIONS
// ==========================================

// POST /api/v1/rentals/applications (Tenant applies for a room)
rentalRouter.post('/applications', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const { roomId, intendedStartDate, leaseDurationMonths, occupantsCount, notes } = req.body;
    if (!roomId || !intendedStartDate) {
      return sendError(res, 'VALIDATION_ERROR', 'roomId and intendedStartDate are required', 400);
    }

    const application = RentalService.applyForRoom(req.user!.userId, {
      roomId,
      intendedStartDate,
      leaseDurationMonths: parseInt(leaseDurationMonths) || 12,
      occupantsCount: parseInt(occupantsCount) || 1,
      notes
    });

    return sendSuccess(res, application, 201);
  } catch (error: any) {
    if (error.message === 'ROOM_NOT_AVAILABLE') {
      return sendError(res, 'ROOM_NOT_AVAILABLE', 'This room is currently not available for application', 409);
    }
    return sendError(res, 'APPLICATION_FAILED', error.message, 500);
  }
});

// GET /api/v1/rentals/applications (List applications)
rentalRouter.get('/applications', authenticate, (req: AuthenticatedRequest, res) => {
  const companyId = req.query.companyId as string;
  const status = req.query.status as string;

  // If user is a tenant, restrict to their applications only
  if (req.user!.role === 'TENANT') {
    const apps = RentalRepository.findAllApplications({ tenantId: req.user!.userId, status });
    return sendSuccess(res, apps);
  }

  // If owner/staff, must provide companyId and have access
  if (companyId) {
    if (!CompanyService.verifyCompanyAccess(req.user!, companyId)) {
      return sendError(res, 'FORBIDDEN_COMPANY_ACCESS', 'Access denied to this company', 403);
    }
    const apps = RentalRepository.findAllApplications({ companyId, status });
    return sendSuccess(res, apps);
  }

  // Super admin can list all
  if (req.user!.role === 'SUPER_ADMIN') {
    const apps = RentalRepository.findAllApplications({ status });
    return sendSuccess(res, apps);
  }

  // Fallback: search across user's companies
  const firstCompany = req.user!.memberships[0]?.companyId;
  if (firstCompany) {
    const apps = RentalRepository.findAllApplications({ companyId: firstCompany, status });
    return sendSuccess(res, apps);
  }

  return sendSuccess(res, []);
});

// POST /api/v1/rentals/applications/:id/review (Owner/Staff approves/rejects)
rentalRouter.post('/applications/:id/review', authenticate, requireRole('OWNER', 'STAFF', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res) => {
  try {
    const { action, rejectionReason, autoCreateContract, startDate, endDate, rentAmount, depositAmount } = req.body;
    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
      return sendError(res, 'VALIDATION_ERROR', 'action must be APPROVE or REJECT', 400);
    }

    const result = RentalService.reviewApplication(req.user!, req.params.id, action, {
      rejectionReason,
      autoCreateContract: autoCreateContract !== false, // default true on approve
      startDate,
      endDate,
      rentAmount: rentAmount ? parseFloat(rentAmount) : undefined,
      depositAmount: depositAmount ? parseFloat(depositAmount) : undefined
    });

    return sendSuccess(res, result);
  } catch (error: any) {
    if (error.message === 'APPLICATION_ALREADY_REVIEWED') {
      return sendError(res, 'ALREADY_REVIEWED', 'This application has already been reviewed', 409);
    }
    return sendError(res, 'REVIEW_FAILED', error.message, 500);
  }
});

// ==========================================
// RENTAL CONTRACTS
// ==========================================

export const contractRouter = Router();

// GET /api/v1/contracts/active (Tenant's current active rental)
contractRouter.get('/active', authenticate, (req: AuthenticatedRequest, res) => {
  const contract = RentalRepository.findActiveContractForTenant(req.user!.userId);
  if (!contract) {
    return sendSuccess(res, null);
  }

  const deposit = RentalRepository.findDepositByContract(contract.id);
  return sendSuccess(res, {
    ...contract,
    deposit
  });
});

// GET /api/v1/contracts
contractRouter.get('/', authenticate, (req: AuthenticatedRequest, res) => {
  const companyId = req.query.companyId as string;
  const status = req.query.status as string;
  const search = req.query.search as string;

  if (req.user!.role === 'TENANT') {
    const contracts = RentalRepository.findAllContracts({ tenantId: req.user!.userId, status, search });
    return sendSuccess(res, contracts);
  }

  if (companyId) {
    if (!CompanyService.verifyCompanyAccess(req.user!, companyId)) {
      return sendError(res, 'FORBIDDEN_COMPANY_ACCESS', 'Access denied to this company', 403);
    }
    const contracts = RentalRepository.findAllContracts({ companyId, status, search });
    return sendSuccess(res, contracts);
  }

  if (req.user!.role === 'SUPER_ADMIN') {
    const contracts = RentalRepository.findAllContracts({ status, search });
    return sendSuccess(res, contracts);
  }

  const firstCompany = req.user!.memberships[0]?.companyId;
  if (firstCompany) {
    const contracts = RentalRepository.findAllContracts({ companyId: firstCompany, status, search });
    return sendSuccess(res, contracts);
  }

  return sendSuccess(res, []);
});

// GET /api/v1/contracts/:id
contractRouter.get('/:id', authenticate, (req: AuthenticatedRequest, res) => {
  const contract = RentalRepository.findContractById(req.params.id);
  if (!contract) return sendError(res, 'CONTRACT_NOT_FOUND', 'Contract not found', 404);

  // Tenant can view their own; company member can view their company's
  if (req.user!.role === 'TENANT' && contract.tenant_id !== req.user!.userId) {
    return sendError(res, 'FORBIDDEN', 'Access denied', 403);
  }
  if (req.user!.role !== 'TENANT' && !CompanyService.verifyCompanyAccess(req.user!, contract.company_id)) {
    return sendError(res, 'FORBIDDEN', 'Access denied to this company contract', 403);
  }

  const deposit = RentalRepository.findDepositByContract(contract.id);
  return sendSuccess(res, {
    ...contract,
    deposit
  });
});

// POST /api/v1/contracts (Direct contract creation by owner/staff)
contractRouter.post('/', authenticate, requireRole('OWNER', 'STAFF', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res) => {
  try {
    const { roomId, tenantId, startDate, endDate, rentAmount, depositAmount, paymentFrequency, paymentDayOfMonth, status, terms } = req.body;
    if (!roomId || !tenantId || !startDate || !endDate || rentAmount === undefined) {
      return sendError(res, 'VALIDATION_ERROR', 'roomId, tenantId, startDate, endDate, and rentAmount are required', 400);
    }

    const contract = RentalService.createContractDirect(req.user!, {
      roomId,
      tenantId,
      startDate,
      endDate,
      rentAmount: parseFloat(rentAmount),
      depositAmount: depositAmount !== undefined ? parseFloat(depositAmount) : parseFloat(rentAmount),
      paymentFrequency: paymentFrequency || 'MONTHLY',
      paymentDayOfMonth: parseInt(paymentDayOfMonth) || 5,
      status: status || 'ACTIVE',
      terms
    });

    return sendSuccess(res, contract, 201);
  } catch (error: any) {
    return sendError(res, 'CREATE_CONTRACT_FAILED', error.message, 500);
  }
});

// POST /api/v1/contracts/:id/send-otp (Request OTP for signing contract)
contractRouter.post('/:id/send-otp', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { channel } = req.body || {};
    const result = await RentalService.sendSigningOtp(req.user!, req.params.id, channel);
    return sendSuccess(res, result);
  } catch (error: any) {
    if (error.message.includes('FORBIDDEN')) {
      return sendError(res, 'FORBIDDEN', error.message, 403);
    }
    if (error.message === 'CONTRACT_NOT_FOUND') {
      return sendError(res, 'CONTRACT_NOT_FOUND', 'Contract not found', 404);
    }
    if (error.message === 'CONTRACT_ALREADY_SIGNED') {
      return sendError(res, 'CONTRACT_ALREADY_SIGNED', 'Contract is already signed and active', 409);
    }
    return sendError(res, 'SEND_OTP_FAILED', error.message, 500);
  }
});

// POST /api/v1/contracts/:id/sign (Tenant E-Signs contract via Canvas or OTP)
contractRouter.post('/:id/sign', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { signingMethod, signatureData, otpCode } = req.body;
    if (!signingMethod || !['CANVAS_DRAW', 'OTP'].includes(signingMethod)) {
      return sendError(res, 'VALIDATION_ERROR', 'signingMethod must be CANVAS_DRAW or OTP', 400);
    }

    const signerIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const signerUserAgent = req.headers['user-agent'] || 'Unknown';

    const result = await RentalService.signContract(req.user!, req.params.id, {
      signingMethod,
      signatureData,
      otpCode,
      signerIp,
      signerUserAgent
    });

    return sendSuccess(res, result);
  } catch (error: any) {
    if (error.message.includes('FORBIDDEN')) {
      return sendError(res, 'FORBIDDEN', error.message, 403);
    }
    if (error.message === 'CONTRACT_NOT_FOUND') {
      return sendError(res, 'CONTRACT_NOT_FOUND', 'Contract not found', 404);
    }
    if (error.message === 'CONTRACT_ALREADY_SIGNED') {
      return sendError(res, 'CONTRACT_ALREADY_SIGNED', 'Contract is already active and signed', 409);
    }
    if (error.message === 'INVALID_OTP' || error.message === 'OTP_EXPIRED_OR_NOT_FOUND') {
      return sendError(res, error.message, 'Invalid or expired OTP code', 400);
    }
    if (error.message === 'INVALID_SIGNATURE_DATA') {
      return sendError(res, 'INVALID_SIGNATURE_DATA', 'Invalid canvas signature image data', 400);
    }
    return sendError(res, 'SIGN_CONTRACT_FAILED', error.message, 500);
  }
});

// GET /api/v1/contracts/:id/evidence (Retrieve legal audit evidence of e-signature)
contractRouter.get('/:id/evidence', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const evidence = RentalService.getContractEvidence(req.user!, req.params.id);
    return sendSuccess(res, evidence);
  } catch (error: any) {
    if (error.message.includes('FORBIDDEN')) {
      return sendError(res, 'FORBIDDEN', error.message, 403);
    }
    if (error.message === 'CONTRACT_NOT_FOUND') {
      return sendError(res, 'CONTRACT_NOT_FOUND', 'Contract not found', 404);
    }
    return sendError(res, 'GET_EVIDENCE_FAILED', error.message, 500);
  }
});
