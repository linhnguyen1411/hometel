import { getDatabase, withTransaction } from '../connection.js';

export interface MeterRow {
  id: string;
  room_id: string;
  type: 'ELECTRICITY' | 'WATER';
  serial_number: string;
  initial_reading: number;
  current_reading: number;
  status: 'ACTIVE' | 'FAULTY' | 'REPLACED';
  created_at: string;
  updated_at: string;
}

export interface MeterReadingRow {
  id: string;
  meter_id: string;
  previous_reading: number;
  reading_value: number;
  consumption: number;
  reading_date: string;
  recorded_by: string;
  notes: string | null;
  created_at: string;
}

export interface InvoiceRow {
  id: string;
  invoice_number: string;
  tenant_id: string;
  contract_id: string;
  company_id: string;
  room_id: string;
  issue_date: string;
  due_date: string;
  billing_month: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid_amount: number;
  outstanding_amount: number;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItemRow {
  id: string;
  invoice_id: string;
  type: 'RENT' | 'ELECTRICITY' | 'WATER' | 'INTERNET' | 'GARBAGE' | 'PARKING' | 'CLEANING' | 'OTHER';
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  metadata: string | null;
}

export interface PaymentRow {
  id: string;
  invoice_id: string;
  tenant_id: string;
  company_id: string;
  amount: number;
  method: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'ONLINE' | 'OTHER';
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  transaction_reference: string | null;
  paid_at: string;
  notes: string | null;
  created_at: string;
}

export class BillingRepository {
  // Meters
  static findMetersByRoom(roomId: string): MeterRow[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM meters WHERE room_id = ? ORDER BY type ASC');
    return stmt.all(roomId) as MeterRow[];
  }

  static findMeterById(id: string): MeterRow | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM meters WHERE id = ?');
    return (stmt.get(id) as MeterRow) || null;
  }

  static createMeter(m: Omit<MeterRow, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): MeterRow {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO meters (id, room_id, type, serial_number, initial_reading, current_reading, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(m.id, m.room_id, m.type, m.serial_number, m.initial_reading || 0, m.current_reading || 0, m.status || 'ACTIVE', m.created_at || now, m.updated_at || now);
    return { ...m, created_at: m.created_at || now, updated_at: m.updated_at || now };
  }

  // Meter Readings
  static recordMeterReading(reading: Omit<MeterReadingRow, 'created_at'> & { created_at?: string }): MeterReadingRow {
    const db = getDatabase();
    const now = new Date().toISOString();

    return withTransaction(() => {
      // 1. Insert reading
      const stmt = db.prepare(`
        INSERT INTO meter_readings (id, meter_id, previous_reading, reading_value, consumption, reading_date, recorded_by, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        reading.id,
        reading.meter_id,
        reading.previous_reading,
        reading.reading_value,
        reading.consumption,
        reading.reading_date,
        reading.recorded_by,
        reading.notes || null,
        reading.created_at || now
      );

      // 2. Update meter current reading
      const updateStmt = db.prepare(`
        UPDATE meters
        SET current_reading = ?, updated_at = ?
        WHERE id = ?
      `);
      updateStmt.run(reading.reading_value, now, reading.meter_id);

      return { ...reading, created_at: reading.created_at || now };
    });
  }

  static findReadingsByMeter(meterId: string, limit = 12): MeterReadingRow[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM meter_readings WHERE meter_id = ? ORDER BY reading_date DESC LIMIT ?');
    return stmt.all(meterId, limit) as MeterReadingRow[];
  }

  // Invoices
  static findInvoiceById(id: string): (InvoiceRow & { tenant_name: string; tenant_email: string; room_number: string; building_name: string; company_name: string; items: InvoiceItemRow[] }) | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT i.*, u.full_name as tenant_name, u.email as tenant_email, r.room_number, b.name as building_name, comp.name as company_name
      FROM invoices i
      JOIN users u ON i.tenant_id = u.id
      JOIN rooms r ON i.room_id = r.id
      JOIN buildings b ON r.building_id = b.id
      JOIN companies comp ON i.company_id = comp.id
      WHERE i.id = ?
    `);
    const invoice = stmt.get(id) as any;
    if (!invoice) return null;

    const itemsStmt = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?');
    invoice.items = itemsStmt.all(id) as InvoiceItemRow[];
    return invoice;
  }

  static findAllInvoices(options?: {
    tenantId?: string;
    companyId?: string;
    contractId?: string;
    status?: string;
    billingMonth?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const db = getDatabase();
    let query = `
      SELECT i.*, u.full_name as tenant_name, u.email as tenant_email, r.room_number, b.name as building_name, comp.name as company_name
      FROM invoices i
      JOIN users u ON i.tenant_id = u.id
      JOIN rooms r ON i.room_id = r.id
      JOIN buildings b ON r.building_id = b.id
      JOIN companies comp ON i.company_id = comp.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (options?.tenantId) {
      query += ' AND i.tenant_id = ?';
      params.push(options.tenantId);
    }
    if (options?.companyId) {
      query += ' AND i.company_id = ?';
      params.push(options.companyId);
    }
    if (options?.contractId) {
      query += ' AND i.contract_id = ?';
      params.push(options.contractId);
    }
    if (options?.status) {
      query += ' AND i.status = ?';
      params.push(options.status);
    }
    if (options?.billingMonth) {
      query += ' AND i.billing_month = ?';
      params.push(options.billingMonth);
    }
    if (options?.search) {
      query += ' AND (i.invoice_number LIKE ? OR u.full_name LIKE ? OR r.room_number LIKE ?)';
      const term = `%${options.search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY i.issue_date DESC';
    if (options?.limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(options.limit, options.offset || 0);
    }

    const stmt = db.prepare(query);
    return stmt.all(...params) as (InvoiceRow & { tenant_name: string; tenant_email: string; room_number: string; building_name: string; company_name: string })[];
  }

  static createInvoiceWithItems(invoice: Omit<InvoiceRow, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }, items: InvoiceItemRow[]): InvoiceRow {
    const db = getDatabase();
    const now = new Date().toISOString();
    const createdAt = invoice.created_at || now;
    const updatedAt = invoice.updated_at || now;

    return withTransaction(() => {
      const invStmt = db.prepare(`
        INSERT INTO invoices (id, invoice_number, tenant_id, contract_id, company_id, room_id, issue_date, due_date, billing_month, subtotal, discount, tax, total, paid_amount, outstanding_amount, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      invStmt.run(
        invoice.id,
        invoice.invoice_number,
        invoice.tenant_id,
        invoice.contract_id,
        invoice.company_id,
        invoice.room_id,
        invoice.issue_date,
        invoice.due_date,
        invoice.billing_month,
        invoice.subtotal,
        invoice.discount || 0,
        invoice.tax || 0,
        invoice.total,
        invoice.paid_amount || 0,
        invoice.outstanding_amount,
        invoice.status || 'ISSUED',
        invoice.notes || null,
        createdAt,
        updatedAt
      );

      const itemStmt = db.prepare(`
        INSERT INTO invoice_items (id, invoice_id, type, description, quantity, unit_price, amount, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        itemStmt.run(item.id, invoice.id, item.type, item.description, item.quantity, item.unit_price, item.amount, item.metadata || null);
      }

      return { ...invoice, created_at: createdAt, updated_at: updatedAt };
    });
  }

  // Payments & Financial Transaction Integrity
  static createPaymentTransaction(payment: Omit<PaymentRow, 'created_at'> & { created_at?: string }, actorId?: string): { payment: PaymentRow; invoice: InvoiceRow } {
    const db = getDatabase();
    const now = new Date().toISOString();
    const createdAt = payment.created_at || now;

    return withTransaction(() => {
      // 1. Get current invoice
      const invStmt = db.prepare('SELECT * FROM invoices WHERE id = ?');
      const invoice = invStmt.get(payment.invoice_id) as InvoiceRow;
      if (!invoice) {
        throw new Error(`Invoice ${payment.invoice_id} not found`);
      }

      if (invoice.status === 'PAID' && invoice.outstanding_amount <= 0) {
        throw new Error('Invoice is already fully paid');
      }

      // 2. Insert Payment record
      const payStmt = db.prepare(`
        INSERT INTO payments (id, invoice_id, tenant_id, company_id, amount, method, status, transaction_reference, paid_at, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      payStmt.run(
        payment.id,
        payment.invoice_id,
        payment.tenant_id,
        payment.company_id,
        payment.amount,
        payment.method,
        payment.status || 'SUCCESS',
        payment.transaction_reference || null,
        payment.paid_at,
        payment.notes || null,
        createdAt
      );

      // 3. Update invoice paid_amount and outstanding_amount atomically
      const newPaidAmount = Math.min(invoice.total, invoice.paid_amount + payment.amount);
      const newOutstanding = Math.max(0, invoice.total - newPaidAmount);
      const newStatus = newOutstanding === 0 ? 'PAID' : 'PARTIALLY_PAID';

      const updateInvStmt = db.prepare(`
        UPDATE invoices
        SET paid_amount = ?, outstanding_amount = ?, status = ?, updated_at = ?
        WHERE id = ?
      `);
      updateInvStmt.run(newPaidAmount, newOutstanding, newStatus, now, invoice.id);

      // 4. Record Audit Log for payment & invoice update
      const auditStmt = db.prepare(`
        INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, old_value, new_value, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const auditId = 'aud_' + Math.random().toString(36).substring(2, 10);
      auditStmt.run(
        auditId,
        actorId || payment.tenant_id,
        'CREATE_PAYMENT',
        'INVOICE',
        invoice.id,
        JSON.stringify({ paid_amount: invoice.paid_amount, outstanding_amount: invoice.outstanding_amount, status: invoice.status }),
        JSON.stringify({ payment_id: payment.id, amount: payment.amount, paid_amount: newPaidAmount, outstanding_amount: newOutstanding, status: newStatus }),
        now
      );

      const updatedInvoice: InvoiceRow = {
        ...invoice,
        paid_amount: newPaidAmount,
        outstanding_amount: newOutstanding,
        status: newStatus as any,
        updated_at: now
      };

      return {
        payment: { ...payment, created_at: createdAt },
        invoice: updatedInvoice
      };
    });
  }

  static findPaymentsByInvoice(invoiceId: string): PaymentRow[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY paid_at DESC');
    return stmt.all(invoiceId) as PaymentRow[];
  }

  static findAllPayments(options?: { tenantId?: string; companyId?: string; status?: string; limit?: number; offset?: number }) {
    const db = getDatabase();
    let query = `
      SELECT p.*, i.invoice_number, u.full_name as tenant_name, comp.name as company_name
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN users u ON p.tenant_id = u.id
      JOIN companies comp ON p.company_id = comp.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (options?.tenantId) {
      query += ' AND p.tenant_id = ?';
      params.push(options.tenantId);
    }
    if (options?.companyId) {
      query += ' AND p.company_id = ?';
      params.push(options.companyId);
    }
    if (options?.status) {
      query += ' AND p.status = ?';
      params.push(options.status);
    }

    query += ' ORDER BY p.paid_at DESC';
    if (options?.limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(options.limit, options.offset || 0);
    }

    const stmt = db.prepare(query);
    return stmt.all(...params) as (PaymentRow & { invoice_number: string; tenant_name: string; company_name: string })[];
  }
}
