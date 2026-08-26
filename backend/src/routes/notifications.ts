import { Router, Request, Response } from 'express';
import { SQLiteClient } from '../db/SQLiteClient';
import { QuxUser, ROLES, hasRole } from '../acl/ACL';
import * as Util from '../util/Util';
import { requireKeys } from '../util/ValidateBody';

export function createNotificationRouter(db: SQLiteClient): Router {
  const router = Router();

  router.get('/notifications.json', (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    if (!hasRole(user, ROLES.USER)) {
      return res.json([]);
    }

    const notifications = db.find('notification', {
      $or: [{ userID: user.id }, { read: 0 }]
    }, { sort: { created: -1 } });
    return res.json(notifications);
  });

  router.post('/notifications', (req: Request, res: Response) => {
    if (!requireKeys(req, res, ['userID', 'message'], 'notification.create.body.invalid')) {
      return;
    }
    const user = req.user as QuxUser;
    if (!hasRole(user, ROLES.USER)) {
      return res.status(401).json({ error: 'notification.create.denied' });
    }

    const body = {
      _id: Util.getRandomString(),
      userID: req.body.userID,
      message: req.body.message,
      type: req.body.type,
      read: 0,
      created: Date.now()
    };
    db.insert('notification', body);
    return res.json(body);
  });

  router.post('/notifications/:id/read', (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    if (!hasRole(user, ROLES.USER)) {
      return res.status(401).json({ error: 'notification.update.denied' });
    }

    db.updateCollection('notification', { _id: req.params.id }, { $set: { read: 1, lastUpdate: Date.now() } });
    return res.json({ message: 'notification.read.success' });
  });

  return router;
}
