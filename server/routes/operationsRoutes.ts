import { Router } from 'express';
import { authenticate, requireRole, optionalAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { sendSuccess, sendError } from '../utils/responseHelper.js';
import { OperationalService } from '../services/operationalService.js';

export const operationsRouter = Router();

/**
 * GET /api/v1/operations/today
 * Today Operational Cockpit for Owners & Managers
 */
operationsRouter.get('/today', authenticate, requireRole('OWNER', 'STAFF', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res) => {
  try {
    const data = OperationalService.getTodayCockpit(req.user!);
    return sendSuccess(res, data);
  } catch (err: any) {
    console.error('Error fetching today operational cockpit:', err);
    return sendError(res, 'OPERATION_ERROR', err.message || 'Failed to fetch today cockpit', 500);
  }
});

/**
 * GET /api/v1/operations/actions
 * Action Center: Aggregated prioritized actionable items
 */
operationsRouter.get('/actions', authenticate, requireRole('OWNER', 'STAFF', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res) => {
  try {
    const cockpit = OperationalService.getTodayCockpit(req.user!);
    const priority = req.query.priority as string;
    const category = req.query.category as string;

    let allActions = [...cockpit.critical, ...cockpit.attention, ...cockpit.upcoming];

    if (priority && priority !== 'ALL') {
      allActions = allActions.filter(a => a.priority === priority);
    }
    if (category && category !== 'ALL') {
      allActions = allActions.filter(a => a.category === category);
    }

    return sendSuccess(res, {
      actions: allActions,
      summary: {
        total: allActions.length,
        critical: cockpit.critical.length,
        attention: cockpit.attention.length,
        upcoming: cockpit.upcoming.length
      }
    });
  } catch (err: any) {
    console.error('Error fetching action center:', err);
    return sendError(res, 'OPERATION_ERROR', err.message || 'Failed to fetch actions', 500);
  }
});

/**
 * POST /api/v1/operations/actions/:actionKey/quick-action
 * 1-click execution for action items
 */
operationsRouter.post('/actions/:actionKey/quick-action', authenticate, requireRole('OWNER', 'STAFF', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res) => {
  try {
    const { actionKey } = req.params;
    const { actionType, payload } = req.body;

    if (!actionType) {
      return sendError(res, 'INVALID_PAYLOAD', 'actionType is required', 400);
    }

    const result = OperationalService.executeQuickAction(req.user!, actionKey, actionType, payload);
    return sendSuccess(res, result);
  } catch (err: any) {
    console.error('Error executing quick action:', err);
    return sendError(res, 'EXECUTE_ACTION_FAILED', err.message || 'Action failed', 400);
  }
});

/**
 * GET /api/v1/operations/buildings/:id/360
 * Building 360 View: Live floor map, occupancy, financials, operations
 */
operationsRouter.get('/buildings/:id/360', optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    const data = OperationalService.getBuilding360(req.params.id, req.user);
    return sendSuccess(res, data);
  } catch (err: any) {
    console.error('Error fetching building 360:', err);
    return sendError(res, 'BUILDING_360_FAILED', err.message || 'Building not found', 404);
  }
});

/**
 * GET /api/v1/operations/rooms/:id/360
 * Room 360 View: Unit details, tenant, contract, invoices, meters, equipment, service history, timeline
 */
operationsRouter.get('/rooms/:id/360', optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    const data = OperationalService.getRoom360(req.params.id, req.user);
    return sendSuccess(res, data);
  } catch (err: any) {
    console.error('Error fetching room 360:', err);
    return sendError(res, 'ROOM_360_FAILED', err.message || 'Room not found', 404);
  }
});

/**
 * GET /api/v1/operations/search
 * Universal Global Search & Command Palette
 */
operationsRouter.get('/search', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const q = (req.query.q as string) || '';
    const results = OperationalService.globalSearch(q, req.user!);
    return sendSuccess(res, results);
  } catch (err: any) {
    console.error('Error in global search:', err);
    return sendError(res, 'SEARCH_ERROR', err.message || 'Search failed', 500);
  }
});

/**
 * GET /api/v1/operations/ai-insights
 * Real-time operational intelligence insights
 */
operationsRouter.get('/ai-insights', authenticate, requireRole('OWNER', 'STAFF', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res) => {
  try {
    const results = OperationalService.getAiInsights(req.user!);
    return sendSuccess(res, results);
  } catch (err: any) {
    console.error('Error generating AI insights:', err);
    return sendError(res, 'INSIGHTS_ERROR', err.message || 'Failed to generate insights', 500);
  }
});

/**
 * POST /api/v1/operations/ai-triage
 * Smart maintenance diagnostic triage
 */
operationsRouter.post('/ai-triage', optionalAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { description, categoryHint } = req.body;
    if (!description || typeof description !== 'string') {
      return sendError(res, 'INVALID_DESCRIPTION', 'description string is required', 400);
    }
    const triageResult = OperationalService.aiTriage(description, categoryHint);
    return sendSuccess(res, triageResult);
  } catch (err: any) {
    console.error('Error in AI triage:', err);
    return sendError(res, 'TRIAGE_ERROR', err.message || 'Failed to triage issue', 500);
  }
});
