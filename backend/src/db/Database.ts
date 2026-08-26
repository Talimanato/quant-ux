import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export class AppDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
    this.migrate();
  }

  get instance(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    const migrationDir = path.join(__dirname, 'migrations');
    const files = fs
      .readdirSync(migrationDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationDir, file), 'utf-8');
      try {
        this.db.exec(sql);
      } catch (err) {
        // tolerate idempotent migrations on existing databases, e.g.
        // ALTER TABLE ... ADD COLUMN when the column is already there
        const message = String(err);
        if (!/duplicate column name/i.test(message)) {
          throw err;
        }
      }
    }
  }

  static createInMemory(): AppDatabase {
    const db = new AppDatabase(':memory:');
    return db;
  }
}
