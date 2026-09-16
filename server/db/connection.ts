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
