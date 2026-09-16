import { DatabaseClient } from '../connection.js';

export interface BuildingExpenseRow {
  id: string;
  building_id: string;
  category: 'UTILITY_MUNICIPAL' | 'MAINTENANCE_REPAIR' | 'CLEANING_JANITORIAL' | 'SECURITY' | 'INTERNET_TELECOM' | 'TAX_INSURANCE' | 'STAFF_SALARY' | 'OTHER';
  description: string;
  amount: number;
  expense_date: string;
  period_month: string;
  vendor_name: string | null;
  receipt_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export class FinancialRepository {
  private static getDb() {
    return DatabaseClient.getDb();
  }

  static findExpensesByCompany(companyId: string, periodMonth?: string): (BuildingExpenseRow & { building_name: string })[] {
    const db = this.getDb();
    let sql = `
      SELECT e.*, b.name AS building_name
      FROM building_expenses e
      JOIN buildings b ON e.building_id = b.id
      WHERE b.company_id = ?
    `;
    const params: any[] = [companyId];

    if (periodMonth) {
      sql += ' AND e.period_month = ?';
      params.push(periodMonth);
    }

    sql += ' ORDER BY e.expense_date DESC';
    return db.prepare(sql).all(...params) as any;
  }

  static findExpensesByBuilding(buildingId: string, periodMonth?: string): BuildingExpenseRow[] {
    const db = this.getDb();
    let sql = 'SELECT * FROM building_expenses WHERE building_id = ?';
    const params: any[] = [buildingId];

    if (periodMonth) {
      sql += ' AND period_month = ?';
      params.push(periodMonth);
    }

    sql += ' ORDER BY expense_date DESC';
    return db.prepare(sql).all(...params) as any;
  }

  static createExpense(expense: BuildingExpenseRow): BuildingExpenseRow {
    const db = this.getDb();
    db.prepare(`
      INSERT INTO building_expenses (
        id, building_id, category, description, amount, expense_date,
        period_month, vendor_name, receipt_url, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      expense.id, expense.building_id, expense.category, expense.description,
      expense.amount, expense.expense_date, expense.period_month, expense.vendor_name,
      expense.receipt_url, expense.created_by, expense.created_at, expense.updated_at
    );
    return expense;
  }

  static deleteExpense(id: string): boolean {
    const db = this.getDb();
    const res = db.prepare('DELETE FROM building_expenses WHERE id = ?').run(id);
    return Number(res.changes) > 0;
  }

  static getRevenueByBuilding(buildingId: string, periodMonth: string) {
    const db = this.getDb();

    // Sum from invoices and items for that month
    const invoiceSummary = db.prepare(`
      SELECT
        COUNT(i.id) AS total_invoices,
        COALESCE(SUM(i.total), 0) AS gross_billed,
        COALESCE(SUM(i.paid_amount), 0) AS total_collected,
        COALESCE(SUM(i.outstanding_amount), 0) AS total_outstanding
      FROM invoices i
      JOIN rooms r ON i.room_id = r.id
      WHERE r.building_id = ? AND i.billing_month = ? AND i.status != 'CANCELLED'
    `).get(buildingId, periodMonth) as any;

    // Breakdown by item type (Rent vs Utilities vs Services)
    const breakdownRows = db.prepare(`
      SELECT
        it.type,
        COALESCE(SUM(it.amount), 0) AS item_total
      FROM invoice_items it
      JOIN invoices i ON it.invoice_id = i.id
      JOIN rooms r ON i.room_id = r.id
      WHERE r.building_id = ? AND i.billing_month = ? AND i.status != 'CANCELLED'
      GROUP BY it.type
    `).all(buildingId, periodMonth) as { type: string; item_total: number }[];

    const breakdown: Record<string, number> = {
      RENT: 0,
      ELECTRICITY: 0,
      WATER: 0,
      INTERNET: 0,
      PARKING: 0,
      CLEANING: 0,
      GARBAGE: 0,
      OTHER: 0
    };

    for (const b of breakdownRows) {
      breakdown[b.type] = Number(b.item_total);
    }

    return {
      grossBilled: Number(invoiceSummary?.gross_billed || 0),
      totalCollected: Number(invoiceSummary?.total_collected || 0),
      totalOutstanding: Number(invoiceSummary?.total_outstanding || 0),
      totalInvoices: Number(invoiceSummary?.total_invoices || 0),
      breakdown
    };
  }

  static getExpenseSummaryByBuilding(buildingId: string, periodMonth: string) {
    const db = this.getDb();
    const rows = db.prepare(`
      SELECT
        category,
        COALESCE(SUM(amount), 0) AS category_total
      FROM building_expenses
      WHERE building_id = ? AND period_month = ?
      GROUP BY category
    `).all(buildingId, periodMonth) as { category: string; category_total: number }[];

    let totalExpense = 0;
    const breakdown: Record<string, number> = {
      UTILITY_MUNICIPAL: 0,
      MAINTENANCE_REPAIR: 0,
      CLEANING_JANITORIAL: 0,
      SECURITY: 0,
      INTERNET_TELECOM: 0,
      TAX_INSURANCE: 0,
      STAFF_SALARY: 0,
      OTHER: 0
    };

    for (const r of rows) {
      breakdown[r.category] = Number(r.category_total);
      totalExpense += Number(r.category_total);
    }

    return {
      totalExpense,
      breakdown
    };
  }
}
