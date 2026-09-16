import crypto from 'node:crypto';
import { FinancialRepository, BuildingExpenseRow } from '../db/repositories/financialRepository.js';
import { BuildingRepository } from '../db/repositories/buildingRepository.js';
import { CompanyService } from './companyService.js';
import { TokenPayload } from './authService.js';

export interface BuildingPnLSummary {
  buildingId: string;
  buildingName: string;
  address: string;
  totalRooms: number;
  grossRevenue: number;
  revenueCollected: number;
  outstandingDebt: number;
  collectionRate: number; // percentage
  revenueBreakdown: Record<string, number>;
  totalOperatingExpense: number;
  expenseBreakdown: Record<string, number>;
  netOperatingIncome: number; // NOI = grossRevenue - totalOperatingExpense
  operatingMargin: number; // (NOI / grossRevenue) * 100
}

export interface ConsolidatedPnLResponse {
  periodMonth: string;
  previousMonth: string;
  portfolio: {
    totalBuildings: number;
    totalRooms: number;
    grossRevenue: number;
    revenueCollected: number;
    totalOperatingExpense: number;
    netOperatingIncome: number;
    operatingMargin: number;
    collectionRate: number;
    momRevenueGrowth: number; // % change vs previous month
    momNoiGrowth: number; // % change vs previous month
  };
  buildings: BuildingPnLSummary[];
}

export class PnlService {
  /**
   * Compute Consolidated Multi-Building P&L for a specified billing month
   */
  static getConsolidatedPnL(auth: TokenPayload, periodMonth?: string): ConsolidatedPnLResponse {
    const companyId = CompanyService.getUserCompanyId(auth);
    const month = periodMonth || new Date().toISOString().substring(0, 7);

    // Calculate previous month for MoM calculations
    const [yearStr, monthStr] = month.split('-');
    let prevYear = parseInt(yearStr, 10);
    let prevMonthNum = parseInt(monthStr, 10) - 1;
    if (prevMonthNum === 0) {
      prevMonthNum = 12;
      prevYear -= 1;
    }
    const prevMonth = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}`;

    const buildings = BuildingRepository.findAllBuildings({ companyId });

    const buildingSummaries: BuildingPnLSummary[] = [];

    let portTotalRooms = 0;
    let portGrossRev = 0;
    let portCollected = 0;
    let portTotalOpEx = 0;
    let portNoi = 0;

    for (const b of buildings) {
      const rooms = BuildingRepository.findAllRooms({ buildingId: b.id });
      const rev = FinancialRepository.getRevenueByBuilding(b.id, month);
      const exp = FinancialRepository.getExpenseSummaryByBuilding(b.id, month);

      const netIncome = rev.grossBilled - exp.totalExpense;
      const margin = rev.grossBilled > 0 ? Math.round((netIncome / rev.grossBilled) * 1000) / 10 : 0;
      const colRate = rev.grossBilled > 0 ? Math.round((rev.totalCollected / rev.grossBilled) * 1000) / 10 : 0;

      buildingSummaries.push({
        buildingId: b.id,
        buildingName: b.name,
        address: b.address,
        totalRooms: rooms.length,
        grossRevenue: rev.grossBilled,
        revenueCollected: rev.totalCollected,
        outstandingDebt: rev.totalOutstanding,
        collectionRate: colRate,
        revenueBreakdown: rev.breakdown,
        totalOperatingExpense: exp.totalExpense,
        expenseBreakdown: exp.breakdown,
        netOperatingIncome: netIncome,
        operatingMargin: margin
      });

      portTotalRooms += rooms.length;
      portGrossRev += rev.grossBilled;
      portCollected += rev.totalCollected;
      portTotalOpEx += exp.totalExpense;
      portNoi += netIncome;
    }

    // Previous month aggregate for MoM
    let prevPortGrossRev = 0;
    let prevPortNoi = 0;
    for (const b of buildings) {
      const prevRev = FinancialRepository.getRevenueByBuilding(b.id, prevMonth);
      const prevExp = FinancialRepository.getExpenseSummaryByBuilding(b.id, prevMonth);
      prevPortGrossRev += prevRev.grossBilled;
      prevPortNoi += (prevRev.grossBilled - prevExp.totalExpense);
    }

    const momRevenueGrowth = prevPortGrossRev > 0
      ? Math.round(((portGrossRev - prevPortGrossRev) / prevPortGrossRev) * 1000) / 10
      : 0;

    const momNoiGrowth = prevPortNoi !== 0
      ? Math.round(((portNoi - prevPortNoi) / Math.abs(prevPortNoi)) * 1000) / 10
      : 0;

    const portMargin = portGrossRev > 0 ? Math.round((portNoi / portGrossRev) * 1000) / 10 : 0;
    const portColRate = portGrossRev > 0 ? Math.round((portCollected / portGrossRev) * 1000) / 10 : 0;

    return {
      periodMonth: month,
      previousMonth: prevMonth,
      portfolio: {
        totalBuildings: buildings.length,
        totalRooms: portTotalRooms,
        grossRevenue: portGrossRev,
        revenueCollected: portCollected,
        totalOperatingExpense: portTotalOpEx,
        netOperatingIncome: portNoi,
        operatingMargin: portMargin,
        collectionRate: portColRate,
        momRevenueGrowth,
        momNoiGrowth
      },
      buildings: buildingSummaries
    };
  }

  /**
   * Record an operational expense for a building
   */
  static recordExpense(
    auth: TokenPayload,
    data: {
      buildingId: string;
      category: 'UTILITY_MUNICIPAL' | 'MAINTENANCE_REPAIR' | 'CLEANING_JANITORIAL' | 'SECURITY' | 'INTERNET_TELECOM' | 'TAX_INSURANCE' | 'STAFF_SALARY' | 'OTHER';
      description: string;
      amount: number;
      expenseDate?: string;
      periodMonth?: string;
      vendorName?: string;
      receiptUrl?: string;
    }
  ): BuildingExpenseRow {
    const building = BuildingRepository.findBuildingById(data.buildingId);
    if (!building) throw new Error('BUILDING_NOT_FOUND');

    if (!CompanyService.verifyCompanyAccess(auth, building.company_id)) {
      throw new Error('FORBIDDEN_COMPANY_ACCESS');
    }

    if (!data.amount || data.amount <= 0) {
      throw new Error('INVALID_AMOUNT: Số tiền chi phí phải lớn hơn 0');
    }

    const date = data.expenseDate || new Date().toISOString().substring(0, 10);
    const month = data.periodMonth || date.substring(0, 7);
    const now = new Date().toISOString();
    const id = 'exp_' + crypto.randomUUID().substring(0, 8);

    const expense: BuildingExpenseRow = {
      id,
      building_id: data.buildingId,
      category: data.category,
      description: data.description,
      amount: Number(data.amount),
      expense_date: date,
      period_month: month,
      vendor_name: data.vendorName || null,
      receipt_url: data.receiptUrl || null,
      created_by: auth.userId,
      created_at: now,
      updated_at: now
    };

    return FinancialRepository.createExpense(expense);
  }

  /**
   * Retrieve list of expenses
   */
  static getExpenses(auth: TokenPayload, filter?: { buildingId?: string; periodMonth?: string }) {
    const companyId = CompanyService.getUserCompanyId(auth);

    if (filter?.buildingId) {
      const building = BuildingRepository.findBuildingById(filter.buildingId);
      if (!building) throw new Error('BUILDING_NOT_FOUND');
      if (!CompanyService.verifyCompanyAccess(auth, building.company_id)) {
        throw new Error('FORBIDDEN_COMPANY_ACCESS');
      }
      return FinancialRepository.findExpensesByBuilding(filter.buildingId, filter.periodMonth);
    }

    return FinancialRepository.findExpensesByCompany(companyId, filter?.periodMonth);
  }
}
