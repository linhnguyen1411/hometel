import { getDatabase } from '../connection.js';

export interface ActionDismissalRow {
  id: string;
  action_key: string;
  dismissed_until: string | null;
  reason: string | null;
  created_at: string;
}

export class OperationsRepository {
  /**
   * Helper: Resolve company IDs for an authenticated user
   */
  static getUserCompanyIds(userId: string, role: string): string[] {
    const db = getDatabase();
    if (role === 'SUPER_ADMIN') {
      const all = db.prepare('SELECT id FROM companies WHERE status = "ACTIVE"').all() as { id: string }[];
      return all.map(c => c.id);
    }
    const mems = db.prepare('SELECT company_id FROM company_memberships WHERE user_id = ? AND status = "ACTIVE"').all(userId) as { company_id: string }[];
    return mems.map(m => m.company_id);
  }

  /**
   * Dismissals
   */
  static getActiveDismissals(todayStr: string): Set<string> {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT action_key FROM action_dismissals 
      WHERE dismissed_until IS NULL OR dismissed_until > ?
    `).all(todayStr) as { action_key: string }[];
    return new Set(rows.map(r => r.action_key));
  }

  static upsertDismissal(id: string, actionKey: string, dismissedUntil: string | null, reason: string, now: string): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO action_dismissals (id, action_key, dismissed_until, reason, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(action_key) DO UPDATE SET dismissed_until = excluded.dismissed_until
    `).run(id, actionKey, dismissedUntil, reason, now);
  }

  /**
   * Cockpit queries
   */
  static getCockpitInvoices(companyIds: string[]): any[] {
    if (companyIds.length === 0) return [];
    const db = getDatabase();
    const placeholders = companyIds.map(() => '?').join(',');
    return db.prepare(`
      SELECT i.*, r.room_number, b.name as building_name, b.id as building_id, u.full_name as tenant_name, u.phone as tenant_phone
      FROM invoices i
      JOIN rooms r ON i.room_id = r.id
      JOIN buildings b ON r.building_id = b.id
      JOIN users u ON i.tenant_id = u.id
      WHERE i.company_id IN (${placeholders})
      AND i.status IN ('ISSUED', 'PARTIALLY_PAID', 'OVERDUE')
    `).all(...companyIds) as any[];
  }

  static getCockpitServiceRequests(companyIds: string[]): any[] {
    if (companyIds.length === 0) return [];
    const db = getDatabase();
    const placeholders = companyIds.map(() => '?').join(',');
    return db.prepare(`
      SELECT sr.*, r.room_number, b.name as building_name, b.id as building_id, u.full_name as tenant_name, u.phone as tenant_phone,
             s.name as service_name
      FROM service_requests sr
      LEFT JOIN rooms r ON sr.room_id = r.id
      LEFT JOIN buildings b ON r.building_id = b.id
      LEFT JOIN users u ON sr.tenant_id = u.id
      LEFT JOIN services s ON sr.service_id = s.id
      WHERE (sr.provider_company_id IN (${placeholders}) OR r.building_id IN (SELECT id FROM buildings WHERE company_id IN (${placeholders})))
      AND sr.status IN ('PENDING', 'APPROVED', 'ASSIGNED', 'IN_PROGRESS')
    `).all(...companyIds, ...companyIds) as any[];
  }

  static getCockpitContracts(companyIds: string[]): any[] {
    if (companyIds.length === 0) return [];
    const db = getDatabase();
    const placeholders = companyIds.map(() => '?').join(',');
    return db.prepare(`
      SELECT c.*, r.room_number, b.name as building_name, b.id as building_id, u.full_name as tenant_name, u.phone as tenant_phone
      FROM rental_contracts c
      JOIN rooms r ON c.room_id = r.id
      JOIN buildings b ON r.building_id = b.id
      JOIN users u ON c.tenant_id = u.id
      WHERE c.company_id IN (${placeholders})
      AND c.status IN ('ACTIVE', 'EXPIRING')
    `).all(...companyIds) as any[];
  }

  static getCockpitPendingApplications(companyIds: string[]): any[] {
    if (companyIds.length === 0) return [];
    const db = getDatabase();
    const placeholders = companyIds.map(() => '?').join(',');
    return db.prepare(`
      SELECT a.*, r.room_number, b.name as building_name, b.id as building_id, u.full_name as tenant_name, u.phone as tenant_phone
      FROM rental_applications a
      JOIN rooms r ON a.room_id = r.id
      JOIN buildings b ON r.building_id = b.id
      JOIN users u ON a.tenant_id = u.id
      WHERE b.company_id IN (${placeholders})
      AND a.status = 'PENDING'
    `).all(...companyIds) as any[];
  }

  static getCockpitFaultyEquipment(companyIds: string[]): any[] {
    if (companyIds.length === 0) return [];
    const db = getDatabase();
    const placeholders = companyIds.map(() => '?').join(',');
    return db.prepare(`
      SELECT eq.*, r.room_number, b.name as building_name, b.id as building_id
      FROM equipment eq
      JOIN rooms r ON eq.room_id = r.id
      JOIN buildings b ON r.building_id = b.id
      WHERE b.company_id IN (${placeholders})
      AND eq.condition = 'NEEDS_REPAIR'
    `).all(...companyIds) as any[];
  }

  static getCockpitRooms(companyIds: string[]): any[] {
    if (companyIds.length === 0) return [];
    const db = getDatabase();
    const placeholders = companyIds.map(() => '?').join(',');
    return db.prepare(`
      SELECT r.id, r.status, b.company_id
      FROM rooms r
      JOIN buildings b ON r.building_id = b.id
      WHERE b.company_id IN (${placeholders})
    `).all(...companyIds) as any[];
  }

  static getCockpitInvoiceStats(companyIds: string[]): { total_billed: number; total_collected: number; total_outstanding: number } {
    if (companyIds.length === 0) return { total_billed: 0, total_collected: 0, total_outstanding: 0 };
    const db = getDatabase();
    const placeholders = companyIds.map(() => '?').join(',');
    const stats = db.prepare(`
      SELECT 
        COALESCE(SUM(total), 0) as total_billed,
        COALESCE(SUM(paid_amount), 0) as total_collected,
        COALESCE(SUM(outstanding_amount), 0) as total_outstanding
      FROM invoices
      WHERE company_id IN (${placeholders})
    `).get(...companyIds) as any;
    return {
      total_billed: stats?.total_billed || 0,
      total_collected: stats?.total_collected || 0,
      total_outstanding: stats?.total_outstanding || 0
    };
  }

  /**
   * Quick Actions Helpers
   */
  static findAvailableStaff(companyId?: string): string | null {
    const db = getDatabase();
    if (companyId) {
      const staff = db.prepare(`
        SELECT user_id FROM company_memberships 
        WHERE company_id = ? AND role = 'STAFF' AND status = 'ACTIVE'
        LIMIT 1
      `).get(companyId) as any;
      if (staff) return staff.user_id;
    }
    const staff = db.prepare(`
      SELECT user_id FROM company_memberships 
      WHERE role = 'STAFF' AND status = 'ACTIVE'
      LIMIT 1
    `).get() as any;
    return staff?.user_id || null;
  }

  static assignServiceRequest(assignmentId: string, srId: string, staffId: string, now: string): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE service_requests
      SET status = 'ASSIGNED', updated_at = ?
      WHERE id = ?
    `).run(now, srId);

    db.prepare(`
      INSERT INTO service_assignments (id, service_request_id, staff_id, assigned_at, status)
      VALUES (?, ?, ?, ?, 'ASSIGNED')
      ON CONFLICT(id) DO UPDATE SET staff_id = excluded.staff_id, status = 'ASSIGNED'
    `).run(assignmentId, srId, staffId, now);
  }

  /**
   * Building 360 Queries
   */
  static getBuildingDetail(buildingId: string): any {
    const db = getDatabase();
    return db.prepare(`
      SELECT b.*, c.name as company_name, c.phone as company_phone, c.email as company_email
      FROM buildings b
      JOIN companies c ON b.company_id = c.id
      WHERE b.id = ?
    `).get(buildingId) as any;
  }

  static getFloorsByBuilding(buildingId: string): any[] {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM floors WHERE building_id = ? ORDER BY floor_number ASC
    `).all(buildingId) as any[];
  }

  static getRoomsWithHealthData(buildingId: string, todayStr: string): any[] {
    const db = getDatabase();
    return db.prepare(`
      SELECT r.*, f.floor_number,
             (SELECT u.full_name FROM rental_contracts c JOIN users u ON c.tenant_id = u.id WHERE c.room_id = r.id AND c.status = 'ACTIVE' LIMIT 1) as tenant_name,
             (SELECT u.phone FROM rental_contracts c JOIN users u ON c.tenant_id = u.id WHERE c.room_id = r.id AND c.status = 'ACTIVE' LIMIT 1) as tenant_phone,
             (SELECT c.id FROM rental_contracts c WHERE c.room_id = r.id AND c.status = 'ACTIVE' LIMIT 1) as active_contract_id,
             (SELECT c.contract_number FROM rental_contracts c WHERE c.room_id = r.id AND c.status = 'ACTIVE' LIMIT 1) as contract_number,
             (SELECT c.end_date FROM rental_contracts c WHERE c.room_id = r.id AND c.status = 'ACTIVE' LIMIT 1) as contract_end_date,
             (SELECT COUNT(*) FROM invoices i WHERE i.room_id = r.id AND (i.status = 'OVERDUE' OR (i.status IN ('ISSUED', 'PARTIALLY_PAID') AND i.due_date < ?))) as overdue_count,
             (SELECT COUNT(*) FROM service_requests sr WHERE sr.room_id = r.id AND sr.status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS') AND sr.urgency IN ('HIGH', 'EMERGENCY')) as critical_issues_count
      FROM rooms r
      JOIN floors f ON r.floor_id = f.id
      WHERE r.building_id = ?
      ORDER BY f.floor_number ASC, r.room_number ASC
    `).all(todayStr, buildingId) as any[];
  }

  static getBuildingFinancialStats(buildingId: string): { total_billed: number; total_collected: number; total_outstanding: number } {
    const db = getDatabase();
    const stats = db.prepare(`
      SELECT 
        COALESCE(SUM(total), 0) as total_billed,
        COALESCE(SUM(paid_amount), 0) as total_collected,
        COALESCE(SUM(outstanding_amount), 0) as total_outstanding
      FROM invoices i
      JOIN rooms r ON i.room_id = r.id
      WHERE r.building_id = ?
    `).get(buildingId) as any;
    return {
      total_billed: stats?.total_billed || 0,
      total_collected: stats?.total_collected || 0,
      total_outstanding: stats?.total_outstanding || 0
    };
  }

  static getBuildingOpenWorkOrders(buildingId: string): number {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT COUNT(*) as count 
      FROM service_requests sr
      JOIN rooms r ON sr.room_id = r.id
      WHERE r.building_id = ? AND sr.status IN ('PENDING', 'APPROVED', 'ASSIGNED', 'IN_PROGRESS')
    `).get(buildingId) as any;
    return row?.count || 0;
  }

  static getRecentActivity(limit = 10): any[] {
    const db = getDatabase();
    return db.prepare(`
      SELECT al.*, u.full_name as actor_name
      FROM audit_logs al
      LEFT JOIN users u ON al.actor_id = u.id
      ORDER BY al.created_at DESC
      LIMIT ?
    `).all(limit) as any[];
  }

  /**
   * Room 360 Queries
   */
  static getRoomDetailWithContext(roomId: string): any {
    const db = getDatabase();
    return db.prepare(`
      SELECT r.*, f.floor_number, f.name as floor_name, b.name as building_name, b.address as building_address, b.city as building_city
      FROM rooms r
      JOIN floors f ON r.floor_id = f.id
      JOIN buildings b ON r.building_id = b.id
      WHERE r.id = ?
    `).get(roomId) as any;
  }

  static getRoomActiveContract(roomId: string): any {
    const db = getDatabase();
    return db.prepare(`
      SELECT c.*, u.full_name as tenant_name, u.email as tenant_email, u.phone as tenant_phone, u.avatar_url as tenant_avatar
      FROM rental_contracts c
      JOIN users u ON c.tenant_id = u.id
      WHERE c.room_id = ? AND c.status IN ('ACTIVE', 'EXPIRING', 'PENDING')
      ORDER BY c.created_at DESC
      LIMIT 1
    `).get(roomId) as any;
  }

  static getDepositForContract(contractId: string): any {
    const db = getDatabase();
    return db.prepare('SELECT * FROM deposits WHERE contract_id = ?').get(contractId) as any;
  }

  static getEquipmentForRoom(roomId: string): any[] {
    const db = getDatabase();
    return db.prepare('SELECT * FROM equipment WHERE room_id = ? ORDER BY name ASC').all(roomId) as any[];
  }

  static getMetersForRoom(roomId: string): any[] {
    const db = getDatabase();
    return db.prepare(`
      SELECT m.*,
             (SELECT consumption FROM meter_readings mr WHERE mr.meter_id = m.id ORDER BY mr.created_at DESC LIMIT 1) as last_consumption,
             (SELECT reading_date FROM meter_readings mr WHERE mr.meter_id = m.id ORDER BY mr.created_at DESC LIMIT 1) as last_reading_date
      FROM meters m
      WHERE m.room_id = ?
    `).all(roomId) as any[];
  }

  static getInvoicesForRoom(roomId: string, limit = 12): any[] {
    const db = getDatabase();
    return db.prepare(`
      SELECT i.*, 
             (SELECT COUNT(*) FROM invoice_items itm WHERE itm.invoice_id = i.id) as item_count
      FROM invoices i
      WHERE i.room_id = ?
      ORDER BY i.issue_date DESC
      LIMIT ?
    `).all(roomId, limit) as any[];
  }

  static getServiceRequestsForRoom(roomId: string): any[] {
    const db = getDatabase();
    return db.prepare(`
      SELECT sr.*, s.name as service_name, s.category as service_category,
             sa.staff_id, u.full_name as technician_name
      FROM service_requests sr
      LEFT JOIN services s ON sr.service_id = s.id
      LEFT JOIN service_assignments sa ON sa.service_request_id = sr.id
      LEFT JOIN users u ON sa.staff_id = u.id
      WHERE sr.room_id = ?
      ORDER BY sr.created_at DESC
    `).all(roomId) as any[];
  }

  /**
   * Universal Search Queries
   */
  static searchRooms(term: string, companyIds: string[]): any[] {
    const db = getDatabase();
    const q = `%${term}%`;
    if (companyIds.length > 0) {
      const placeholders = companyIds.map(() => '?').join(',');
      return db.prepare(`
        SELECT r.id, r.room_number, r.status, r.base_rent, b.name as building_name, b.id as building_id
        FROM rooms r
        JOIN buildings b ON r.building_id = b.id
        WHERE (r.room_number LIKE ? OR r.description LIKE ?)
        AND b.company_id IN (${placeholders})
        LIMIT 5
      `).all(q, q, ...companyIds) as any[];
    }
    return db.prepare(`
      SELECT r.id, r.room_number, r.status, r.base_rent, b.name as building_name, b.id as building_id
      FROM rooms r
      JOIN buildings b ON r.building_id = b.id
      WHERE (r.room_number LIKE ? OR r.description LIKE ?)
      LIMIT 5
    `).all(q, q) as any[];
  }

  static searchTenants(term: string): any[] {
    const db = getDatabase();
    const q = `%${term}%`;
    return db.prepare(`
      SELECT u.id, u.full_name, u.email, u.phone, u.avatar_url
      FROM users u
      WHERE u.role = 'TENANT'
      AND (u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)
      LIMIT 5
    `).all(q, q, q) as any[];
  }

  static searchBuildings(term: string, companyIds: string[]): any[] {
    const db = getDatabase();
    const q = `%${term}%`;
    if (companyIds.length > 0) {
      const placeholders = companyIds.map(() => '?').join(',');
      return db.prepare(`
        SELECT b.id, b.name, b.address, b.city, b.status
        FROM buildings b
        WHERE (b.name LIKE ? OR b.address LIKE ?)
        AND b.company_id IN (${placeholders})
        LIMIT 5
      `).all(q, q, ...companyIds) as any[];
    }
    return db.prepare(`
      SELECT b.id, b.name, b.address, b.city, b.status
      FROM buildings b
      WHERE (b.name LIKE ? OR b.address LIKE ?)
      LIMIT 5
    `).all(q, q) as any[];
  }

  static searchContracts(term: string, companyIds: string[]): any[] {
    const db = getDatabase();
    const q = `%${term}%`;
    if (companyIds.length > 0) {
      const placeholders = companyIds.map(() => '?').join(',');
      return db.prepare(`
        SELECT c.id, c.contract_number, c.rent_amount, c.status, r.room_number, u.full_name as tenant_name
        FROM rental_contracts c
        JOIN rooms r ON c.room_id = r.id
        JOIN users u ON c.tenant_id = u.id
        WHERE c.contract_number LIKE ?
        AND c.company_id IN (${placeholders})
        LIMIT 5
      `).all(q, ...companyIds) as any[];
    }
    return db.prepare(`
      SELECT c.id, c.contract_number, c.rent_amount, c.status, r.room_number, u.full_name as tenant_name
      FROM rental_contracts c
      JOIN rooms r ON c.room_id = r.id
      JOIN users u ON c.tenant_id = u.id
      WHERE c.contract_number LIKE ?
      LIMIT 5
    `).all(q) as any[];
  }

  static searchInvoices(term: string, companyIds: string[]): any[] {
    const db = getDatabase();
    const q = `%${term}%`;
    if (companyIds.length > 0) {
      const placeholders = companyIds.map(() => '?').join(',');
      return db.prepare(`
        SELECT i.id, i.invoice_number, i.total, i.status, i.billing_month, r.room_number
        FROM invoices i
        JOIN rooms r ON i.room_id = r.id
        WHERE i.invoice_number LIKE ?
        AND i.company_id IN (${placeholders})
        LIMIT 5
      `).all(q, ...companyIds) as any[];
    }
    return db.prepare(`
      SELECT i.id, i.invoice_number, i.total, i.status, i.billing_month, r.room_number
      FROM invoices i
      JOIN rooms r ON i.room_id = r.id
      WHERE i.invoice_number LIKE ?
      LIMIT 5
    `).all(q) as any[];
  }

  static searchServiceRequests(term: string): any[] {
    const db = getDatabase();
    const q = `%${term}%`;
    return db.prepare(`
      SELECT sr.id, sr.title, sr.status, sr.urgency, r.room_number
      FROM service_requests sr
      LEFT JOIN rooms r ON sr.room_id = r.id
      WHERE (sr.title LIKE ? OR sr.description LIKE ?)
      LIMIT 5
    `).all(q, q) as any[];
  }

  static searchEquipment(term: string): any[] {
    const db = getDatabase();
    const q = `%${term}%`;
    return db.prepare(`
      SELECT eq.id, eq.name, eq.serial_number, eq.condition, r.room_number
      FROM equipment eq
      JOIN rooms r ON eq.room_id = r.id
      WHERE (eq.name LIKE ? OR eq.serial_number LIKE ?)
      LIMIT 5
    `).all(q, q) as any[];
  }

  /**
   * AI Insights Queries
   */
  static getOverdueInvoicesForInsights(companyIds: string[], todayStr: string, limit = 3): any[] {
    if (companyIds.length === 0) return [];
    const db = getDatabase();
    const placeholders = companyIds.map(() => '?').join(',');
    return db.prepare(`
      SELECT i.id, i.invoice_number, i.total, i.outstanding_amount, i.due_date, r.room_number, u.full_name as tenant_name
      FROM invoices i
      JOIN rooms r ON i.room_id = r.id
      JOIN users u ON i.tenant_id = u.id
      WHERE i.company_id IN (${placeholders})
      AND (i.status = 'OVERDUE' OR (i.status IN ('ISSUED', 'PARTIALLY_PAID') AND i.due_date < ?))
      ORDER BY i.due_date ASC
      LIMIT ?
    `).all(...companyIds, todayStr, limit) as any[];
  }

  static getRepeatedMaintenance(limit = 2): any[] {
    const db = getDatabase();
    return db.prepare(`
      SELECT r.room_number, r.id as room_id, COUNT(*) as req_count
      FROM service_requests sr
      JOIN rooms r ON sr.room_id = r.id
      GROUP BY r.id
      HAVING req_count >= 2
      LIMIT ?
    `).all(limit) as any[];
  }

  static getContractsExpiringWithin30Days(companyIds: string[], todayStr: string): any[] {
    if (companyIds.length === 0) return [];
    const db = getDatabase();
    const placeholders = companyIds.map(() => '?').join(',');
    return db.prepare(`
      SELECT c.id, c.contract_number, c.end_date, r.room_number, u.full_name as tenant_name
      FROM rental_contracts c
      JOIN rooms r ON c.room_id = r.id
      JOIN users u ON c.tenant_id = u.id
      WHERE c.company_id IN (${placeholders})
      AND c.status IN ('ACTIVE', 'EXPIRING')
      AND c.end_date BETWEEN ? AND date(?, '+30 days')
    `).all(...companyIds, todayStr, todayStr) as any[];
  }

  static getRecommendedService(category: string): any {
    const db = getDatabase();
    return db.prepare(`
      SELECT s.*, c.name as provider_company_name, c.phone as provider_phone
      FROM services s
      JOIN companies c ON s.company_id = c.id
      WHERE s.category = ? AND s.status = 'ACTIVE'
      ORDER BY s.base_price ASC
      LIMIT 1
    `).get(category) as any;
  }

  /**
   * System Stats for Super Admin Overview
   */
  static getSystemStats() {
    const db = getDatabase();

    const usersCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
    const ownersCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'OWNER'").get() as any).count;
    const providersCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'PROVIDER'").get() as any).count;
    const tenantsCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'TENANT'").get() as any).count;
    const companiesCount = (db.prepare('SELECT COUNT(*) as count FROM companies').get() as any).count;
    const buildingsCount = (db.prepare('SELECT COUNT(*) as count FROM buildings').get() as any).count;
    const roomsCount = (db.prepare('SELECT COUNT(*) as count FROM rooms').get() as any).count;
    const activeContractsCount = (db.prepare("SELECT COUNT(*) as count FROM rental_contracts WHERE status = 'ACTIVE'").get() as any).count;

    const revenueResult = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'SUCCESS'").get() as any;
    const totalRevenue = revenueResult.total;

    const outstandingResult = db.prepare("SELECT COALESCE(SUM(outstanding_amount), 0) as total FROM invoices WHERE status != 'CANCELLED'").get() as any;
    const totalOutstanding = outstandingResult.total;

    const auditCount = (db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as any).count;

    return {
      totalUsers: usersCount,
      totalOwners: ownersCount,
      totalProviders: providersCount,
      totalTenants: tenantsCount,
      totalCompanies: companiesCount,
      totalBuildings: buildingsCount,
      totalRooms: roomsCount,
      activeContracts: activeContractsCount,
      totalRevenue,
      totalOutstanding,
      auditCount
    };
  }
}
