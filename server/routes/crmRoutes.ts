import { Router, Response } from 'express';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { CrmService } from '../services/crmService.js';

export const crmRouter = Router();

// CRM is strictly accessible to Super Admin, Owner, and Staff
crmRouter.use(authenticate, requireRole('SUPER_ADMIN', 'OWNER', 'STAFF'));

// Leads
crmRouter.get('/leads', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, search } = req.query;
    const result = CrmService.getLeads(req.user!, {
      status: status as string,
      search: search as string
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.message === 'FORBIDDEN_COMPANY_ACCESS' ? 403 : 400).json({
      success: false,
      error: err.message
    });
  }
});

crmRouter.get('/leads/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const lead = CrmService.getLeadById(req.user!, req.params.id);
    res.json({ success: true, data: lead });
  } catch (err: any) {
    res.status(err.message === 'LEAD_NOT_FOUND' ? 404 : 403).json({
      success: false,
      error: err.message
    });
  }
});

crmRouter.post('/leads', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fullName, phone, email, source, budgetMin, budgetMax, preferredRoomType, moveInDate, notes, assignedStaffId } = req.body;
    if (!fullName || !phone) {
      res.status(400).json({ success: false, error: 'MISSING_REQUIRED_FIELDS: fullName and phone are required' });
      return;
    }

    const lead = CrmService.createLead(req.user!, {
      fullName,
      phone,
      email,
      source,
      budgetMin,
      budgetMax,
      preferredRoomType,
      moveInDate,
      notes,
      assignedStaffId
    });

    res.status(201).json({ success: true, data: lead });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

crmRouter.patch('/leads/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const lead = CrmService.updateLead(req.user!, req.params.id, req.body);
    res.json({ success: true, data: lead });
  } catch (err: any) {
    res.status(err.message === 'LEAD_NOT_FOUND' ? 404 : 400).json({
      success: false,
      error: err.message
    });
  }
});

// Tours
crmRouter.get('/tours', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.query;
    const tours = CrmService.getTours(req.user!, { status: status as string });
    res.json({ success: true, data: tours });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

crmRouter.post('/tours', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { leadId, roomId, scheduledAt, hostStaffId } = req.body;
    if (!leadId || !roomId || !scheduledAt) {
      res.status(400).json({ success: false, error: 'MISSING_REQUIRED_FIELDS: leadId, roomId, scheduledAt are required' });
      return;
    }

    const tour = CrmService.scheduleTour(req.user!, {
      leadId,
      roomId,
      scheduledAt,
      hostStaffId
    });

    res.status(201).json({ success: true, data: tour });
  } catch (err: any) {
    res.status(err.message === 'LEAD_NOT_FOUND' || err.message === 'ROOM_NOT_FOUND' ? 404 : 400).json({
      success: false,
      error: err.message
    });
  }
});

crmRouter.patch('/tours/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, feedback, rating } = req.body;
    if (!status) {
      res.status(400).json({ success: false, error: 'STATUS_REQUIRED' });
      return;
    }

    const tour = CrmService.completeTour(req.user!, req.params.id, {
      status,
      feedback,
      rating
    });

    res.json({ success: true, data: tour });
  } catch (err: any) {
    res.status(err.message === 'TOUR_NOT_FOUND' ? 404 : 400).json({
      success: false,
      error: err.message
    });
  }
});

// Convert Lead to Rental Application
crmRouter.post('/leads/:id/convert', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId, intendedStartDate, leaseDurationMonths, occupantsCount, notes } = req.body;
    if (!roomId || !intendedStartDate) {
      res.status(400).json({ success: false, error: 'MISSING_REQUIRED_FIELDS: roomId and intendedStartDate are required' });
      return;
    }

    const result = CrmService.convertLeadToApplication(req.user!, req.params.id, {
      roomId,
      intendedStartDate,
      leaseDurationMonths,
      occupantsCount,
      notes
    });

    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.message === 'LEAD_NOT_FOUND' || err.message === 'ROOM_NOT_FOUND' ? 404 : 400).json({
      success: false,
      error: err.message
    });
  }
});
