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
    }
    return this.instance;
  }

  // Atomic transaction wrapper
  public static withTransaction<T>(operation: (db: DatabaseSync) => T): T {
    const db = this.getDb();
    db.exec('BEGIN TRANSACTION;');
    try {
      const result = operation(db);
      db.exec('COMMIT;');
      return result;
    } catch (error) {
      try {
        db.exec('ROLLBACK;');
      } catch (rollbackErr) {
        console.error('Error during rollback:', rollbackErr);
      }
      throw error;
    }
  }
}

export const getDatabase = (): any => DatabaseClient.getDb();
export const withTransaction = DatabaseClient.withTransaction.bind(DatabaseClient);
