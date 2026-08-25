import { Router, Request, Response } from 'express';
import { SQLiteClient } from '../db/SQLiteClient';
import { AppAcl } from '../acl/AppAcl';
import { QuxUser, ROLES, hasRole } from '../acl/ACL';
import * as Util from '../util/Util';

export function createLibraryRouter(db: SQLiteClient, appAcl: AppAcl): Router {
  const router = Router();

  const buildLibResponse = (lib: any, summary = false): any => {
    const response: any = { ...lib };
    if (summary) {
      delete response.data;
    } else if (lib.data) {
      Object.assign(response, lib.data);
      delete response.data;
    }
    response.id = lib._id;
    return response;
  };

  const canReadLib = async (user: QuxUser, libId: string): Promise<boolean> => {
    if (!hasRole(user, ROLES.USER)) return false;
    const membership = db.findOne('library_team', { libID: libId, userID: user.id });
    if (membership) return true;
    const lib = db.findOne('library', { _id: libId });
    return lib?.isPublic === true;
  };

  const canWriteLib = async (user: QuxUser, libId: string): Promise<boolean> => {
    if (!hasRole(user, ROLES.USER)) return false;
    const membership = db.findOne('library_team', { libID: libId, userID: user.id });
    return membership && membership.permission >= 2;
  };

  router.get('/libs', (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    if (!hasRole(user, ROLES.USER)) return res.json([]);

    const teams = db.find('library_team', { userID: user.id });
    const libIds = teams.map((t: any) => t.libID);
    const libs = db.find('library', { _id: { $in: libIds }, isDeleted: { $ne: true } });
    return res.json(libs.map((l: any) => buildLibResponse(l, false)));
  });

  router.post('/libs', (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    if (!hasRole(user, ROLES.USER)) {
      return res.status(401).json({ error: 'lib.create.denied' });
    }

    const lib: any = {
      _id: Util.getRandomString(),
      name: req.body.name,
      description: req.body.description,
      isPublic: req.body.isPublic || false,
      data: req.body.data || {},
      created: Date.now(),
      lastUpdate: Date.now()
    };
    db.insert('library', lib);
    db.insert('library_team', {
      _id: Util.getRandomString(),
      userID: user.id,
      libID: lib._id,
      permission: 3,
      created: Date.now()
    });
    return res.json(buildLibResponse(lib));
  });

  router.get('/libs/:libID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const libId = req.params.libID;
    const lib = db.findOne('library', { _id: libId });
    if (!lib) return res.status(404).json({ error: 'lib.not.found' });
    if (!(await canReadLib(user, libId))) return res.status(401).json({ error: 'lib.read.denied' });
    return res.json(buildLibResponse(lib));
  });

  router.post('/libs/:libID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const libId = req.params.libID;
    if (!(await canWriteLib(user, libId))) return res.status(401).json({ error: 'lib.write.denied' });

    const lib = db.findOne('library', { _id: libId });
    if (!lib) return res.status(404).json({ error: 'lib.not.found' });

    const updates: any = { ...req.body, lastUpdate: Date.now() };
    delete updates._id;
    delete updates.id;
    const dataFields = ['widgets', 'screens', 'groups', 'templates', 'grid', 'lines'];
    const hasDataField = dataFields.some((f) => updates[f] !== undefined);
    if (hasDataField) {
      const existingData = lib.data || {};
      const newData: any = {};
      for (const field of dataFields) {
        if (updates[field] !== undefined) {
          newData[field] = updates[field];
          delete updates[field];
        } else {
          newData[field] = existingData[field];
        }
      }
      for (const [key, value] of Object.entries(existingData)) {
        if (newData[key] === undefined) newData[key] = value;
      }
      updates.data = newData;
    }

    db.updateCollection('library', { _id: libId }, { $set: updates });
    return res.json({ message: 'lib.update.success' });
  });

  router.get('/libs/:libID/team.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const libId = req.params.libID;
    if (!(await canReadLib(user, libId))) return res.status(404).json({ error: 'lib.team.read.denied' });

    const teams = db.find('library_team', { libID: libId });
    const result = teams.map((t: any) => {
      const u = db.findOne('user', { _id: t.userID });
      if (!u) return null;
      return { _id: u._id, id: u.id, name: u.name, lastname: u.lastname, email: u.email, image: u.image, permission: t.permission };
    }).filter(Boolean);
    return res.json(result);
  });

  router.get('/libs/:libID/suggestions/team.json', (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    if (!hasRole(user, ROLES.USER)) return res.status(404).json({ error: 'lib.suggestions.denied' });

    const myTeams = db.find('library_team', { userID: user.id });
    const libIds = myTeams.map((t: any) => t.libID);
    const relatedTeams = db.find('library_team', { libID: { $in: libIds } });
    const userIds = [...new Set(relatedTeams.map((t: any) => t.userID))];
    const result = userIds.map((uid) => {
      const u = db.findOne('user', { _id: uid });
      if (!u) return null;
      return { _id: u._id, id: u.id, name: u.name, lastname: u.lastname, email: u.email, image: u.image };
    }).filter(Boolean);
    return res.json(result);
  });

  router.post('/libs/:libID/team', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const libId = req.params.libID;
    if (!(await canWriteLib(user, libId))) return res.status(404).json({ error: 'lib.team.create.denied' });

    const { email, permission } = req.body;
    if (!email || permission === undefined) return res.status(405).json({ error: 'lib.team.invalid' });
    if (permission >= 3) return res.status(405).json({ error: 'lib.team.owner' });
    const target = db.findOne('user', { email });
    if (!target) return res.status(404).json({ error: 'lib.team.email' });

    const existing = db.findOne('library_team', { userID: target._id, libID: libId });
    if (existing) {
      db.updateCollection('library_team', { _id: existing._id }, { $set: { permission, lastUpdate: Date.now() } });
    } else {
      db.insert('library_team', { _id: Util.getRandomString(), userID: target._id, libID: libId, permission, created: Date.now() });
    }
    return res.json({ message: 'lib.team.add.success' });
  });

  router.post('/libs/:libID/team/:userID', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const libId = req.params.libID;
    const userId = req.params.userID;
    if (!(await canWriteLib(user, libId))) return res.status(404).json({ error: 'lib.team.update.denied' });

    const { permission } = req.body;
    if (permission === undefined) return res.status(405).json({ error: 'lib.team.invalid' });
    if (permission >= 3) return res.status(405).json({ error: 'lib.team.owner' });

    db.updateCollection('library_team', { userID: userId, libID: libId }, { $set: { permission, lastUpdate: Date.now() } });
    return res.json({ message: 'lib.team.update.success' });
  });

  router.delete('/libs/:libID/team/:userID', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const libId = req.params.libID;
    const userId = req.params.userID;
    if (user?.id === userId) return res.status(405).json({ error: 'lib.team.remove.self' });
    if (!(await canWriteLib(user, libId))) return res.status(404).json({ error: 'lib.team.remove.denied' });

    db.removeDocuments('library_team', { userID: userId, libID: libId });
    return res.json({ message: 'lib.team.remove.success' });
  });

  return router;
}
