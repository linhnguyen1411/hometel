import { getDatabase } from '../connection.js';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone: string | null;
  role: 'SUPER_ADMIN' | 'OWNER' | 'PROVIDER' | 'TENANT' | 'STAFF';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export class UserRepository {
  static findById(id: string): UserRow | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return (stmt.get(id) as unknown as UserRow) || null;
  }

  static findByEmail(email: string): UserRow | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)');
    return (stmt.get(email.trim()) as unknown as UserRow) || null;
  }

  static findAll(options?: { role?: string; status?: string; search?: string; limit?: number; offset?: number }) {
    const db = getDatabase();
    let query = 'SELECT id, email, full_name, phone, role, status, avatar_url, created_at, updated_at FROM users WHERE 1=1';
    const params: (string | number)[] = [];

    if (options?.role) {
      query += ' AND role = ?';
      params.push(options.role);
    }
    if (options?.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }
    if (options?.search) {
      query += ' AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      const term = `%${options.search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY created_at DESC';
    if (options?.limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(options.limit, options.offset || 0);
    }

    const stmt = db.prepare(query);
    return stmt.all(...params) as Omit<UserRow, 'password_hash'>[];
  }

  static count(options?: { role?: string; status?: string; search?: string }): number {
    const db = getDatabase();
    let query = 'SELECT COUNT(*) as count FROM users WHERE 1=1';
    const params: (string | number)[] = [];

    if (options?.role) {
      query += ' AND role = ?';
      params.push(options.role);
    }
    if (options?.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }
    if (options?.search) {
      query += ' AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      const term = `%${options.search}%`;
      params.push(term, term, term);
    }

    const stmt = db.prepare(query);
    const res = stmt.get(...params) as { count: number };
    return res.count;
  }

  static create(user: Omit<UserRow, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): UserRow {
    const db = getDatabase();
    const now = new Date().toISOString();
    const createdAt = user.created_at || now;
    const updatedAt = user.updated_at || now;

    const stmt = db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, phone, role, status, avatar_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      user.id,
      user.email.toLowerCase(),
      user.password_hash,
      user.full_name,
      user.phone || null,
      user.role,
      user.status || 'ACTIVE',
      user.avatar_url || null,
      createdAt,
      updatedAt
    );

    return {
      ...user,
      email: user.email.toLowerCase(),
      status: user.status || 'ACTIVE',
      phone: user.phone || null,
      avatar_url: user.avatar_url || null,
      created_at: createdAt,
      updated_at: updatedAt
    };
  }

  static update(id: string, updates: Partial<Pick<UserRow, 'full_name' | 'phone' | 'status' | 'avatar_url' | 'password_hash'>>): UserRow | null {
    const db = getDatabase();
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const params: (string | null)[] = [];

    if (updates.full_name !== undefined) {
      fields.push('full_name = ?');
      params.push(updates.full_name);
    }
    if (updates.phone !== undefined) {
      fields.push('phone = ?');
      params.push(updates.phone);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      params.push(updates.status);
    }
    if (updates.avatar_url !== undefined) {
      fields.push('avatar_url = ?');
      params.push(updates.avatar_url);
    }
    if (updates.password_hash !== undefined) {
      fields.push('password_hash = ?');
      params.push(updates.password_hash);
    }

    if (fields.length === 0) return existing;

    const now = new Date().toISOString();
    fields.push('updated_at = ?');
    params.push(now);
    params.push(id);

    const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...params);

    return this.findById(id);
  }

  // Refresh token methods
  static saveRefreshToken(id: string, userId: string, tokenHash: string, expiresAt: string) {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO refresh_tokens (id, user_id, token_hash, revoked, expires_at, created_at)
      VALUES (?, ?, ?, 0, ?, ?)
    `);
    stmt.run(id, userId, tokenHash, expiresAt, now);
  }

  static findRefreshToken(tokenHash: string) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = 0');
    return stmt.get(tokenHash) as { id: string; user_id: string; token_hash: string; revoked: number; expires_at: string; created_at: string } | null;
  }

  static revokeRefreshToken(tokenHash: string) {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?');
    stmt.run(tokenHash);
  }

  static revokeAllUserRefreshTokens(userId: string) {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?');
    stmt.run(userId);
  }
}
