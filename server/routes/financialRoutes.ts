import { Router, Response } from 'express';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { PnlService } from '../services/pnlService.js';

export const financialRouter = Router();

// Financial endpoints are protected
financialRouter.use(authenticate);

// Consolidated P&L report across all buildings of owner
financialRouter.get('/pnl/consolidated', requireRole('SUPER_ADMIN', 'OWNER'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { periodMonth } = req.query;
    const result = PnlService.getConsolidatedPnL(req.user!, periodMonth as string);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(err.message === 'FORBIDDEN_COMPANY_ACCESS' ? 403 : 400).json({
      success: false,
      error: err.message
    });
  }
});

// Expenses
financialRouter.get('/expenses', requireRole('SUPER_ADMIN', 'OWNER', 'STAFF'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { buildingId, periodMonth } = req.query;
    const expenses = PnlService.getExpenses(req.user!, {
      buildingId: buildingId as string,
      periodMonth: periodMonth as string
    });
    res.json({ success: true, data: expenses });
  } catch (err: any) {
    res.status(err.message === 'BUILDING_NOT_FOUND' ? 404 : err.message === 'FORBIDDEN_COMPANY_ACCESS' ? 403 : 400).json({
      success: false,
      error: err.message
    });
  }
});

financialRouter.post('/expenses', requireRole('SUPER_ADMIN', 'OWNER', 'STAFF'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { buildingId, category, description, amount, expenseDate, periodMonth, vendorName, receiptUrl } = req.body;
    if (!buildingId || !category || !description || !amount) {
      res.status(400).json({
        success: false,
        error: 'MISSING_REQUIRED_FIELDS: buildingId, category, description, and amount are required'
      });
      return;
    }

    const expense = PnlService.recordExpense(req.user!, {
      buildingId,
      category,
      description,
      amount,
      expenseDate,
      periodMonth,
      vendorName,
      receiptUrl
    });

    res.status(201).json({ success: true, data: expense });
  } catch (err: any) {
    res.status(err.message === 'BUILDING_NOT_FOUND' ? 404 : err.message === 'FORBIDDEN_COMPANY_ACCESS' ? 403 : 400).json({
      success: false,
      error: err.message
    });
  }
});
