import { getDatabase } from '../connection.js';

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value: string | null;
  new_value: string | null;
  ip_address: string | null;
  created_at: string;
}

export type CreateAuditLogInput = Omit<AuditLogRow, 'created_at' | 'actor_email' | 'ip_address' | 'old_value' | 'new_value'> & {
  actor_email?: string | null;
  ip_address?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  created_at?: string;
};

export class AuditRepository {
  static create(log: CreateAuditLogInput): AuditLogRow {
    const db = getDatabase();
    const now = new Date().toISOString();
    const createdAt = log.created_at || now;

    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, actor_id, actor_email, action, entity_type, entity_id, old_value, new_value, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      log.id,
      log.actor_id || null,
      log.actor_email || null,
      log.action,
      log.entity_type,
      log.entity_id,
      log.old_value || null,
      log.new_value || null,
      log.ip_address || null,
      createdAt
    );

    return {
      ...log,
      old_value: log.old_value || null,
      new_value: log.new_value || null,
      actor_email: log.actor_email || null,
      ip_address: log.ip_address || null,
      created_at: createdAt
    };
  }

  static findAll(options?: {
    actorId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    limit?: number;
    offset?: number;
  }): AuditLogRow[] {
    const db = getDatabase();
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: (string | number)[] = [];

    if (options?.actorId) {
      query += ' AND actor_id = ?';
      params.push(options.actorId);
    }
    if (options?.action) {
      query += ' AND action = ?';
      params.push(options.action);
    }
    if (options?.entityType) {
      query += ' AND entity_type = ?';
      params.push(options.entityType);
    }
    if (options?.entityId) {
      query += ' AND entity_id = ?';
      params.push(options.entityId);
    }

    query += ' ORDER BY created_at DESC';
    if (options?.limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(options.limit, options.offset || 0);
    }

    const stmt = db.prepare(query);
    return stmt.all(...params) as AuditLogRow[];
  }
}
