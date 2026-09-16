import { DatabaseClient } from '../connection.js';

export interface CrmLeadRow {
  id: string;
  company_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  source: 'WEBSITE' | 'FACEBOOK' | 'REFERRAL' | 'WALK_IN' | 'ZALO' | 'HOTLINE' | 'OTHER';
  status: 'NEW' | 'CONTACTED' | 'TOUR_SCHEDULED' | 'TOUR_COMPLETED' | 'CONVERTED' | 'LOST';
  budget_min: number | null;
  budget_max: number | null;
  preferred_room_type: string | null;
  move_in_date: string | null;
  notes: string | null;
  assigned_staff_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoomTourRow {
  id: string;
  lead_id: string;
  room_id: string;
  scheduled_at: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  host_staff_id: string | null;
  feedback: string | null;
  rating: number | null;
  created_at: string;
  updated_at: string;
}

export class CrmRepository {
  private static getDb() {
    return DatabaseClient.getDb();
  }

  static findLeadsByCompanyId(companyId: string, filter?: { status?: string; search?: string }): (CrmLeadRow & { tour_count?: number; assigned_staff_name?: string })[] {
    const db = this.getDb();
    let sql = `
      SELECT l.*,
        (SELECT COUNT(*) FROM room_tours t WHERE t.lead_id = l.id) AS tour_count,
        u.full_name AS assigned_staff_name
      FROM crm_leads l
      LEFT JOIN users u ON l.assigned_staff_id = u.id
      WHERE l.company_id = ?
    `;
    const params: any[] = [companyId];

    if (filter?.status && filter.status !== 'ALL') {
      sql += ' AND l.status = ?';
      params.push(filter.status);
    }

    if (filter?.search) {
      sql += ' AND (l.full_name LIKE ? OR l.phone LIKE ? OR l.email LIKE ?)';
      const term = `%${filter.search}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY l.created_at DESC';
    return db.prepare(sql).all(...params) as any;
  }

  static findLeadById(id: string): CrmLeadRow | null {
    const db = this.getDb();
    const row = db.prepare('SELECT * FROM crm_leads WHERE id = ?').get(id);
    return (row as unknown as CrmLeadRow) || null;
  }

  static createLead(lead: CrmLeadRow): CrmLeadRow {
    const db = this.getDb();
    db.prepare(`
      INSERT INTO crm_leads (
        id, company_id, full_name, phone, email, source, status,
        budget_min, budget_max, preferred_room_type, move_in_date, notes,
        assigned_staff_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      lead.id, lead.company_id, lead.full_name, lead.phone, lead.email, lead.source, lead.status,
      lead.budget_min, lead.budget_max, lead.preferred_room_type, lead.move_in_date, lead.notes,
      lead.assigned_staff_id, lead.created_at, lead.updated_at
    );
    return lead;
  }

  static updateLead(id: string, updates: Partial<CrmLeadRow>): CrmLeadRow {
    const db = this.getDb();
    const fields = Object.keys(updates).filter(k => k !== 'id');
    if (fields.length === 0) return this.findLeadById(id)!;

    const setClauses = fields.map(k => `${k} = ?`).join(', ');
    const values = fields.map(k => (updates as any)[k]);
    values.push(id);

    db.prepare(`UPDATE crm_leads SET ${setClauses} WHERE id = ?`).run(...values);
    return this.findLeadById(id)!;
  }

  static findToursByCompanyId(companyId: string, filter?: { status?: string }): (RoomTourRow & { lead_name: string; lead_phone: string; room_number: string; building_name: string })[] {
    const db = this.getDb();
    let sql = `
      SELECT t.*,
        l.full_name AS lead_name,
        l.phone AS lead_phone,
        r.room_number,
        b.name AS building_name
      FROM room_tours t
      JOIN crm_leads l ON t.lead_id = l.id
      JOIN rooms r ON t.room_id = r.id
      JOIN buildings b ON r.building_id = b.id
      WHERE l.company_id = ?
    `;
    const params: any[] = [companyId];

    if (filter?.status && filter.status !== 'ALL') {
      sql += ' AND t.status = ?';
      params.push(filter.status);
    }

    sql += ' ORDER BY t.scheduled_at ASC';
    return db.prepare(sql).all(...params) as any;
  }

  static findTourById(id: string): RoomTourRow | null {
    const db = this.getDb();
    const row = db.prepare('SELECT * FROM room_tours WHERE id = ?').get(id);
    return (row as unknown as RoomTourRow) || null;
  }

  static createTour(tour: RoomTourRow): RoomTourRow {
    const db = this.getDb();
    db.prepare(`
      INSERT INTO room_tours (
        id, lead_id, room_id, scheduled_at, status, host_staff_id,
        feedback, rating, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tour.id, tour.lead_id, tour.room_id, tour.scheduled_at, tour.status,
      tour.host_staff_id, tour.feedback, tour.rating, tour.created_at, tour.updated_at
    );
    return tour;
  }

  static updateTour(id: string, updates: Partial<RoomTourRow>): RoomTourRow {
    const db = this.getDb();
    const fields = Object.keys(updates).filter(k => k !== 'id');
    if (fields.length === 0) return this.findTourById(id)!;

    const setClauses = fields.map(k => `${k} = ?`).join(', ');
    const values = fields.map(k => (updates as any)[k]);
    values.push(id);

    db.prepare(`UPDATE room_tours SET ${setClauses} WHERE id = ?`).run(...values);
    return this.findTourById(id)!;
  }

  static getFunnelCounts(companyId: string) {
    const db = this.getDb();
    const rows = db.prepare(`
      SELECT status, COUNT(*) AS count
      FROM crm_leads
      WHERE company_id = ?
      GROUP BY status
    `).all(companyId) as { status: string; count: number }[];

    const stats = {
      TOTAL: 0,
      NEW: 0,
      CONTACTED: 0,
      TOUR_SCHEDULED: 0,
      TOUR_COMPLETED: 0,
      CONVERTED: 0,
      LOST: 0
    };

    for (const r of rows) {
      if ((stats as any)[r.status] !== undefined) {
        (stats as any)[r.status] = Number(r.count);
      }
      stats.TOTAL += Number(r.count);
    }

    return stats;
  }
}
