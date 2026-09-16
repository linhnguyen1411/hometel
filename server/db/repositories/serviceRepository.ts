import { getDatabase, withTransaction } from '../connection.js';

export interface ServiceRow {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  description: string | null;
  category: 'CLEANING' | 'MAINTENANCE' | 'PLUMBING' | 'ELECTRICAL' | 'HVAC' | 'LAUNDRY' | 'SECURITY' | 'MOVING';
  price_type: 'FIXED' | 'QUOTATION' | 'HOURLY' | 'OTHER';
  base_price: number;
  image_url: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface ServiceRequestRow {
  id: string;
  service_id: string;
  provider_company_id: string;
  tenant_id: string;
  room_id: string | null;
  title: string;
  description: string;
  preferred_date: string | null;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  estimated_cost: number | null;
  final_cost: number | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceAssignmentRow {
  id: string;
  service_request_id: string;
  staff_id: string;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

export class ServiceRepository {
  // Services
  static findServiceById(id: string): (ServiceRow & { company_name: string }) | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT s.*, c.name as company_name
      FROM services s
      JOIN companies c ON s.company_id = c.id
      WHERE s.id = ?
    `);
    return (stmt.get(id) as any) || null;
  }

  static findServiceBySlug(slug: string): (ServiceRow & { company_name: string }) | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT s.*, c.name as company_name
      FROM services s
      JOIN companies c ON s.company_id = c.id
      WHERE s.slug = ?
    `);
    return (stmt.get(slug) as any) || null;
  }

  static findAllServices(options?: { companyId?: string; category?: string; status?: string; search?: string; limit?: number; offset?: number }) {
    const db = getDatabase();
    let query = `
      SELECT s.*, c.name as company_name, c.phone as company_phone, c.email as company_email
      FROM services s
      JOIN companies c ON s.company_id = c.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (options?.companyId) {
      query += ' AND s.company_id = ?';
      params.push(options.companyId);
    }
    if (options?.category) {
      query += ' AND s.category = ?';
      params.push(options.category);
    }
    if (options?.status) {
      query += ' AND s.status = ?';
      params.push(options.status);
    }
    if (options?.search) {
      query += ' AND (s.name LIKE ? OR s.description LIKE ? OR c.name LIKE ?)';
      const term = `%${options.search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY s.created_at DESC';
    if (options?.limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(options.limit, options.offset || 0);
    }

    const stmt = db.prepare(query);
    return stmt.all(...params) as unknown as (ServiceRow & { company_name: string; company_phone: string | null; company_email: string | null })[];
  }

  static createService(s: Omit<ServiceRow, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): ServiceRow {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO services (id, company_id, name, slug, description, category, price_type, base_price, image_url, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      s.id,
      s.company_id,
      s.name,
      s.slug,
      s.description || null,
      s.category,
      s.price_type || 'FIXED',
      s.base_price || 0,
      s.image_url || null,
      s.status || 'ACTIVE',
      s.created_at || now,
      s.updated_at || now
    );
    return { ...s, created_at: s.created_at || now, updated_at: s.updated_at || now };
  }

  // Service Requests
  static findRequestById(id: string): (ServiceRequestRow & { service_name: string; provider_company_name: string; tenant_name: string; tenant_email: string; tenant_phone: string | null; room_number: string | null; building_name: string | null; assignment?: ServiceAssignmentRow & { staff_name: string } }) | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT sr.*, s.name as service_name, c.name as provider_company_name, u.full_name as tenant_name, u.email as tenant_email, u.phone as tenant_phone, r.room_number, b.name as building_name
      FROM service_requests sr
      JOIN services s ON sr.service_id = s.id
      JOIN companies c ON sr.provider_company_id = c.id
      JOIN users u ON sr.tenant_id = u.id
      LEFT JOIN rooms r ON sr.room_id = r.id
      LEFT JOIN buildings b ON r.building_id = b.id
      WHERE sr.id = ?
    `);
    const req = stmt.get(id) as any;
    if (!req) return null;

    const assignStmt = db.prepare(`
      SELECT sa.*, u.full_name as staff_name, u.email as staff_email, u.phone as staff_phone
      FROM service_assignments sa
      JOIN users u ON sa.staff_id = u.id
      WHERE sa.service_request_id = ?
      ORDER BY sa.assigned_at DESC
      LIMIT 1
    `);
    req.assignment = assignStmt.get(id) || null;
    return req;
  }

  static findAllRequests(options?: {
    tenantId?: string;
    providerCompanyId?: string;
    staffId?: string;
    status?: string;
    urgency?: string;
    limit?: number;
    offset?: number;
  }) {
    const db = getDatabase();
    let query = `
      SELECT sr.*, s.name as service_name, c.name as provider_company_name, u.full_name as tenant_name, u.email as tenant_email, u.phone as tenant_phone, r.room_number, b.name as building_name,
        sa.staff_id, staff.full_name as staff_name, sa.status as assignment_status
      FROM service_requests sr
      JOIN services s ON sr.service_id = s.id
      JOIN companies c ON sr.provider_company_id = c.id
      JOIN users u ON sr.tenant_id = u.id
      LEFT JOIN rooms r ON sr.room_id = r.id
      LEFT JOIN buildings b ON r.building_id = b.id
      LEFT JOIN service_assignments sa ON sr.id = sa.service_request_id
      LEFT JOIN users staff ON sa.staff_id = staff.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (options?.tenantId) {
      query += ' AND sr.tenant_id = ?';
      params.push(options.tenantId);
    }
    if (options?.providerCompanyId) {
      query += ' AND sr.provider_company_id = ?';
      params.push(options.providerCompanyId);
    }
    if (options?.staffId) {
      query += ' AND sa.staff_id = ?';
      params.push(options.staffId);
    }
    if (options?.status) {
      query += ' AND sr.status = ?';
      params.push(options.status);
    }
    if (options?.urgency) {
      query += ' AND sr.urgency = ?';
      params.push(options.urgency);
    }

    query += ' ORDER BY sr.created_at DESC';
    if (options?.limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(options.limit, options.offset || 0);
    }

    const stmt = db.prepare(query);
    return stmt.all(...params) as any[];
  }

  static createRequest(r: Omit<ServiceRequestRow, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): ServiceRequestRow {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO service_requests (id, service_id, provider_company_id, tenant_id, room_id, title, description, preferred_date, urgency, status, estimated_cost, final_cost, rejection_reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      r.id,
      r.service_id,
      r.provider_company_id,
      r.tenant_id,
      r.room_id || null,
      r.title,
      r.description,
      r.preferred_date || null,
      r.urgency || 'MEDIUM',
      r.status || 'PENDING',
      r.estimated_cost || null,
      r.final_cost || null,
      r.rejection_reason || null,
      r.created_at || now,
      r.updated_at || now
    );
    return { ...r, created_at: r.created_at || now, updated_at: r.updated_at || now };
  }

  static updateRequest(id: string, updates: Partial<Omit<ServiceRequestRow, 'id' | 'created_at' | 'updated_at'>>): ServiceRequestRow | null {
    const db = getDatabase();
    const fields: string[] = [];
    const params: (string | number | null)[] = [];

    for (const [key, val] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      params.push(val as string | number | null);
    }

    if (fields.length === 0) return this.findRequestById(id) as any;

    const now = new Date().toISOString();
    fields.push('updated_at = ?');
    params.push(now);
    params.push(id);

    const stmt = db.prepare(`UPDATE service_requests SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...params);

    return this.findRequestById(id) as any;
  }

  // Staff Assignment
  static assignStaff(assignment: Omit<ServiceAssignmentRow, 'assigned_at'> & { assigned_at?: string }): ServiceAssignmentRow {
    const db = getDatabase();
    const now = new Date().toISOString();
    const assignedAt = assignment.assigned_at || now;

    return withTransaction(() => {
      // 1. Create or update assignment
      const stmt = db.prepare(`
        INSERT INTO service_assignments (id, service_request_id, staff_id, assigned_at, started_at, completed_at, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        assignment.id,
        assignment.service_request_id,
        assignment.staff_id,
        assignedAt,
        assignment.started_at || null,
        assignment.completed_at || null,
        assignment.notes || null,
        assignment.status || 'ASSIGNED'
      );

      // 2. Update service request status to ASSIGNED if currently APPROVED or PENDING
      const updateReq = db.prepare(`
        UPDATE service_requests
        SET status = 'ASSIGNED', updated_at = ?
        WHERE id = ? AND status IN ('PENDING', 'APPROVED')
      `);
      updateReq.run(now, assignment.service_request_id);

      return { ...assignment, assigned_at: assignedAt };
    });
  }

  static updateAssignmentStatus(assignmentId: string, status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED', notes?: string) {
    const db = getDatabase();
    const now = new Date().toISOString();

    return withTransaction(() => {
      const getStmt = db.prepare('SELECT * FROM service_assignments WHERE id = ?');
      const assignment = getStmt.get(assignmentId) as unknown as ServiceAssignmentRow;
      if (!assignment) throw new Error('Assignment not found');

      let startedAt = assignment.started_at;
      let completedAt = assignment.completed_at;

      if (status === 'IN_PROGRESS' && !startedAt) {
        startedAt = now;
      }
      if (status === 'COMPLETED' && !completedAt) {
        completedAt = now;
      }

      const stmt = db.prepare(`
        UPDATE service_assignments
        SET status = ?, started_at = ?, completed_at = ?, notes = COALESCE(?, notes)
        WHERE id = ?
      `);
      stmt.run(status, startedAt, completedAt, notes || null, assignmentId);

      // Mirror state on service request
      const reqStatus = status === 'IN_PROGRESS' ? 'IN_PROGRESS' : status === 'COMPLETED' ? 'COMPLETED' : status === 'CANCELLED' ? 'CANCELLED' : 'ASSIGNED';
      const updateReq = db.prepare('UPDATE service_requests SET status = ?, updated_at = ? WHERE id = ?');
      updateReq.run(reqStatus, now, assignment.service_request_id);

      return { ...assignment, status, started_at: startedAt, completed_at: completedAt };
    });
  }

  static getStaffWorkload(companyId: string) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT u.id as staff_id, u.full_name as staff_name, u.email as staff_email,
        COUNT(CASE WHEN sa.status IN ('ASSIGNED', 'IN_PROGRESS') THEN 1 END) as active_tasks,
        COUNT(CASE WHEN sa.status = 'COMPLETED' THEN 1 END) as completed_tasks
      FROM company_memberships m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN service_assignments sa ON u.id = sa.staff_id
      WHERE m.company_id = ? AND m.role = 'STAFF'
      GROUP BY u.id, u.full_name, u.email
      ORDER BY active_tasks ASC
    `);
    return stmt.all(companyId);
  }
}
