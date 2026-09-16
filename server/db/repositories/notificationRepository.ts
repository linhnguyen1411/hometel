import { getDatabase } from '../connection.js';

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  channel?: 'IN_APP' | 'ZALO_ZNS' | 'ZALO_OA' | 'SMS' | 'EMAIL';
  delivery_status?: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
  recipient_phone?: string | null;
  metadata?: string | null;
  read_at: string | null;
  created_at: string;
}

export type CreateNotificationInput = Omit<NotificationRow, 'created_at' | 'read_at'> & {
  read_at?: string | null;
  created_at?: string;
};

export class NotificationRepository {
  static findByUser(userId: string, limit = 20): NotificationRow[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(userId, limit) as unknown as NotificationRow[];
  }

  static getUnreadCount(userId: string): number {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM notifications
      WHERE user_id = ? AND read_at IS NULL
    `);
    const res = stmt.get(userId) as unknown as { count: number };
    return res.count;
  }

  static create(n: CreateNotificationInput): NotificationRow {
    const db = getDatabase();
    const now = new Date().toISOString();
    const createdAt = n.created_at || now;
    const channel = n.channel || 'IN_APP';
    const deliveryStatus = n.delivery_status || 'DELIVERED';
    const recipientPhone = n.recipient_phone || null;
    const metadata = n.metadata || null;

    const stmt = db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, entity_type, entity_id, channel, delivery_status, recipient_phone, metadata, read_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      n.id,
      n.user_id,
      n.type,
      n.title,
      n.message,
      n.entity_type || null,
      n.entity_id || null,
      channel,
      deliveryStatus,
      recipientPhone,
      metadata,
      n.read_at || null,
      createdAt
    );
    return {
      ...n,
      channel,
      delivery_status: deliveryStatus,
      recipient_phone: recipientPhone,
      metadata,
      read_at: n.read_at || null,
      created_at: createdAt
    };
  }

  static markAsRead(id: string, userId: string): boolean {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE notifications
      SET read_at = ?
      WHERE id = ? AND user_id = ?
    `);
    const res = stmt.run(now, id, userId);
    return res.changes > 0;
  }

  static markAllAsRead(userId: string): number {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE notifications
      SET read_at = ?
      WHERE user_id = ? AND read_at IS NULL
    `);
    const res = stmt.run(now, userId);
    return Number(res.changes);
  }
}
