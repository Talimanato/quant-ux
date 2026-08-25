import request from 'supertest';
import { createTestApp } from './setup';

describe('User API', () => {
  it('should register a new user', async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .post('/rest/user')
      .send({ email: 'test@example.com', password: 'test123', name: 'Test' });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('test@example.com');
    expect(res.body.token).toBeDefined();
    expect(res.body.password).toBeUndefined();
  });

  it('should login and get current user', async () => {
    const { app } = createTestApp();
    const reg = await request(app)
      .post('/rest/user')
      .send({ email: 'test@example.com', password: 'test123', name: 'Test' });

    const token = reg.body.token;
    const me = await request(app)
      .get('/rest/user')
      .set('Authorization', `Bearer ${token}`);

    expect(me.status).toBe(200);
    expect(me.body.email).toBe('test@example.com');
    expect(me.body.role).toBe('user');
  });

  it('should create and retrieve an app', async () => {
    const { app } = createTestApp();
    const reg = await request(app)
      .post('/rest/user')
      .send({ email: 'test@example.com', password: 'test123', name: 'Test' });

    const token = reg.body.token;
    const create = await request(app)
      .post('/rest/apps')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My App' });

    expect(create.status).toBe(200);
    const appId = create.body.id;

    const list = await request(app)
      .get('/rest/apps?summary=true')
      .set('Authorization', `Bearer ${token}`);

    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);
    expect(list.body[0].id).toBe(appId);

    const detail = await request(app)
      .get(`/rest/apps/${appId}.json`)
      .set('Authorization', `Bearer ${token}`);

    expect(detail.status).toBe(200);
    expect(detail.body.name).toBe('My App');
    expect(detail.body.widgets).toEqual({});
  });

  it('should update an app', async () => {
    const { app } = createTestApp();
    const reg = await request(app)
      .post('/rest/user')
      .send({ email: 'test@example.com', password: 'test123', name: 'Test' });

    const token = reg.body.token;
    const create = await request(app)
      .post('/rest/apps')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My App' });

    const appId = create.body.id;
    const update = await request(app)
      .post(`/rest/apps/${appId}.json`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated App', widgets: { w1: { x: 100 } } });

    expect(update.status).toBe(200);

    const detail = await request(app)
      .get(`/rest/apps/${appId}.json`)
      .set('Authorization', `Bearer ${token}`);

    expect(detail.body.name).toBe('Updated App');
    expect(detail.body.widgets.w1.x).toBe(100);
  });
});
