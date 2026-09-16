import { getDatabase } from '../connection.js';

export interface CompanyRow {
  id: string;
  name: string;
  type: 'COMPANY' | 'HOUSEHOLD_BUSINESS';
  tax_code: string | null;
  business_registration_number: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface CompanyMembershipRow {
  id: string;
  user_id: string;
  company_id: string;
  role: 'ADMIN' | 'STAFF' | 'MANAGER';
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export class CompanyRepository {
  static findById(id: string): CompanyRow | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM companies WHERE id = ?');
    return (stmt.get(id) as unknown as CompanyRow) || null;
  }

  static findAll(options?: { type?: string; status?: string; search?: string; limit?: number; offset?: number }) {
    const db = getDatabase();
    let query = 'SELECT * FROM companies WHERE 1=1';
    const params: (string | number)[] = [];

    if (options?.type) {
      query += ' AND type = ?';
      params.push(options.type);
    }
    if (options?.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }
    if (options?.search) {
      query += ' AND (name LIKE ? OR email LIKE ? OR tax_code LIKE ?)';
      const term = `%${options.search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY created_at DESC';
    if (options?.limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(options.limit, options.offset || 0);
    }

    const stmt = db.prepare(query);
    return stmt.all(...params) as unknown as CompanyRow[];
  }

  static count(options?: { type?: string; status?: string; search?: string }): number {
    const db = getDatabase();
    let query = 'SELECT COUNT(*) as count FROM companies WHERE 1=1';
    const params: (string | number)[] = [];

    if (options?.type) {
      query += ' AND type = ?';
      params.push(options.type);
    }
    if (options?.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }
    if (options?.search) {
      query += ' AND (name LIKE ? OR email LIKE ? OR tax_code LIKE ?)';
      const term = `%${options.search}%`;
      params.push(term, term, term);
    }

    const stmt = db.prepare(query);
    const res = stmt.get(...params) as { count: number };
    return res.count;
  }

  static create(company: Omit<CompanyRow, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): CompanyRow {
    const db = getDatabase();
    const now = new Date().toISOString();
    const createdAt = company.created_at || now;
    const updatedAt = company.updated_at || now;

    const stmt = db.prepare(`
      INSERT INTO companies (id, name, type, tax_code, business_registration_number, phone, email, address, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      company.id,
      company.name,
      company.type,
      company.tax_code || null,
      company.business_registration_number || null,
      company.phone || null,
      company.email || null,
      company.address || null,
      company.status || 'ACTIVE',
      createdAt,
      updatedAt
    );

    return {
      ...company,
      created_at: createdAt,
      updated_at: updatedAt
    };
  }

  static update(id: string, updates: Partial<Omit<CompanyRow, 'id' | 'created_at' | 'updated_at'>>): CompanyRow | null {
    const db = getDatabase();
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const params: (string | null)[] = [];

    for (const [key, val] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      params.push(val as string | null);
    }

    if (fields.length === 0) return existing;

    const now = new Date().toISOString();
    fields.push('updated_at = ?');
    params.push(now);
    params.push(id);

    const stmt = db.prepare(`UPDATE companies SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...params);

    return this.findById(id);
  }

  // Memberships
  static createMembership(membership: Omit<CompanyMembershipRow, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): CompanyMembershipRow {
    const db = getDatabase();
    const now = new Date().toISOString();
    const createdAt = membership.created_at || now;
    const updatedAt = membership.updated_at || now;

    const stmt = db.prepare(`
      INSERT INTO company_memberships (id, user_id, company_id, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, company_id) DO UPDATE SET
        role = excluded.role,
        status = excluded.status,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      membership.id,
      membership.user_id,
      membership.company_id,
      membership.role,
      membership.status || 'ACTIVE',
      createdAt,
      updatedAt
    );

    return {
      ...membership,
      created_at: createdAt,
      updated_at: updatedAt
    };
  }

  static findMembership(userId: string, companyId: string): CompanyMembershipRow | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM company_memberships WHERE user_id = ? AND company_id = ?');
    return (stmt.get(userId, companyId) as unknown as CompanyMembershipRow) || null;
  }

  static findUserMemberships(userId: string): (CompanyMembershipRow & { company_name: string; company_type: string })[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT m.*, c.name as company_name, c.type as company_type
      FROM company_memberships m
      JOIN companies c ON m.company_id = c.id
      WHERE m.user_id = ? AND m.status = 'ACTIVE'
    `);
    return stmt.all(userId) as unknown as (CompanyMembershipRow & { company_name: string; company_type: string })[];
  }

  static findCompanyMembers(companyId: string): (CompanyMembershipRow & { full_name: string; email: string; phone: string | null; avatar_url: string | null })[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT m.*, u.full_name, u.email, u.phone, u.avatar_url
      FROM company_memberships m
      JOIN users u ON m.user_id = u.id
      WHERE m.company_id = ? AND m.status = 'ACTIVE'
    `);
    return stmt.all(companyId) as unknown as (CompanyMembershipRow & { full_name: string; email: string; phone: string | null; avatar_url: string | null })[];
  }
}
