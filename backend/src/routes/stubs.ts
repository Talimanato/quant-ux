import { Router, Request, Response } from 'express';
import { SQLiteClient } from '../db/SQLiteClient';
import { AppAcl } from '../acl/AppAcl';
import { QuxUser } from '../acl/ACL';
import * as Util from '../util/Util';

export function createStubRouter(db: SQLiteClient, appAcl: AppAcl): Router {
  const router = Router();

  // Client side logger (src/common/Logger.js) reports errors here. Just
  // acknowledge them; wire QUX_DEBUG logging here if needed.
  router.post('/log/error', (req: Request, res: Response) => {
    return res.json({ type: 'ok' });
  });

  /**
   * The comment table only has fixed columns (id, appID, type, reference,
   * userID, message, created, data). Everything else (text, session, user,
   * screen, ...) is persisted as JSON in the data column and merged back
   * on read, so the frontend receives the comment it posted.
   */
  const insertComment = (appId: string, body: any, userID?: string | null): any => {
    const comment: any = {
      appID: appId,
      userID: userID ?? null,
      created: Date.now(),
      ...body,
      data: { ...body }
    };
    comment._id = Util.getRandomString();
    db.insert('comment', comment);
    return buildComment(db.findOne('comment', { _id: comment._id }));
  };

  const buildComment = (row: any): any => {
    if (!row) return row;
    const { data, ...rest } = row;
    return { ...(data || {}), ...rest };
  };

  // Notifications
  router.get('/notifications.json', (req: Request, res: Response) => {
    res.json([]);
  });

  // Team
  router.get('/apps/:appID/team.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canRead(user, appId);
    if (!allowed) return res.status(404).json({ error: 'team.read.denied' });

    const teams = db.find('team', { appID: appId });
    const result = teams.map((t: any) => {
      const u = db.findOne('user', { _id: t.userID });
      if (!u) return null;
      return {
        _id: u._id,
        id: u.id,
        name: u.name,
        lastname: u.lastname,
        email: u.email,
        image: u.image,
        permission: t.permission
      };
    }).filter(Boolean);
    return res.json(result);
  });

  router.get('/apps/:appID/suggestions/team.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canWrite(user, appId);
    if (!allowed) return res.status(404).json({ error: 'team.suggestions.denied' });

    // Find users that share apps with the current user
    const myTeams = db.find('team', { userID: user?.id });
    const appIds = myTeams.map((t: any) => t.appID);
    const relatedTeams = db.find('team', { appID: { $in: appIds } });
    const userIds = [...new Set(relatedTeams.map((t: any) => t.userID))];
    const result = userIds.map((uid) => {
      const u = db.findOne('user', { _id: uid });
      if (!u) return null;
      return { _id: u._id, id: u.id, name: u.name, lastname: u.lastname, email: u.email, image: u.image };
    }).filter(Boolean);
    return res.json(result);
  });

  router.post('/apps/:appID/team/', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canWrite(user, appId);
    if (!allowed) return res.status(404).json({ error: 'team.create.denied' });

    const { email, permission } = req.body;
    if (!email || permission === undefined) {
      return res.status(405).json({ error: 'team.create.invalid' });
    }
    if (permission >= 3) {
      return res.status(405).json({ error: 'apps.team.member.add.error.owner' });
    }
    const target = db.findOne('user', { email });
    if (!target) {
      return res.status(404).json({ error: 'apps.team.member.add.error.email' });
    }

    const existing = db.findOne('team', { userID: target._id, appID: appId });
    if (existing) {
      db.updateCollection('team', { _id: existing._id }, { $set: { permission, lastUpdate: Date.now() } });
    } else {
      db.insert('team', {
        _id: Util.getRandomString(),
        userID: target._id,
        appID: appId,
        permission,
        created: Date.now()
      });
    }
    return res.json({ message: 'apps.team.member.add.success' });
  });

  router.post('/apps/:appID/team/:userID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const userId = req.params.userID;
    const allowed = await appAcl.canWrite(user, appId);
    if (!allowed) return res.status(404).json({ error: 'team.update.denied' });

    const { permission } = req.body;
    if (permission === undefined) return res.status(405).json({ error: 'team.update.invalid' });
    if (permission >= 3) return res.status(405).json({ error: 'apps.team.member.add.error.owner' });

    db.updateCollection('team', { userID: userId, appID: appId }, { $set: { permission, lastUpdate: Date.now() } });
    return res.json({ message: 'apps.team.member.add.success' });
  });

  router.delete('/apps/:appID/team/:userID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const userId = req.params.userID;
    if (user?.id === userId) {
      return res.status(405).json({ error: 'apps.team.member.remove.error' });
    }
    const allowed = await appAcl.canWrite(user, appId);
    if (!allowed) return res.status(404).json({ error: 'team.remove.denied' });

    db.removeDocuments('team', { userID: userId, appID: appId });
    return res.json({ message: 'apps.team.member.remove.success' });
  });

  function buildStackResponse(stack: any) {
    if (!stack) return null;
    const data = stack.data || {};
    return {
      ...data,
      _id: stack._id,
      id: stack._id,
      appID: stack.appID
    };
  }

  function getOrCreateStack(user: QuxUser | null, appId: string, create = true) {
    let stack = db.findOne('commandstack', { appID: appId });
    if (!stack && create) {
      stack = {
        _id: Util.getRandomString(),
        appID: appId,
        data: {
          stack: [],
          pos: 0,
          lastUUID: 0,
          appID: appId,
          userID: user?.id,
          created: Date.now()
        }
      };
      db.insert('commandstack', stack);
    }
    if (stack && !stack.data) {
      stack.data = { stack: [], pos: 0, lastUUID: 0 };
    }
    return stack;
  }

  function saveStack(stack: any, data: any) {
    data.lastUpdate = Date.now();
    db.updateCollection('commandstack', { _id: stack._id }, { $set: { data } });
  }

  // Command Stack
  router.get('/commands/:appID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canRead(user, appId);
    if (!allowed) return res.status(404).json({ error: 'command.read.denied' });

    const stack = getOrCreateStack(user, appId);
    return res.json(buildStackResponse(stack));
  });

  router.post('/commands/:appID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canWrite(user, appId);
    if (!allowed) return res.status(404).json({ error: 'command.write.denied' });

    const data = { ...req.body, appID: appId, userID: user?.id, lastUpdate: Date.now() };
    let stack = db.findOne('commandstack', { appID: appId });
    if (stack) {
      db.updateCollection('commandstack', { _id: stack._id }, { $set: { data } });
    } else {
      db.insert('commandstack', { _id: Util.getRandomString(), appID: appId, data });
    }
    return res.json({ message: 'commandstack.update.success' });
  });

  router.post('/commands/:appID/add', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canWrite(user, appId);
    if (!allowed) return res.status(404).json({ error: 'command.add.denied' });

    const command = { ...req.body };
    command.userID = user?.id;

    const stack = getOrCreateStack(user, appId);
    const data = stack.data;
    const newPos = (data.pos || 0) + 1;
    const newLastUUID = (data.lastUUID || 0) + 1;
    data.stack = data.stack || [];
    data.stack.push(command);
    data.pos = newPos;
    data.lastUUID = newLastUUID;
    saveStack(stack, data);

    return res.json({ command, pos: newPos, lastUUID: newLastUUID });
  });

  router.post('/commands/:appID/undo', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canWrite(user, appId);
    if (!allowed) return res.status(404).json({ error: 'command.undo.denied' });

    const stack = getOrCreateStack(user, appId, false);
    if (!stack) return res.json({ pos: 0 });
    const data = stack.data;
    const newPos = Math.max(0, (data.pos || 0) - 1);
    data.pos = newPos;
    saveStack(stack, data);
    return res.json({ pos: newPos });
  });

  router.post('/commands/:appID/redo', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canWrite(user, appId);
    if (!allowed) return res.status(404).json({ error: 'command.redo.denied' });

    const stack = getOrCreateStack(user, appId, false);
    if (!stack) return res.json({ pos: 0 });
    const data = stack.data;
    const newPos = Math.min(data.stack.length, (data.pos || 0) + 1);
    data.pos = newPos;
    saveStack(stack, data);
    return res.json({ pos: newPos });
  });

  router.delete('/commands/:appID/pop/:count', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canWrite(user, appId);
    if (!allowed) return res.status(404).json({ error: 'command.pop.denied' });

    let count: number;
    try {
      count = parseInt(req.params.count, 10);
    } catch (e) {
      return res.status(400).json({ error: 'command.pop.count' });
    }

    const stack = getOrCreateStack(user, appId, false);
    if (!stack) return res.json({ pos: 0 });
    const data = stack.data;
    const stackLength = data.stack.length;
    const pos = data.pos || 0;
    const newPos = Math.min(pos, stackLength - count);
    for (let i = 0; i < count; i++) {
      if (stackLength - (1 + i) >= 0) {
        data.stack.splice(stackLength - (1 + i), 1);
      }
    }
    data.pos = newPos;
    saveStack(stack, data);
    return res.json({ pos: newPos });
  });

  router.delete('/commands/:appID/shift/:count', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canWrite(user, appId);
    if (!allowed) return res.status(404).json({ error: 'command.shift.denied' });

    let count: number;
    try {
      count = parseInt(req.params.count, 10);
    } catch (e) {
      return res.status(400).json({ error: 'command.shift.count' });
    }

    const stack = getOrCreateStack(user, appId, false);
    if (!stack) return res.json(buildStackResponse(stack));
    const data = stack.data;
    const pos = data.pos || 0;
    const newPos = Math.max(0, pos - count);
    const max = Math.min(count, data.stack.length);
    for (let i = 0; i < max; i++) {
      data.stack.shift();
    }
    data.pos = newPos;
    saveStack(stack, data);
    return res.json(buildStackResponse(stack));
  });

  // Invitations for app
  router.get('/invitation/:appID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;

    const app = db.findOne('app', { _id: appId });
    if (!app) return res.status(404).json({ error: 'app.not.found' });

    const allowed = app.isPublic || (await appAcl.canWrite(user, appId));
    if (!allowed) return res.status(404).json({ error: 'invitation.read.denied' });

    const invs = db.find('invitation', { appID: appId });
    const result: any = {};
    for (const inv of invs) {
      result[inv.hash] = inv.permission;
    }
    return res.json(result);
  });

  router.get('/invitation/:hash/app.json', async (req: Request, res: Response) => {
    const hash = req.params.hash;
    const inv = db.findOne('invitation', { hash });
    if (!inv) return res.status(404).json({ error: 'invitation.not.found' });

    const app = db.findOne('app', { _id: inv.appID });
    if (!app) return res.status(404).json({ error: 'app.not.found' });
    const response: any = { ...app };
    delete response.users;
    delete response.invitations;
    delete response.password;
    // flatten app.data (screens, widgets, ...) like the other app endpoints,
    // the frontend expects these on the top level
    if (app.data) {
      Object.assign(response, app.data);
      delete response.data;
    }
    response.id = app._id;
    return res.json(response);
  });

  router.get('/invitation/:hash/update.json', async (req: Request, res: Response) => {
    const hash = req.params.hash;
    const inv = db.findOne('invitation', { hash });
    if (!inv) return res.status(404).json({ error: 'invitation.not.found' });

    const app = db.findOne('app', { _id: inv.appID });
    if (!app) return res.status(404).json({ error: 'app.not.found' });

    // Return a summary of the app without heavy fields (similar to Java's projection)
    const { screens, groups, widgets, templates, grid, lines, ...summary } = app;
    return res.json(summary);
  });

  router.get('/invitation/:appID/:hash/test.json', async (req: Request, res: Response) => {
    const appId = req.params.appID;
    const hash = req.params.hash;
    const inv = db.findOne('invitation', { hash, appID: appId });
    if (!inv) return res.status(404).json({ error: 'invitation.not.found' });

    const app = db.findOne('app', { _id: appId });
    if (!app) return res.status(404).json({ error: 'app.not.found' });

    // TEST permission is 1
    if (inv.permission < 1 && !app.isPublic) {
      return res.status(404).json({ error: 'invitation.test.denied' });
    }

    let test = db.findOne('testsetting', { appID: appId });
    if (!test) {
      test = { _id: Util.getRandomString(), appID: appId, data: { tasks: [] } };
      db.insert('testsetting', test);
    }
    return res.json(buildTestResponse(test));
  });

  router.post('/invitation/:appID/:hash/events.json', async (req: Request, res: Response) => {
    const appId = req.params.appID;
    const hash = req.params.hash;
    const inv = db.findOne('invitation', { hash, appID: appId });
    if (!inv) return res.status(404).json({ error: 'invitation.not.found' });

    const app = db.findOne('app', { _id: appId });
    if (!app) return res.status(404).json({ error: 'app.not.found' });
    if (inv.permission < 1 && !app.isPublic) {
      return res.status(404).json({ error: 'invitation.events.denied' });
    }

    const body = req.body;
    const events = Array.isArray(body) ? body : [body];
    for (const evt of events) {
      db.insert('event', { _id: Util.getRandomString(), appID: appId, ...evt, created: Date.now() });
    }
    return res.json({ message: 'events.added' });
  });

  router.post('/invitation/:appID/:hash/mouse.json', async (req: Request, res: Response) => {
    const appId = req.params.appID;
    const hash = req.params.hash;
    const inv = db.findOne('invitation', { hash, appID: appId });
    if (!inv) return res.status(404).json({ error: 'invitation.not.found' });

    const app = db.findOne('app', { _id: appId });
    if (!app) return res.status(404).json({ error: 'app.not.found' });
    if (inv.permission < 1 && !app.isPublic) {
      return res.status(404).json({ error: 'invitation.mouse.denied' });
    }

    const body = req.body;
    const records = Array.isArray(body) ? body : [body];
    for (const rec of records) {
      db.insert('mouse', { _id: Util.getRandomString(), appID: appId, ...rec, created: Date.now() });
    }
    return res.json({ message: 'mouse.added' });
  });

  function buildTestResponse(test: any) {
    if (!test) return null;
    const data = test.data || {};
    return {
      ...data,
      _id: test._id,
      id: test._id,
      appID: test.appID
    };
  }

  // Test settings
  router.get('/test/:appID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canRead(user, appId);
    if (!allowed) return res.status(404).json({ error: 'test.read.denied' });

    let test = db.findOne('testsetting', { appID: appId });
    if (!test) {
      test = {
        _id: Util.getRandomString(),
        appID: appId,
        data: { tasks: [] }
      };
      db.insert('testsetting', test);
    }
    return res.json(buildTestResponse(test));
  });

  router.post('/test/:appID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canWrite(user, appId);
    if (!allowed) return res.status(404).json({ error: 'test.write.denied' });

    const data = { ...req.body, appID: appId, userID: user?.id, lastUpdate: Date.now() };
    let test = db.findOne('testsetting', { appID: appId });
    if (test) {
      db.updateCollection('testsetting', { _id: test._id }, { $set: { data } });
    } else {
      db.insert('testsetting', { _id: Util.getRandomString(), appID: appId, data });
    }
    return res.json({ message: 'testsetting.update.success' });
  });

  // Events
  router.get('/events/:appID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canRead(user, appId);
    if (!allowed) return res.status(404).json({ error: 'events.read.denied' });

    const query: any = { appID: appId };
    if (req.query.exclude) {
      query.type = { $ne: req.query.exclude };
    }
    // batch=true is accepted for compatibility: the full list is small
    // enough in SQLite that no batching is required.
    const events = db.find('event', query);
    return res.json(events);
  });

  router.get('/events/:appID/:session.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const session = req.params.session;
    const allowed = await appAcl.canRead(user, appId);
    if (!allowed) return res.status(404).json({ error: 'events.read.denied' });

    const events = db.find('event', { appID: appId, session });
    return res.json(events);
  });

  router.get('/events/:appID/all/count.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canRead(user, appId);
    if (!allowed) return res.status(404).json({ error: 'events.read.denied' });

    const count = db.count('event', { appID: appId });
    return res.json({ count });
  });

  router.post('/events/:appID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canRead(user, appId);
    if (!allowed) return res.status(404).json({ error: 'events.write.denied' });

    const body = req.body;
    const events = Array.isArray(body) ? body : [body];
    for (const evt of events) {
      db.insert('event', {
        _id: Util.getRandomString(),
        appID: appId,
        userID: user?.id,
        ...evt,
        created: Date.now()
      });
    }
    return res.json({ message: 'events.create.success' });
  });

  router.post('/events/:appID/:id.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const id = req.params.id;
    const allowed = await appAcl.canWrite(user, appId);
    if (!allowed) return res.status(404).json({ error: 'events.update.denied' });

    const existing = db.findOne('event', { _id: id, appID: appId });
    if (!existing) return res.status(404).json({ error: 'events.not.found' });

    db.updateCollection('event', { _id: id }, { $set: { ...req.body, appID: appId, lastUpdate: Date.now() } });
    return res.json({ message: 'events.update.success' });
  });

  router.delete('/events/:appID/:session.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const session = req.params.session;
    const allowed = await appAcl.canWrite(user, appId);
    if (!allowed) return res.status(404).json({ error: 'events.delete.denied' });

    db.removeDocuments('event', { appID: appId, session });
    return res.json({ message: 'events.delete.success' });
  });

  // Mouse
  router.get('/mouse/:appID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canRead(user, appId);
    if (!allowed) return res.status(404).json({ error: 'mouse.read.denied' });

    const mouse = db.find('mouse', { appID: appId });
    return res.json(mouse);
  });

  router.get('/mouse/:appID/:session.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const session = req.params.session;
    const allowed = await appAcl.canRead(user, appId);
    if (!allowed) return res.status(404).json({ error: 'mouse.read.denied' });

    const mouse = db.find('mouse', { appID: appId, session });
    return res.json(mouse);
  });

  router.post('/mouse/:appID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canRead(user, appId);
    if (!allowed) return res.status(404).json({ error: 'mouse.write.denied' });

    const body = req.body;
    const records = Array.isArray(body) ? body : [body];
    for (const rec of records) {
      db.insert('mouse', {
        _id: Util.getRandomString(),
        appID: appId,
        userID: user?.id,
        ...rec,
        created: Date.now()
      });
    }
    return res.json({ message: 'mouse.create.success' });
  });

  router.delete('/mouse/:appID/:session.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const session = req.params.session;
    const allowed = await appAcl.canWrite(user, appId);
    if (!allowed) return res.status(404).json({ error: 'mouse.delete.denied' });

    db.removeDocuments('mouse', { appID: appId, session });
    return res.json({ message: 'mouse.delete.success' });
  });

  // Annotations
  router.get('/annotations/apps/:appID/all.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canRead(user, appId);
    if (!allowed) return res.status(404).json({ error: 'annotation.read.denied' });

    const annotations = db.find('annotation', { appID: appId });
    return res.json(annotations);
  });

  router.get('/annotations/apps/:appID/:type.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canRead(user, appId);
    if (!allowed) return res.status(404).json({ error: 'annotation.read.denied' });

    const type = req.params.type;
    const annotations = db.find('annotation', { appID: appId, type });
    return res.json(annotations);
  });

  router.get('/annotations/apps/:appID/:reference/:type.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canRead(user, appId);
    if (!allowed) return res.status(404).json({ error: 'annotation.read.denied' });

    const type = req.params.type;
    const reference = req.params.reference;
    const annotations = db.find('annotation', { appID: appId, type, reference });
    return res.json(annotations);
  });

  router.post('/annotations/apps/:appID', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canWrite(user, appId);
    if (!allowed) return res.status(404).json({ error: 'annotation.write.denied' });

    const body = { ...req.body, appID: appId, userID: user?.id, created: Date.now() };
    body._id = Util.getRandomString();
    db.insert('annotation', body);
    return res.json({ ...body, id: body._id });
  });

  router.post('/annotations/apps/:appID/:annotationID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const id = req.params.annotationID;
    const allowed = await appAcl.canWrite(user, appId);
    if (!allowed) return res.status(404).json({ error: 'annotation.update.denied' });

    const existing = db.findOne('annotation', { _id: id, appID: appId });
    if (!existing) return res.status(404).json({ error: 'annotation.not.found' });

    db.updateCollection('annotation', { _id: id }, { $set: { ...req.body, appID: appId, userID: user?.id, lastUpdate: Date.now() } });
    return res.json({ message: 'annotation.update.success' });
  });

  router.delete('/annotations/apps/:appID/:annotationID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const id = req.params.annotationID;
    const allowed = await appAcl.canWrite(user, appId);
    if (!allowed) return res.status(404).json({ error: 'annotation.delete.denied' });

    db.removeDocuments('annotation', { _id: id, appID: appId });
    return res.json({ message: 'annotation.delete.success' });
  });

  // Comments
  router.get('/comments/apps/:appID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canRead(user, appId);
    if (!allowed) return res.status(404).json({ error: 'comment.read.denied' });

    const comments = db.find('comment', { appID: appId }).map(buildComment);
    return res.json(comments);
  });

  router.get('/comments/apps/:appID/:type.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canRead(user, appId);
    if (!allowed) return res.status(404).json({ error: 'comment.read.denied' });

    const type = req.params.type;
    const comments = db.find('comment', { appID: appId, type }).map(buildComment);
    return res.json(comments);
  });

  router.get('/comments/apps/:appID/:reference/:type.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canRead(user, appId);
    if (!allowed) return res.status(404).json({ error: 'comment.read.denied' });

    const type = req.params.type;
    const reference = req.params.reference;
    const comments = db.find('comment', { appID: appId, type, reference }).map(buildComment);
    return res.json(comments);
  });

  router.get('/comments/count/apps/:appID/:type.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canRead(user, appId);
    if (!allowed) return res.status(404).json({ error: 'comment.read.denied' });

    const count = db.count('comment', { appID: appId, type: req.params.type });
    return res.json({ count });
  });

  router.get('/comments/count/apps/:appID/:reference/:type.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canRead(user, appId);
    if (!allowed) return res.status(404).json({ error: 'comment.read.denied' });

    const count = db.count('comment', { appID: appId, type: req.params.type, reference: req.params.reference });
    return res.json({ count });
  });

  router.post('/comments/apps/:appID', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canRead(user, appId);
    if (!allowed) return res.status(404).json({ error: 'comment.create.denied' });

    const comment = insertComment(appId, req.body, user?.id);
    return res.json(comment);
  });

  router.post('/comments/apps/:appID/:commentID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const id = req.params.commentID;
    const allowed = await appAcl.canRead(user, appId);
    if (!allowed) return res.status(404).json({ error: 'comment.update.denied' });

    const existing = db.findOne('comment', { _id: id, appID: appId });
    if (!existing) return res.status(404).json({ error: 'comment.not.found' });

    db.updateCollection('comment', { _id: id }, { $set: { ...req.body, data: { ...req.body }, appID: appId, userID: user?.id, lastUpdate: Date.now() } });
    return res.json({ message: 'comment.update.success' });
  });

  router.delete('/comments/apps/:appID/:commentID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const id = req.params.commentID;
    const allowed = await appAcl.canWrite(user, appId);
    if (!allowed) return res.status(404).json({ error: 'comment.delete.denied' });

    db.removeDocuments('comment', { _id: id, appID: appId });
    return res.json({ message: 'comment.delete.success' });
  });

  // Comments by invitation hash (used by the public share page)
  router.get('/comments/hash/:hash/:appID/:type.json', async (req: Request, res: Response) => {
    const appId = req.params.appID;
    const hash = req.params.hash;
    const inv = db.findOne('invitation', { hash, appID: appId });
    if (!inv) return res.status(404).json({ error: 'invitation.not.found' });

    const comments = db.find('comment', { appID: appId, type: req.params.type }).map(buildComment);
    return res.json(comments);
  });

  router.post('/comments/hash/:hash/:appID', async (req: Request, res: Response) => {
    const appId = req.params.appID;
    const hash = req.params.hash;
    const inv = db.findOne('invitation', { hash, appID: appId });
    if (!inv) return res.status(404).json({ error: 'invitation.not.found' });

    const app = db.findOne('app', { _id: appId });
    if (!app) return res.status(404).json({ error: 'app.not.found' });
    if (inv.permission < 1 && !app.isPublic) {
      return res.status(404).json({ error: 'comment.create.denied' });
    }

    const comment = insertComment(appId, req.body);
    return res.json(comment);
  });

  router.post('/comments/hash/:hash/:appID/:commentID.json', async (req: Request, res: Response) => {
    const appId = req.params.appID;
    const hash = req.params.hash;
    const inv = db.findOne('invitation', { hash, appID: appId });
    if (!inv) return res.status(404).json({ error: 'invitation.not.found' });

    const id = req.params.commentID;
    const existing = db.findOne('comment', { _id: id, appID: appId });
    if (!existing) return res.status(404).json({ error: 'comment.not.found' });

    db.updateCollection('comment', { _id: id }, { $set: { ...req.body, data: { ...req.body }, appID: appId, lastUpdate: Date.now() } });
    return res.json({ message: 'comment.update.success' });
  });

  return router;
}
