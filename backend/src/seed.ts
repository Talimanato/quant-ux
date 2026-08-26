import { SQLiteClient } from './db/SQLiteClient';
import * as Util from './util/Util';

/**
 * Ensures the default admin account exists so a fresh deployment can be
 * logged into without signing up first.
 *
 *   QUX_SEED_ADMIN=false    disable seeding entirely
 *   QUX_ADMIN_EMAIL         login name  (default: admin)
 *   QUX_ADMIN_PASSWORD      password    (default: admin)
 *
 * The account is only created when the email is not taken, so changing the
 * password later is respected.
 */
export function ensureDefaultAdmin(db: SQLiteClient): void {
  if (process.env.QUX_SEED_ADMIN === 'false') {
    return;
  }

  const email = (process.env.QUX_ADMIN_EMAIL || 'admin').toLowerCase();
  const password = process.env.QUX_ADMIN_PASSWORD || 'admin';

  if (db.count('user', { email }) > 0) {
    return;
  }

  const now = Date.now();
  db.insert('user', {
    _id: Util.getRandomString(),
    name: 'Admin',
    lastname: '',
    email,
    password: Util.hashPassword(password),
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
    tos: true,
    aiUsage: 0,
    aiUsageTotal: 0
  });
  console.log(`[seed] Default account ready: ${email} / ${password}`);
}
