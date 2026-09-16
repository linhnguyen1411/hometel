import { Router } from 'express';
import { SuperAdminService } from '../services/superAdminService.js';
import { sendSuccess, sendList, sendError } from '../utils/responseHelper.js';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { UserRepository } from '../db/repositories/userRepository.js';
import { CompanyRepository } from '../db/repositories/companyRepository.js';
import { AuditRepository } from '../db/repositories/auditRepository.js';

export const superAdminRouter = Router();

// Require Super Admin for all routes here
superAdminRouter.use(authenticate, requireRole('SUPER_ADMIN'));

// GET /api/v1/admin/stats
superAdminRouter.get('/stats', (req, res) => {
  try {
    const stats = SuperAdminService.getSystemStats();
    return sendSuccess(res, stats);
  } catch (error: any) {
    return sendError(res, 'STATS_ERROR', error.message, 500);
  }
});

// POST /api/v1/admin/owners (Atomic Owner Creation)
superAdminRouter.post('/owners', async (req: AuthenticatedRequest, res) => {
  try {
    const {
      email,
      password,
      fullName,
      phone,
      companyName,
      companyType,
      taxCode,
      businessRegistrationNumber,
      companyPhone,
      companyEmail,
      companyAddress
    } = req.body;

    if (!email || !password || !fullName || !companyName || !companyType) {
      return sendError(res, 'VALIDATION_ERROR', 'email, password, fullName, companyName, and companyType are required', 400);
    }

    const result = await SuperAdminService.createOwnerAtomic(
      {
        email,
        password,
        fullName,
        phone,
        companyName,
        companyType,
        taxCode,
        businessRegistrationNumber,
        companyPhone,
        companyEmail,
        companyAddress
      },
      req.user!.userId
    );

    const { password_hash, ...safeUser } = result.user;
    return sendSuccess(res, {
      user: safeUser,
      company: result.company,
      membership: result.membership
    }, 201);
  } catch (error: any) {
    if (error.message === 'EMAIL_EXISTS') {
      return sendError(res, 'EMAIL_EXISTS', 'Email address is already in use', 409);
    }
    return sendError(res, 'CREATE_OWNER_FAILED', error.message, 500);
  }
});

// POST /api/v1/admin/providers (Atomic Provider Creation)
superAdminRouter.post('/providers', async (req: AuthenticatedRequest, res) => {
  try {
    const {
      email,
      password,
      fullName,
      phone,
      companyName,
      companyType,
      taxCode,
      businessRegistrationNumber,
      companyPhone,
      companyEmail,
      companyAddress
    } = req.body;

    if (!email || !password || !fullName || !companyName || !companyType) {
      return sendError(res, 'VALIDATION_ERROR', 'email, password, fullName, companyName, and companyType are required', 400);
    }

    const result = await SuperAdminService.createProviderAtomic(
      {
        email,
        password,
        fullName,
        phone,
        companyName,
        companyType,
        taxCode,
        businessRegistrationNumber,
        companyPhone,
        companyEmail,
        companyAddress
      },
      req.user!.userId
    );

    const { password_hash, ...safeUser } = result.user;
    return sendSuccess(res, {
      user: safeUser,
      company: result.company,
      membership: result.membership
    }, 201);
  } catch (error: any) {
    if (error.message === 'EMAIL_EXISTS') {
      return sendError(res, 'EMAIL_EXISTS', 'Email address is already in use', 409);
    }
    return sendError(res, 'CREATE_PROVIDER_FAILED', error.message, 500);
  }
});

// GET /api/v1/admin/users
superAdminRouter.get('/users', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const role = req.query.role as string;
  const status = req.query.status as string;
  const search = req.query.search as string;

  const users = UserRepository.findAll({
    role,
    status,
    search,
    limit: pageSize,
    offset: (page - 1) * pageSize
  });
  const total = UserRepository.count({ role, status, search });

  return sendList(res, users, { page, pageSize, total });
});

// GET /api/v1/admin/companies
superAdminRouter.get('/companies', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const type = req.query.type as string;
  const status = req.query.status as string;
  const search = req.query.search as string;

  const companies = CompanyRepository.findAll({
    type,
    status,
    search,
    limit: pageSize,
    offset: (page - 1) * pageSize
  });
  const total = CompanyRepository.count({ type, status, search });

  return sendList(res, companies, { page, pageSize, total });
});

// GET /api/v1/admin/audit-logs
superAdminRouter.get('/audit-logs', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const entityType = req.query.entityType as string;
  const action = req.query.action as string;

  const logs = AuditRepository.findAll({
    limit,
    entityType,
    action
  });

  return sendSuccess(res, logs);
});
