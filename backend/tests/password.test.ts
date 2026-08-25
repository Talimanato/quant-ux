import request from 'supertest';
import { createTestApp } from './setup';

describe('Password reset', () => {
  const register = async (app: any) => {
    const res = await request(app)
      .post('/rest/user')
      .send({ email: 'reset@example.com', password: 'oldpass1', name: 'Reset' });
    expect(res.status).toBe(200);
    return res.body;
  };

  it('should complete the request -> set -> login flow', async () => {
    const { app, db } = createTestApp();
    const user = await register(app);

    // 1. request: always ok, token stored with expiry
    const req1 = await request(app)
      .post('/rest/user/password/request')
      .send({ email: user.email });
    expect(req1.status).toBe(200);
    expect(req1.body.type).toBe('ok');

    const resets = db.find('password_reset', { userID: user.id });
    expect(resets.length).toBe(1);
    expect(resets[0].key.length).toBeGreaterThanOrEqual(6);
    expect(resets[0].expires).toBeGreaterThan(Date.now());

    // 2. set with the key from the db
    const req2 = await request(app)
      .post('/rest/user/password/set')
      .send({ email: user.email, password: 'newpass1', key: resets[0].key });
    expect(req2.status).toBe(200);
    expect(req2.body.type).toBe('ok');

    // token is consumed
    expect(db.find('password_reset', { userID: user.id }).length).toBe(0);

    // 3. login with the new password works, old one fails
    const loginNew = await request(app)
      .post('/rest/login/')
      .send({ email: user.email, password: 'newpass1' });
    expect(loginNew.status).toBe(200);

    const loginOld = await request(app)
      .post('/rest/login/')
      .send({ email: user.email, password: 'oldpass1' });
    expect(loginOld.status).toBe(405);
  });

  it('should not reveal unknown accounts on request', async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .post('/rest/user/password/request')
      .send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('ok');
  });

  it('should reject wrong keys, expired keys and short passwords', async () => {
    const { app, db } = createTestApp();
    const user = await register(app);

    await request(app)
      .post('/rest/user/password/request')
      .send({ email: user.email });

    // wrong key
    const wrong = await request(app)
      .post('/rest/user/password/set')
      .send({ email: user.email, password: 'newpass1', key: 'does-not-exist' });
    expect(wrong.body.type).toBe('error');

    // short password
    const resets = db.find('password_reset', { userID: user.id });
    const short = await request(app)
      .post('/rest/user/password/set')
      .send({ email: user.email, password: 'abc', key: resets[0].key });
    expect(short.body.type).toBe('error');

    // expired key
    db.updateCollection('password_reset', { userID: user.id }, {
      $set: { expires: Date.now() - 1000 }
    });
    const expired = await request(app)
      .post('/rest/user/password/set')
      .send({ email: user.email, password: 'newpass1', key: resets[0].key });
    expect(expired.body.type).toBe('error');

    // password unchanged
    const login = await request(app)
      .post('/rest/login/')
      .send({ email: user.email, password: 'oldpass1' });
    expect(login.status).toBe(200);
  });
});
