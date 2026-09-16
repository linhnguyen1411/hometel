import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// Ensure data directory exists
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.resolve(dataDir, 'rental.db');

export class DatabaseClient {
  private static instance: DatabaseSync | null = null;

  public static getDb(): DatabaseSync {
    if (!this.instance) {
      this.instance = new DatabaseSync(dbPath);
      // Enforce foreign keys and WAL mode for high concurrency
      this.instance.exec('PRAGMA foreign_keys = ON;');
      this.instance.exec('PRAGMA journal_mode = WAL;');

      // Initialize schema
      const schemaPath = path.resolve(process.cwd(), 'server/db/schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        this.instance.exec(schemaSql);
      }

      // Operational tables
      this.instance.exec(`
        CREATE TABLE IF NOT EXISTS action_dismissals (
          id TEXT PRIMARY KEY,
          action_key TEXT UNIQUE NOT NULL,
          dismissed_until TEXT,
          reason TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_action_dismissals_key ON action_dismissals(action_key);
      `);

      // Safe column migrations for Phase 2: E-Signature & Multi-channel notifications
      const safeAddColumn = (table: string, colDef: string) => {
        try {
          this.instance!.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef};`);
        } catch {
          // Column already exists
        }
      };

      safeAddColumn('rental_contracts', 'signature_data TEXT');
      safeAddColumn('rental_contracts', 'signing_method TEXT');
      safeAddColumn('rental_contracts', 'signed_at TEXT');
      safeAddColumn('rental_contracts', 'signer_ip TEXT');
      safeAddColumn('rental_contracts', 'signer_user_agent TEXT');
      safeAddColumn('rental_contracts', 'e_signature_evidence TEXT');

      safeAddColumn('notifications', 'channel TEXT DEFAULT "IN_APP"');
      safeAddColumn('notifications', 'delivery_status TEXT DEFAULT "DELIVERED"');
      safeAddColumn('notifications', 'recipient_phone TEXT');
      safeAddColumn('notifications', 'metadata TEXT');

      // Safe column migrations for Phase 4: OCR Meter Readings
      safeAddColumn('meter_readings', 'image_url TEXT');
      safeAddColumn('meter_readings', 'ocr_confidence REAL');
      safeAddColumn('meter_readings', 'ocr_raw_text TEXT');

      // Ensure Phase 4 tables exist
      this.instance!.exec(`
        CREATE TABLE IF NOT EXISTS crm_leads (
          id TEXT PRIMARY KEY,
          company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          full_name TEXT NOT NULL,
          phone TEXT NOT NULL,
          email TEXT,
          source TEXT NOT NULL DEFAULT 'WEBSITE' CHECK(source IN ('WEBSITE', 'FACEBOOK', 'REFERRAL', 'WALK_IN', 'ZALO', 'HOTLINE', 'OTHER')),
          status TEXT NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW', 'CONTACTED', 'TOUR_SCHEDULED', 'TOUR_COMPLETED', 'CONVERTED', 'LOST')),
          budget_min REAL,
          budget_max REAL,
          preferred_room_type TEXT,
          move_in_date TEXT,
          notes TEXT,
          assigned_staff_id TEXT REFERENCES users(id),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_crm_leads_company ON crm_leads(company_id);
        CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON crm_leads(status);

        CREATE TABLE IF NOT EXISTS room_tours (
          id TEXT PRIMARY KEY,
          lead_id TEXT NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
          room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
          scheduled_at TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK(status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
          host_staff_id TEXT REFERENCES users(id),
          feedback TEXT,
          rating INTEGER CHECK(rating IS NULL OR (rating >= 1 AND rating <= 5)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_room_tours_lead ON room_tours(lead_id);
        CREATE INDEX IF NOT EXISTS idx_room_tours_room ON room_tours(room_id);
        CREATE INDEX IF NOT EXISTS idx_room_tours_status ON room_tours(status);

        CREATE TABLE IF NOT EXISTS building_expenses (
          id TEXT PRIMARY KEY,
          building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
          category TEXT NOT NULL CHECK(category IN ('UTILITY_MUNICIPAL', 'MAINTENANCE_REPAIR', 'CLEANING_JANITORIAL', 'SECURITY', 'INTERNET_TELECOM', 'TAX_INSURANCE', 'STAFF_SALARY', 'OTHER')),
          description TEXT NOT NULL,
          amount REAL NOT NULL,
          expense_date TEXT NOT NULL,
          period_month TEXT NOT NULL,
          vendor_name TEXT,
          receipt_url TEXT,
          created_by TEXT REFERENCES users(id),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_building_expenses_bld ON building_expenses(building_id);
        CREATE INDEX IF NOT EXISTS idx_building_expenses_month ON building_expenses(period_month);
      `);
    }
    return this.instance;
  }

  private static transactionDepth = 0;

  // Atomic transaction wrapper with support for nested calls (via SQLite SAVEPOINTS)
  public static withTransaction<T>(operation: (db: DatabaseSync) => T): T {
    const db = this.getDb();
    const depth = this.transactionDepth;
    const savepointName = `sp_${depth}`;

    if (depth === 0) {
      db.exec('BEGIN TRANSACTION;');
    } else {
      db.exec(`SAVEPOINT ${savepointName};`);
    }
    this.transactionDepth++;

    try {
      const result = operation(db);
      if (depth === 0) {
        db.exec('COMMIT;');
      } else {
        db.exec(`RELEASE SAVEPOINT ${savepointName};`);
      }
      return result;
    } catch (error) {
      try {
        if (depth === 0) {
          db.exec('ROLLBACK;');
        } else {
          db.exec(`ROLLBACK TO SAVEPOINT ${savepointName};`);
        }
      } catch (rollbackErr) {
        console.error('Error during rollback:', rollbackErr);
      }
      throw error;
    } finally {
      this.transactionDepth--;
    }
  }
}

export const getDatabase = (): any => DatabaseClient.getDb();
export const withTransaction = DatabaseClient.withTransaction.bind(DatabaseClient);
