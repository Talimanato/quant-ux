import { AppDatabase } from '../src/db/Database';
import { SQLiteClient } from '../src/db/SQLiteClient';
import { JWTService } from '../src/services/JWTService';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';

process.env.QUX_SQLITE_PATH = ':memory:';
process.env.QUX_JWT_PASSWORD = 'test-secret';

export function createTestApp() {
  const config = loadConfig();
  const { app, db, jwt } = createApp(config);
  return { app, db, jwt };
}
