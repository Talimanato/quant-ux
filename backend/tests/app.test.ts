import request from 'supertest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { createTestApp } from './setup';

describe('App & Command API', () => {
  async function createUserAndApp(app: any) {
    const reg = await request(app)
      .post('/rest/user')
      .send({ email: 'test@example.com', password: 'test123', name: 'Test' });

    const token = reg.body.token;
    const create = await request(app)
      .post('/rest/apps')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My App' });

    return { token, appId: create.body.id };
  }

  it('should apply incremental changes to an app', async () => {
    const { app } = createTestApp();
    const { token, appId } = await createUserAndApp(app);

    const changes = [
      { type: 'update', parent: 'widgets', name: 'w1', object: { x: 10, y: 20 } },
      { type: 'update', parent: 'screens', name: 's1', object: { name: 'Home' } },
      { type: 'update', parent: null, name: 'name', object: 'Updated App' }
    ];

    const update = await request(app)
      .post(`/rest/apps/${appId}/update`)
      .set('Authorization', `Bearer ${token}`)
      .send(changes);

    expect(update.status).toBe(200);

    const detail = await request(app)
      .get(`/rest/apps/${appId}.json`)
      .set('Authorization', `Bearer ${token}`);

    expect(detail.status).toBe(200);
    expect(detail.body.name).toBe('Updated App');
    expect(detail.body.widgets.w1.x).toBe(10);
    expect(detail.body.screens.s1.name).toBe('Home');
  });

  it('should manage command stack add/undo/redo', async () => {
    const { app } = createTestApp();
    const { token, appId } = await createUserAndApp(app);

    const get = await request(app)
      .get(`/rest/commands/${appId}.json`)
      .set('Authorization', `Bearer ${token}`);

    expect(get.status).toBe(200);
    expect(get.body.stack).toEqual([]);
    expect(get.body.pos).toBe(0);

    const add = await request(app)
      .post(`/rest/commands/${appId}/add`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'AddWidget', id: 'w1' });

    expect(add.status).toBe(200);
    expect(add.body.pos).toBe(1);

    const undo = await request(app)
      .post(`/rest/commands/${appId}/undo`)
      .set('Authorization', `Bearer ${token}`);

    expect(undo.status).toBe(200);
    expect(undo.body.pos).toBe(0);

    const redo = await request(app)
      .post(`/rest/commands/${appId}/redo`)
      .set('Authorization', `Bearer ${token}`);

    expect(redo.status).toBe(200);
    expect(redo.body.pos).toBe(1);

    const final = await request(app)
      .get(`/rest/commands/${appId}.json`)
      .set('Authorization', `Bearer ${token}`);

    expect(final.body.pos).toBe(1);
    expect(final.body.stack.length).toBe(1);
  });

  it('should manage team members', async () => {
    const { app } = createTestApp();
    const owner = await request(app)
      .post('/rest/user')
      .send({ email: 'owner@example.com', password: 'test123', name: 'Owner' });

    const member = await request(app)
      .post('/rest/user')
      .send({ email: 'member@example.com', password: 'test123', name: 'Member' });

    const token = owner.body.token;
    const create = await request(app)
      .post('/rest/apps')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Team App' });

    const appId = create.body.id;

    const add = await request(app)
      .post(`/rest/apps/${appId}/team/`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'member@example.com', permission: 2 });

    expect(add.status).toBe(200);

    const team = await request(app)
      .get(`/rest/apps/${appId}/team.json`)
      .set('Authorization', `Bearer ${token}`);

    expect(team.status).toBe(200);
    expect(team.body.length).toBe(2);
    expect(team.body.find((u: any) => u.email === 'member@example.com')?.permission).toBe(2);
  });

  it('should manage invitations', async () => {
    const { app } = createTestApp();
    const owner = await request(app)
      .post('/rest/user')
      .send({ email: 'owner2@example.com', password: 'test123', name: 'Owner' });

    const token = owner.body.token;
    const create = await request(app)
      .post('/rest/apps')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Invite App' });

    const appId = create.body.id;

    const invs = await request(app)
      .get(`/rest/invitation/${appId}.json`)
      .set('Authorization', `Bearer ${token}`);

    expect(invs.status).toBe(200);
    const hashes = Object.keys(invs.body);
    expect(hashes.length).toBe(3);

    const hash = hashes[0];
    const publicApp = await request(app)
      .get(`/rest/invitation/${hash}/app.json`);

    expect(publicApp.status).toBe(200);
    expect(publicApp.body._id).toBe(appId);
  });

  it('should upload, list and delete images', async () => {
    const { app } = createTestApp();
    const owner = await request(app)
      .post('/rest/user')
      .send({ email: 'imageowner@example.com', password: 'test123', name: 'ImageOwner' });

    const token = owner.body.token;
    const create = await request(app)
      .post('/rest/apps')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Image App' });

    const appId = create.body.id;

    const tmpDir = path.join(process.cwd(), 'tmp', 'uploads');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const tmpFile = path.join(tmpDir, 'test.png');
    await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 }
      }
    }).png().toFile(tmpFile);

    const upload = await request(app)
      .post(`/rest/images/${appId}`)
      .set('Authorization', `Bearer ${token}`)
      .attach('files', tmpFile);

    expect(upload.status).toBe(200);
    expect(upload.body.uploads.length).toBe(1);
    expect(upload.body.uploads[0].width).toBe(10);

    const list = await request(app)
      .get(`/rest/images/${appId}.json`)
      .set('Authorization', `Bearer ${token}`);

    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);

    const image = list.body[0];
    const parts = image.url.split('/');
    const fileName = parts[parts.length - 1];
    const imageId = image.id || image._id;

    const del = await request(app)
      .delete(`/rest/images/${appId}/${imageId}/ass/${fileName}`)
      .set('Authorization', `Bearer ${token}`);

    expect(del.status).toBe(200);

    const listAfter = await request(app)
      .get(`/rest/images/${appId}.json`)
      .set('Authorization', `Bearer ${token}`);

    expect(listAfter.body.length).toBe(0);

    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  });
});
