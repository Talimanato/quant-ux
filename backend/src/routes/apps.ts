import { Router, Request, Response } from 'express';
import { SQLiteClient } from '../db/SQLiteClient';
import { JWTService } from '../services/JWTService';
import { AppAcl } from '../acl/AppAcl';
import { QuxUser, ROLES, hasRole } from '../acl/ACL';
import * as Util from '../util/Util';
import { BlobService } from '../services/BlobService';

export function createAppRouter(db: SQLiteClient, jwt: JWTService, appAcl: AppAcl, blob?: BlobService): Router {
  const router = Router();

  const buildAppResponse = (app: any, summary = false): any => {
    const response: any = { ...app };
    delete response.users;
    delete response.invitations;

    if (summary) {
      // return only summary fields, exclude big data
      delete response.data;
    } else if (app.data) {
      // merge data fields into response for backward compatibility
      Object.assign(response, app.data);
      delete response.data;
    }

    response.id = app._id;
    return response;
  };

  const getUserAppIds = (userId: string): string[] => {
    const teams = db.find('team', { userID: userId });
    return teams.map((t) => t.appID).filter(Boolean);
  };

  router.get('/apps', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const summary = req.query.summary === 'true';
    const paging = req.query.paging === 'true';

    if (!hasRole(user, ROLES.USER)) {
      return res.json([]);
    }

    const appIds = getUserAppIds(user.id);
    if (appIds.length === 0) {
      return res.json(paging ? { rows: [], size: 0, offset: 0 } : []);
    }

    const fields = summary ? ['id', 'name', 'description', 'isPublic', 'clonable', 'isDirty', 'rating', 'test', 'comments', 'screenSize', 'type', 'parent', 'created', 'lastUpdate'] : undefined;
    const apps = db.find('app', { _id: { $in: appIds }, isDeleted: { $ne: true } }, { fields });

    const rows = apps.map((a) => buildAppResponse(a, summary));

    if (paging) {
      return res.json({ rows, size: rows.length, offset: 0 });
    }
    return res.json(rows);
  });

  router.get('/apps/public', (req: Request, res: Response) => {
    const summary = req.query.summary === 'true';
    const fields = summary ? ['id', 'name', 'description', 'isPublic', 'clonable', 'rating', 'test', 'comments', 'screenSize', 'type', 'created', 'lastUpdate'] : undefined;
    const apps = db.find('app', { isPublic: true, isDeleted: { $ne: true } }, { fields });
    return res.json(apps.map((a) => buildAppResponse(a, summary)));
  });

  router.post('/apps', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    if (!hasRole(user, ROLES.USER)) {
      return res.status(401).json({ error: 'app.create.denied' });
    }

    const now = Date.now();
    const app = {
      _id: Util.getRandomString(),
      name: req.body.name || 'New App',
      description: req.body.description || '',
      type: req.body.type || '',
      isPublic: false,
      clonable: false,
      isDirty: false,
      rating: 0,
      test: 0,
      comments: 0,
      screenSize: req.body.screenSize || { w: 0, h: 0 },
      parent: '',
      domain: '',
      created: now,
      lastUpdate: now,
      data: {
        widgets: {},
        screens: {},
        groups: {},
        templates: {},
        grid: {},
        lines: {}
      }
    };

    db.insert('app', app);

    // create owner team
    db.insert('team', {
      _id: Util.getRandomString(),
      userID: user.id,
      appID: app._id,
      permission: 3, // OWNER = 3 in Acl.java
      created: now
    });

    // create invitations: TEST=1, READ=2, WRITE=3
    const perms = [
      { perm: 1, hash: Util.getRandomString(), name: 'test' },
      { perm: 2, hash: Util.getRandomString(), name: 'read' },
      { perm: 3, hash: Util.getRandomString(), name: 'write' }
    ];

    for (const inv of perms) {
      db.insert('invitation', {
        _id: Util.getRandomString(),
        appID: app._id,
        hash: inv.hash,
        permission: inv.perm,
        created: now
      });
    }

    return res.json(buildAppResponse(app, false));
  });

  router.get('/apps/:appID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const id = req.params.appID;
    const app = db.findOne('app', { _id: id });
    if (!app) {
      return res.status(404).json({ error: 'app.not.found' });
    }

    const allowed = app.isPublic || (await appAcl.canRead(user, id));
    if (!allowed) {
      return res.status(401).json({ error: 'app.read.denied' });
    }

    return res.json(buildAppResponse(app, false));
  });

  router.get('/apps/embedded/:appID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const id = req.params.appID;
    const app = db.findOne('app', { _id: id });
    if (!app) {
      return res.status(404).json({ error: 'app.not.found' });
    }

    const allowed = app.isPublic || (await appAcl.canRead(user, id));
    if (!allowed) {
      return res.status(401).json({ error: 'app.read.denied' });
    }

    return res.json(buildAppResponse(app, true));
  });

  router.post('/apps/:appID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const id = req.params.appID;
    const app = db.findOne('app', { _id: id });
    if (!app) {
      return res.status(404).json({ error: 'app.not.found' });
    }

    const allowed = await appAcl.canWrite(user, id);
    if (!allowed) {
      return res.status(401).json({ error: 'app.write.denied' });
    }

    const updates: any = { ...req.body };
    delete updates._id;
    delete updates.id;
    delete updates.users;
    delete updates.invitations;
    updates.lastUpdate = Date.now();

    // if body contains big app data fields, put them into data column
    const dataFields = ['widgets', 'screens', 'groups', 'templates', 'grid', 'lines'];
    const hasDataField = dataFields.some((f) => updates[f] !== undefined);

    if (hasDataField) {
      const existingData = app.data || {};
      const newData: any = {};
      for (const field of dataFields) {
        if (updates[field] !== undefined) {
          newData[field] = updates[field];
          delete updates[field];
        } else {
          newData[field] = existingData[field];
        }
      }
      // keep any other data fields
      for (const [key, value] of Object.entries(existingData)) {
        if (newData[key] === undefined) {
          newData[key] = value;
        }
      }
      updates.data = newData;
    }

    db.updateCollection('app', { _id: id }, { $set: updates });
    return res.json({ message: 'app.update.success' });
  });

  router.post('/apps/props/:appID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const id = req.params.appID;
    const allowed = await appAcl.canWrite(user, id);
    if (!allowed) {
      return res.status(401).json({ error: 'app.write.denied' });
    }

    const updates: any = { ...req.body };
    delete updates._id;
    delete updates.id;
    delete updates.users;
    delete updates.invitations;
    delete updates.widgets;
    delete updates.screens;
    delete updates.groups;
    delete updates.templates;
    delete updates.grid;
    delete updates.lines;
    updates.lastUpdate = Date.now();

    db.updateCollection('app', { _id: id }, { $set: updates });
    return res.json({ message: 'app.update.success' });
  });

  router.delete('/apps/:appID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const id = req.params.appID;
    const allowed = await appAcl.canDelete(user, id);
    if (!allowed) {
      return res.status(401).json({ error: 'app.delete.denied' });
    }

    db.updateCollection('app', { _id: id }, { $set: { isDeleted: true } });

    // delete parts in background
    const partTables = ['commandstack', 'comment', 'event', 'mouse', 'image', 'annotation', 'invitation', 'testsetting'];
    for (const table of partTables) {
      db.removeDocuments(table, { appID: id });
    }
    db.removeDocuments('team', { appID: id });
    db.removeDocuments('app', { _id: id });

    return res.json({ message: 'app.delete.success' });
  });

  router.post('/apps/:appID/update', async (req: Request, res: Response) => {
    // applyChanges - apply delta array to the app model
    const user = req.user as QuxUser;
    const id = req.params.appID;
    const allowed = await appAcl.canWrite(user, id);
    if (!allowed) {
      return res.status(401).json({ error: 'app.write.denied' });
    }

    const app = db.findOne('app', { _id: id });
    if (!app) {
      return res.status(404).json({ error: 'app.not.found' });
    }

    const changes = Array.isArray(req.body) ? req.body : [];
    if (changes.length === 0) {
      return res.status(405).json({ error: 'app.update.error.no.data' });
    }

    const appColumns = new Set([
      'name', 'description', 'type', 'isPublic', 'clonable', 'isDirty', 'isDeleted',
      'rating', 'test', 'comments', 'screenSize', 'parent', 'domain', 'created', 'lastUpdate'
    ]);

    const data = { ...(app.data || {}) };
    const top: any = { lastUpdate: Date.now() };

    for (const change of changes) {
      const type = change.type;
      const name = change.name;
      const parent = change.parent;
      const value = change.object;

      if (!name) continue;

      if (parent) {
        if (!data[parent]) data[parent] = {};
        if (type === 'delete') {
          delete data[parent][name];
        } else {
          data[parent][name] = value;
        }
      } else if (appColumns.has(name)) {
        if (type === 'delete') {
          top[name] = undefined;
        } else {
          top[name] = value;
        }
      } else {
        if (type === 'delete') {
          delete data[name];
        } else {
          data[name] = value;
        }
      }
    }

    top.data = data;
    db.updateCollection('app', { _id: id }, { $set: top });
    return res.json({ message: 'app.changes.success' });
  });

  router.post('/apps/copy/:appID', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const id = req.params.appID;
    const app = db.findOne('app', { _id: id });
    if (!app) return res.status(404).json({ error: 'app.not.found' });

    const allowed = app.isPublic || (await appAcl.canWrite(user, id));
    if (!allowed) return res.status(405).json({ error: 'app.copy.denied' });

    const name = req.body?.name || `${app.name} Copy`;
    const newId = Util.getRandomString();

    const newApp: any = { ...app, _id: newId, id: newId, name, isPublic: false, parent: id, created: Date.now(), lastUpdate: Date.now() };
    delete newApp.isDirty;
    delete newApp.lastBackup;

    // Copy images and replace URLs
    const images = db.find('image', { appID: id });
    const replacements: Record<string, string> = {};
    if (blob) blob.createFolder(newId);

    for (const image of images) {
      const oldUrl = image.url;
      const fileName = oldUrl.split('/').pop() || oldUrl;
      const newUrl = `${newId}/${fileName}`;
      const newImage = { ...image, _id: Util.getRandomString(), id: Util.getRandomString(), appID: newId, url: newUrl };
      db.insert('image', newImage);
      if (blob) {
        blob.copyBlob(oldUrl, oldUrl, id, newId);
      }
      if (oldUrl) replacements[oldUrl] = newUrl;
    }

    // Update background image URLs inside app data
    const newData = { ...(app.data || {}) };
    for (const key of ['screens', 'widgets', 'templates']) {
      const group = newData[key] || {};
      for (const [gid, box] of Object.entries(group)) {
        const b: any = box;
        if (b?.style?.backgroundImage?.url && replacements[b.style.backgroundImage.url]) {
          b.style.backgroundImage.url = replacements[b.style.backgroundImage.url];
        }
      }
    }
    newApp.data = newData;

    db.insert('app', newApp);
    db.insert('team', { _id: Util.getRandomString(), userID: user.id, appID: newId, permission: 3, created: Date.now() });

    return res.json({ id: newId });
  });

  router.delete('/apps/invitation/:appID', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const id = req.params.appID;
    const allowed = await appAcl.canWrite(user, id);
    if (!allowed) return res.status(404).json({ error: 'app.invitation.reset.denied' });

    db.removeDocuments('invitation', { appID: id });
    [1, 2, 3].forEach((permission) => {
      db.insert('invitation', { _id: Util.getRandomString(), appID: id, permission, hash: Util.getRandomString(), created: Date.now() });
    });
    return res.json({ message: 'app.token.reset' });
  });

  return router;
}
