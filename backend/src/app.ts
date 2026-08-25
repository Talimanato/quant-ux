import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { AppDatabase } from './db/Database';
import { SQLiteClient } from './db/SQLiteClient';
import { JWTService } from './services/JWTService';
import { Config } from './config';
import { createAuthMiddleware } from './middleware/auth';
import { createUserRouter } from './routes/users';
import { createAppRouter } from './routes/apps';
import { createImageRouter } from './routes/images';
import { createStubRouter } from './routes/stubs';
import { createNotificationRouter } from './routes/notifications';
import { createLibraryRouter } from './routes/libs';
import { createAiRouter } from './routes/ai';
import { BlobService } from './services/BlobService';
import { AppAcl } from './acl/AppAcl';

export function createApp(config: Config) {
  const dbInstance = new AppDatabase(config.sqlitePath);
  const db = new SQLiteClient(dbInstance.instance);
  const jwt = new JWTService(config.jwtPassword);
  const appAcl = new AppAcl(db);
  const blob = new BlobService(config.imageFolderApps);

  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: true,
    credentials: true
  }));
  app.use(compression());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(createAuthMiddleware(jwt));

  // status
  app.get('/rest/status.json', (req: Request, res: Response) => {
    res.json({
      started: new Date().toISOString(),
      version: '0.1.0'
    });
  });

  // routers
  app.use('/rest', createUserRouter(db, jwt, config));
  app.use('/rest', createAppRouter(db, jwt, appAcl, blob));
  app.use('/rest', createImageRouter(db, blob, appAcl, config.imageSize));
  app.use('/rest', createStubRouter(db, appAcl));
  app.use('/rest', createNotificationRouter(db));
  app.use('/rest', createLibraryRouter(db, appAcl));
  app.use('/ai', createAiRouter(config));

  // fallback
  app.use((err: any, req: Request, res: Response, next: any) => {
    console.error('Express error:', err);
    res.status(500).json({ error: 'server.error', message: err.message });
  });

  return { app, db, jwt, dbInstance };
}
