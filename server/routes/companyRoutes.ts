import { Router } from 'express';
import { CompanyService } from '../services/companyService.js';
import { CompanyRepository } from '../db/repositories/companyRepository.js';
import { sendSuccess, sendError } from '../utils/responseHelper.js';
import { authenticate, AuthenticatedRequest } from '../middleware/authMiddleware.js';

export const companyRouter = Router();

// GET /api/v1/companies/:id
companyRouter.get('/:id', authenticate, (req: AuthenticatedRequest, res) => {
  const company = CompanyRepository.findById(req.params.id);
  if (!company) {
    return sendError(res, 'COMPANY_NOT_FOUND', 'Company not found', 404);
  }

  if (!CompanyService.verifyCompanyAccess(req.user!, req.params.id)) {
    return sendError(res, 'FORBIDDEN_COMPANY_ACCESS', 'You do not have access to this company', 403);
  }

  return sendSuccess(res, company);
});

// GET /api/v1/companies/:id/staff
companyRouter.get('/:id/staff', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const staff = CompanyService.getCompanyStaff(req.user!, req.params.id);
    return sendSuccess(res, staff);
  } catch (error: any) {
    return sendError(res, 'FORBIDDEN', error.message, 403);
  }
});

// POST /api/v1/companies/:id/staff
companyRouter.post('/:id/staff', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { email, password, fullName, phone } = req.body;
    if (!email || !password || !fullName) {
      return sendError(res, 'VALIDATION_ERROR', 'Email, password, and fullName are required', 400);
    }

    const result = await CompanyService.createStaff(req.user!, req.params.id, {
      email,
      password,
      fullName,
      phone
    });

    const { password_hash, ...safeUser } = result.user;
    return sendSuccess(res, {
      user: safeUser,
      membership: result.membership
    }, 201);
  } catch (error: any) {
    if (error.message === 'EMAIL_EXISTS') {
      return sendError(res, 'EMAIL_EXISTS', 'Email address is already in use', 409);
    }
    if (error.message === 'FORBIDDEN_NOT_COMPANY_ADMIN') {
      return sendError(res, 'FORBIDDEN', 'Only company administrators can create staff', 403);
    }
    return sendError(res, 'CREATE_STAFF_FAILED', error.message, 500);
  }
});
