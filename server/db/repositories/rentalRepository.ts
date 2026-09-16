import { getDatabase } from '../connection.js';

export interface RentalApplicationRow {
  id: string;
  room_id: string;
  tenant_id: string;
  intended_start_date: string;
  lease_duration_months: number;
  occupants_count: number;
  notes: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface RentalContractRow {
  id: string;
  contract_number: string;
  application_id: string | null;
  room_id: string;
  tenant_id: string;
  company_id: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  deposit_amount: number;
  payment_frequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  payment_day_of_month: number;
  status: 'DRAFT' | 'PENDING' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'TERMINATED';
  terms: string | null;
  signature_data?: string | null;
  signing_method?: 'CANVAS_DRAW' | 'OTP' | 'DIGITAL_CERT' | null;
  signed_at?: string | null;
  signer_ip?: string | null;
  signer_user_agent?: string | null;
  e_signature_evidence?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DepositRow {
  id: string;
  contract_id: string;
  tenant_id: string;
  amount: number;
  received: number; // 0 or 1
  received_date: string | null;
  refunded: number; // 0 or 1
  refund_amount: number;
  refund_date: string | null;
  status: 'PENDING' | 'HELD' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'FORFEITED';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export class RentalRepository {
  // Applications
  static findApplicationById(id: string): (RentalApplicationRow & { room_number: string; building_name: string; tenant_name: string; tenant_email: string; tenant_phone: string | null }) | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT a.*, r.room_number, b.name as building_name, u.full_name as tenant_name, u.email as tenant_email, u.phone as tenant_phone
      FROM rental_applications a
      JOIN rooms r ON a.room_id = r.id
      JOIN buildings b ON r.building_id = b.id
      JOIN users u ON a.tenant_id = u.id
      WHERE a.id = ?
    `);
    return (stmt.get(id) as any) || null;
  }

  static findAllApplications(options?: { tenantId?: string; companyId?: string; roomId?: string; status?: string; limit?: number; offset?: number }) {
    const db = getDatabase();
    let query = `
      SELECT a.*, r.room_number, r.base_rent, b.name as building_name, b.company_id, u.full_name as tenant_name, u.email as tenant_email, u.phone as tenant_phone
      FROM rental_applications a
      JOIN rooms r ON a.room_id = r.id
      JOIN buildings b ON r.building_id = b.id
      JOIN users u ON a.tenant_id = u.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (options?.tenantId) {
      query += ' AND a.tenant_id = ?';
      params.push(options.tenantId);
    }
    if (options?.companyId) {
      query += ' AND b.company_id = ?';
      params.push(options.companyId);
    }
    if (options?.roomId) {
      query += ' AND a.room_id = ?';
      params.push(options.roomId);
    }
    if (options?.status) {
      query += ' AND a.status = ?';
      params.push(options.status);
    }

    query += ' ORDER BY a.created_at DESC';
    if (options?.limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(options.limit, options.offset || 0);
    }

    const stmt = db.prepare(query);
    return stmt.all(...params) as unknown as (RentalApplicationRow & { room_number: string; base_rent: number; building_name: string; company_id: string; tenant_name: string; tenant_email: string; tenant_phone: string | null })[];
  }

  static createApplication(app: Omit<RentalApplicationRow, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): RentalApplicationRow {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO rental_applications (id, room_id, tenant_id, intended_start_date, lease_duration_months, occupants_count, notes, status, reviewed_by, reviewed_at, rejection_reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      app.id,
      app.room_id,
      app.tenant_id,
      app.intended_start_date,
      app.lease_duration_months || 12,
      app.occupants_count || 1,
      app.notes || null,
      app.status || 'PENDING',
      app.reviewed_by || null,
      app.reviewed_at || null,
      app.rejection_reason || null,
      app.created_at || now,
      app.updated_at || now
    );
    return { ...app, created_at: app.created_at || now, updated_at: app.updated_at || now };
  }

  static updateApplication(id: string, updates: Partial<Omit<RentalApplicationRow, 'id' | 'created_at' | 'updated_at'>>): RentalApplicationRow | null {
    const db = getDatabase();
    const fields: string[] = [];
    const params: (string | number | null)[] = [];

    for (const [key, val] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      params.push(val as string | number | null);
    }

    if (fields.length === 0) return this.findApplicationById(id);

    const now = new Date().toISOString();
    fields.push('updated_at = ?');
    params.push(now);
    params.push(id);

    const stmt = db.prepare(`UPDATE rental_applications SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...params);

    return this.findApplicationById(id);
  }

  // Contracts
  static findContractById(id: string): (RentalContractRow & { room_number: string; building_name: string; building_address: string; tenant_name: string; tenant_email: string; tenant_phone: string | null; company_name: string }) | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT c.*, r.room_number, b.name as building_name, b.address as building_address, u.full_name as tenant_name, u.email as tenant_email, u.phone as tenant_phone, comp.name as company_name
      FROM rental_contracts c
      JOIN rooms r ON c.room_id = r.id
      JOIN buildings b ON r.building_id = b.id
      JOIN users u ON c.tenant_id = u.id
      JOIN companies comp ON c.company_id = comp.id
      WHERE c.id = ?
    `);
    return (stmt.get(id) as any) || null;
  }

  static findActiveContractForTenant(tenantId: string): (RentalContractRow & { room_number: string; room_slug: string; room_type: string; area: number; building_name: string; building_address: string; building_id: string; company_name: string }) | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT c.*, r.room_number, r.slug as room_slug, r.room_type, r.area, b.name as building_name, b.address as building_address, b.id as building_id, comp.name as company_name
      FROM rental_contracts c
      JOIN rooms r ON c.room_id = r.id
      JOIN buildings b ON r.building_id = b.id
      JOIN companies comp ON c.company_id = comp.id
      WHERE c.tenant_id = ? AND c.status IN ('ACTIVE', 'EXPIRING')
      ORDER BY c.start_date DESC
      LIMIT 1
    `);
    return (stmt.get(tenantId) as any) || null;
  }

  static findAllContracts(options?: { tenantId?: string; companyId?: string; roomId?: string; status?: string; search?: string; limit?: number; offset?: number }) {
    const db = getDatabase();
    let query = `
      SELECT c.*, r.room_number, b.name as building_name, u.full_name as tenant_name, u.email as tenant_email, comp.name as company_name
      FROM rental_contracts c
      JOIN rooms r ON c.room_id = r.id
      JOIN buildings b ON r.building_id = b.id
      JOIN users u ON c.tenant_id = u.id
      JOIN companies comp ON c.company_id = comp.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (options?.tenantId) {
      query += ' AND c.tenant_id = ?';
      params.push(options.tenantId);
    }
    if (options?.companyId) {
      query += ' AND c.company_id = ?';
      params.push(options.companyId);
    }
    if (options?.roomId) {
      query += ' AND c.room_id = ?';
      params.push(options.roomId);
    }
    if (options?.status) {
      query += ' AND c.status = ?';
      params.push(options.status);
    }
    if (options?.search) {
      query += ' AND (c.contract_number LIKE ? OR u.full_name LIKE ? OR r.room_number LIKE ?)';
      const term = `%${options.search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY c.created_at DESC';
    if (options?.limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(options.limit, options.offset || 0);
    }

    const stmt = db.prepare(query);
    return stmt.all(...params) as unknown as (RentalContractRow & { room_number: string; building_name: string; tenant_name: string; tenant_email: string; company_name: string })[];
  }

  static createContract(c: Omit<RentalContractRow, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): RentalContractRow {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO rental_contracts (id, contract_number, application_id, room_id, tenant_id, company_id, start_date, end_date, rent_amount, deposit_amount, payment_frequency, payment_day_of_month, status, terms, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      c.id,
      c.contract_number,
      c.application_id || null,
      c.room_id,
      c.tenant_id,
      c.company_id,
      c.start_date,
      c.end_date,
      c.rent_amount,
      c.deposit_amount,
      c.payment_frequency || 'MONTHLY',
      c.payment_day_of_month || 5,
      c.status || 'PENDING',
      c.terms || null,
      c.created_at || now,
      c.updated_at || now
    );
    return { ...c, created_at: c.created_at || now, updated_at: c.updated_at || now };
  }

  static updateContract(id: string, updates: Partial<Omit<RentalContractRow, 'id' | 'created_at' | 'updated_at'>>): RentalContractRow | null {
    const db = getDatabase();
    const fields: string[] = [];
    const params: (string | number | null)[] = [];

    for (const [key, val] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      params.push(val as string | number | null);
    }

    if (fields.length === 0) return this.findContractById(id);

    const now = new Date().toISOString();
    fields.push('updated_at = ?');
    params.push(now);
    params.push(id);

    const stmt = db.prepare(`UPDATE rental_contracts SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...params);

    return this.findContractById(id);
  }

  // Deposits
  static findDepositByContract(contractId: string): DepositRow | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM deposits WHERE contract_id = ?');
    return (stmt.get(contractId) as unknown as DepositRow) || null;
  }

  static createDeposit(d: Omit<DepositRow, 'created_at' | 'updated_at' | 'refunded' | 'refund_amount' | 'refund_date'> & {
    refunded?: number;
    refund_amount?: number;
    refund_date?: string | null;
    created_at?: string;
    updated_at?: string;
  }): DepositRow {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO deposits (id, contract_id, tenant_id, amount, received, received_date, refunded, refund_amount, refund_date, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const createdAt = d.created_at || now;
    const updatedAt = d.updated_at || now;
    const refunded = d.refunded ?? 0;
    const refundAmount = d.refund_amount ?? 0;
    const refundDate = d.refund_date ?? null;

    stmt.run(
      d.id,
      d.contract_id,
      d.tenant_id,
      d.amount,
      d.received || 0,
      d.received_date || null,
      refunded,
      refundAmount,
      refundDate,
      d.status || 'PENDING',
      d.notes || null,
      createdAt,
      updatedAt
    );
    return {
      ...d,
      refunded,
      refund_amount: refundAmount,
      refund_date: refundDate,
      created_at: createdAt,
      updated_at: updatedAt
    };
  }

  static updateDeposit(id: string, updates: Partial<Omit<DepositRow, 'id' | 'contract_id' | 'created_at' | 'updated_at'>>): DepositRow | null {
    const db = getDatabase();
    const fields: string[] = [];
    const params: (string | number | null)[] = [];

    for (const [key, val] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      params.push(val as string | number | null);
    }

    if (fields.length === 0) return null;

    const now = new Date().toISOString();
    fields.push('updated_at = ?');
    params.push(now);
    params.push(id);

    const stmt = db.prepare(`UPDATE deposits SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...params);

    const check = db.prepare('SELECT * FROM deposits WHERE id = ?');
    return (check.get(id) as unknown as DepositRow) || null;
  }
}
