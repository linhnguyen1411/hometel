import { Router } from 'express';
import crypto from 'node:crypto';
import { ServiceRequestService } from '../services/serviceRequestService.js';
import { ServiceRepository } from '../db/repositories/serviceRepository.js';
import { sendSuccess, sendList, sendError } from '../utils/responseHelper.js';
import { authenticate, requireRole, optionalAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { CompanyService } from '../services/companyService.js';

export const serviceRouter = Router();

// ==========================================
// SERVICES CATALOG
// ==========================================

// GET /api/v1/services (Public catalog)
serviceRouter.get('/', optionalAuth, (req: AuthenticatedRequest, res) => {
  const companyId = req.query.companyId as string;
  const category = req.query.category as string;
  const status = req.query.status as string || 'ACTIVE';
  const search = req.query.search as string;

  const services = ServiceRepository.findAllServices({
    companyId,
    category,
    status: companyId ? undefined : status,
    search
  });

  return sendSuccess(res, services);
});

// GET /api/v1/services/slug/:slug
serviceRouter.get('/slug/:slug', (req, res) => {
  const service = ServiceRepository.findServiceBySlug(req.params.slug);
  if (!service) return sendError(res, 'SERVICE_NOT_FOUND', 'Service not found', 404);
  return sendSuccess(res, service);
});

// GET /api/v1/services/workload (Provider views staff workload)
serviceRouter.get('/workload', authenticate, (req: AuthenticatedRequest, res) => {
  const companyId = req.query.companyId as string || req.user!.memberships[0]?.companyId;
  if (!companyId) return sendError(res, 'VALIDATION_ERROR', 'companyId is required', 400);

  if (!CompanyService.verifyCompanyAccess(req.user!, companyId)) {
    return sendError(res, 'FORBIDDEN_COMPANY_ACCESS', 'Access denied to this company', 403);
  }

  const workload = ServiceRepository.getStaffWorkload(companyId);
  return sendSuccess(res, workload);
});

// POST /api/v1/services (Provider creates service)
serviceRouter.post('/', authenticate, requireRole('PROVIDER', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res) => {
  try {
    const { companyId, name, slug, description, category, priceType, basePrice, imageUrl } = req.body;
    if (!companyId || !name || !slug || !category) {
      return sendError(res, 'VALIDATION_ERROR', 'companyId, name, slug, and category are required', 400);
    }

    if (!CompanyService.verifyCompanyAccess(req.user!, companyId)) {
      return sendError(res, 'FORBIDDEN_COMPANY_ACCESS', 'Access denied to this company', 403);
    }

    const serviceId = 'srv_' + crypto.randomUUID().substring(0, 8);
    const service = ServiceRepository.createService({
      id: serviceId,
      company_id: companyId,
      name,
      slug: slug.toLowerCase(),
      description: description || null,
      category,
      price_type: priceType || 'FIXED',
      base_price: parseFloat(basePrice) || 0,
      image_url: imageUrl || null,
      status: 'ACTIVE'
    });

    return sendSuccess(res, service, 201);
  } catch (error: any) {
    return sendError(res, 'CREATE_SERVICE_FAILED', error.message, 500);
  }
});

// ==========================================
// SERVICE REQUESTS
// ==========================================

export const serviceRequestRouter = Router();

// POST /api/v1/service-requests (Tenant submits service request)
serviceRequestRouter.post('/', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const { serviceId, roomId, title, description, preferredDate, urgency } = req.body;
    if (!serviceId || !title || !description) {
      return sendError(res, 'VALIDATION_ERROR', 'serviceId, title, and description are required', 400);
    }

    const request = ServiceRequestService.createRequest(req.user!.userId, {
      serviceId,
      roomId,
      title,
      description,
      preferredDate,
      urgency
    });

    return sendSuccess(res, request, 201);
  } catch (error: any) {
    return sendError(res, 'CREATE_REQUEST_FAILED', error.message, 500);
  }
});

// GET /api/v1/service-requests
serviceRequestRouter.get('/', authenticate, (req: AuthenticatedRequest, res) => {
  const companyId = req.query.companyId as string;
  const status = req.query.status as string;
  const urgency = req.query.urgency as string;

  if (req.user!.role === 'TENANT') {
    const requests = ServiceRepository.findAllRequests({ tenantId: req.user!.userId, status, urgency });
    return sendSuccess(res, requests);
  }

  if (req.user!.role === 'STAFF') {
    const requests = ServiceRepository.findAllRequests({ staffId: req.user!.userId, status, urgency });
    return sendSuccess(res, requests);
  }

  if (companyId) {
    if (!CompanyService.verifyCompanyAccess(req.user!, companyId)) {
      return sendError(res, 'FORBIDDEN_COMPANY_ACCESS', 'Access denied to this company', 403);
    }
    const requests = ServiceRepository.findAllRequests({ providerCompanyId: companyId, status, urgency });
    return sendSuccess(res, requests);
  }

  if (req.user!.role === 'SUPER_ADMIN') {
    const requests = ServiceRepository.findAllRequests({ status, urgency });
    return sendSuccess(res, requests);
  }

  const firstCompany = req.user!.memberships[0]?.companyId;
  if (firstCompany) {
    const requests = ServiceRepository.findAllRequests({ providerCompanyId: firstCompany, status, urgency });
    return sendSuccess(res, requests);
  }

  return sendSuccess(res, []);
});

// GET /api/v1/service-requests/:id
serviceRequestRouter.get('/:id', authenticate, (req: AuthenticatedRequest, res) => {
  const request = ServiceRepository.findRequestById(req.params.id);
  if (!request) return sendError(res, 'REQUEST_NOT_FOUND', 'Service request not found', 404);

  return sendSuccess(res, request);
});

// POST /api/v1/service-requests/:id/review (Provider approves/rejects)
serviceRequestRouter.post('/:id/review', authenticate, requireRole('PROVIDER', 'STAFF', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res) => {
  try {
    const { action, rejectionReason, estimatedCost } = req.body;
    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
      return sendError(res, 'VALIDATION_ERROR', 'action must be APPROVE or REJECT', 400);
    }

    const updated = ServiceRequestService.reviewRequest(req.user!, req.params.id, action, {
      rejectionReason,
      estimatedCost: estimatedCost !== undefined ? parseFloat(estimatedCost) : undefined
    });

    return sendSuccess(res, updated);
  } catch (error: any) {
    return sendError(res, 'REVIEW_REQUEST_FAILED', error.message, 500);
  }
});

// POST /api/v1/service-requests/:id/assign (Provider assigns staff)
serviceRequestRouter.post('/:id/assign', authenticate, requireRole('PROVIDER', 'STAFF', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res) => {
  try {
    const { staffId, notes } = req.body;
    if (!staffId) return sendError(res, 'VALIDATION_ERROR', 'staffId is required', 400);

    const assignment = ServiceRequestService.assignStaff(req.user!, req.params.id, staffId, notes);
    return sendSuccess(res, assignment, 201);
  } catch (error: any) {
    return sendError(res, 'ASSIGN_STAFF_FAILED', error.message, 500);
  }
});

// POST /api/v1/service-requests/assignments/:assignmentId/status
serviceRequestRouter.post('/assignments/:assignmentId/status', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const { status, finalCost, notes } = req.body;
    if (!status || !['IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return sendError(res, 'VALIDATION_ERROR', 'valid status (IN_PROGRESS, COMPLETED, CANCELLED) is required', 400);
    }

    const assignment = ServiceRequestService.updateExecutionStatus(
      req.user!,
      req.params.assignmentId,
      status,
      {
        finalCost: finalCost !== undefined ? parseFloat(finalCost) : undefined,
        notes
      }
    );

    return sendSuccess(res, assignment);
  } catch (error: any) {
    return sendError(res, 'UPDATE_STATUS_FAILED', error.message, 500);
  }
});
