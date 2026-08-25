import { Router, Request, Response } from 'express';
import { SQLiteClient } from '../db/SQLiteClient';
import { JWTService } from '../services/JWTService';
import { Config } from '../config';
import { QuxUser } from '../acl/ACL';
import * as Util from '../util/Util';

export function createUserRouter(db: SQLiteClient, jwt: JWTService, config: Config): Router {
  const router = Router();

  const cleanUser = (user: any) => {
    const { password, ...rest } = user;
    return { ...rest, id: user._id || user.id };
  };

  router.get('/user', (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    if (!user) {
      return res.json({
        id: '-1',
        name: 'Guest',
        lastname: 'Guest',
        email: 'guest@quant-ux.com',
        role: 'guest'
      });
    }
    const dbUser = db.findOne('user', { _id: user.id });
    if (!dbUser) {
      return res.status(404).json({ error: 'user.not.found' });
    }
    return res.json(cleanUser(dbUser));
  });

  router.get('/user/:id.json', (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const id = req.params.id;
    const dbUser = db.findOne('user', { _id: id });
    if (!dbUser) {
      return res.status(404).json({ error: 'user.not.found' });
    }
    if (user?.id !== id && user?.role !== 'user') {
      return res.status(401).json({ error: 'user.read.denied' });
    }
    return res.json(cleanUser(dbUser));
  });

  router.post('/user', (req: Request, res: Response) => {
    if (!config.userAllowSignUp) {
      return res.status(405).json({ error: 'user.create.nosignup' });
    }

    const body = req.body;
    if (!body.email || !body.password) {
      return res.status(405).json({ error: 'user.create.error' });
    }

    const email = body.email.toLowerCase();
    if (!Util.isEmailAllowed(email, config.userAllowedDomains)) {
      return res.status(405).json({ error: 'user.create.domain' });
    }

    const existing = db.count('user', { email });
    if (existing > 0) {
      return res.status(405).json({ error: 'user.create.error' });
    }

    const now = Date.now();
    const user = {
      _id: Util.getRandomString(),
      name: body.name || '',
      lastname: body.lastname || '',
      email,
      password: Util.hashPassword(body.password),
      role: 'user',
      plan: 'Free',
      newsletter: false,
      lastNotification: 0,
      acceptedTOS: now,
      acceptedPrivacy: now,
      acceptedGDPR: true,
      acceptedAI: now,
      created: now,
      lastUpdate: now,
      tos: false,
      aiUsage: 0,
      aiUsageTotal: 0
    };

    db.insert('user', user);
    const token = jwt.getToken(user);
    const response = { ...cleanUser(user), token };
    return res.json(response);
  });

  router.post('/login/', (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(405).json({ error: 'user.login.fail' });
    }

    const user = db.findOne('user', { email: email.toLowerCase() });
    if (!user) {
      return res.status(405).json({ error: 'user.login.fail' });
    }

    if (user.status === 'retired') {
      return res.status(405).json({ error: 'user.login.fail' });
    }

    if (!Util.matchPassword(password, user.password)) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      db.updateCollection('user', { _id: user._id }, { $set: { failedLoginAttempts: user.failedLoginAttempts } });
      return res.status(405).json({ error: 'user.login.fail' });
    }

    const loginCount = (user.loginCount || 0) + 1;
    const now = Date.now();
    db.updateCollection('user', { _id: user._id }, {
      $set: {
        loginCount,
        lastlogin: now,
        lastUpdate: now
      }
    });

    const token = jwt.getToken({ ...user, _id: user._id });
    const response = { ...cleanUser(user), token };
    return res.json(response);
  });

  router.delete('/login/', (req: Request, res: Response) => {
    return res.json({ message: 'user.logged.out' });
  });

  router.post('/user/notification/last.json', (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    if (!user) {
      return res.status(401).json({ error: 'user.notification.denied' });
    }
    db.updateCollection('user', { _id: user.id }, { $set: { lastNotification: Date.now() } });
    return res.json({ message: 'user.notification.updated' });
  });

  router.post('/user/:id.json', (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const id = req.params.id;

    if (user?.id !== id && user?.role !== 'user') {
      return res.status(401).json({ error: 'user.update.denied' });
    }

    const updates: any = { ...req.body };
    delete updates._id;
    delete updates.id;
    delete updates.role;
    delete updates.paidUntil;
    delete updates.domain;
    delete updates.status;
    delete updates.plan;
    delete updates.has;

    if (updates.email) {
      const email = updates.email.toLowerCase();
      const existing = db.findOne('user', { email });
      if (existing && existing._id !== id) {
        return res.status(405).json({ error: 'user.update.email.taken' });
      }
      updates.email = email;
    }

    if (updates.password) {
      updates.password = Util.hashPassword(updates.password);
    }

    updates.lastUpdate = Date.now();
    db.updateCollection('user', { _id: id }, { $set: updates });

    const dbUser = db.findOne('user', { _id: id });
    return res.json(cleanUser(dbUser));
  });

  return router;
}
