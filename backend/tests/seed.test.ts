import request from 'supertest';
import { createTestApp } from './setup';
import { ensureDefaultAdmin } from '../src/seed';

describe('Default admin seed', () => {
  it('should create admin/admin and allow login', async () => {
    const { app, db } = createTestApp();
    expect(db.count('user', { email: 'admin' })).toBe(0);

    ensureDefaultAdmin(db);

    expect(db.count('user', { email: 'admin' })).toBe(1);
    const login = await request(app)
      .post('/rest/login/')
      .send({ email: 'admin', password: 'admin' });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeDefined();
  });

  it('should not duplicate or reset an existing admin', async () => {
    const { db } = createTestApp();
    ensureDefaultAdmin(db);
    // simulate a password change
    db.updateCollection('user', { email: 'admin' }, {
      $set: { password: require('../src/util/Util').hashPassword('changed') }
    });

    ensureDefaultAdmin(db);

    expect(db.count('user', { email: 'admin' })).toBe(1);
  });

  it('should respect QUX_SEED_ADMIN=false and custom credentials', async () => {
    const { app, db } = createTestApp();
    process.env.QUX_SEED_ADMIN = 'false';
    try {
      ensureDefaultAdmin(db);
      expect(db.count('user', { email: 'admin' })).toBe(0);
    } finally {
      delete process.env.QUX_SEED_ADMIN;
    }

    process.env.QUX_ADMIN_EMAIL = 'root@local';
    process.env.QUX_ADMIN_PASSWORD = 'secret1';
    try {
      ensureDefaultAdmin(db);
      const login = await request(app)
        .post('/rest/login/')
        .send({ email: 'root@local', password: 'secret1' });
      expect(login.status).toBe(200);
    } finally {
      delete process.env.QUX_ADMIN_EMAIL;
      delete process.env.QUX_ADMIN_PASSWORD;
    }
  });
});
