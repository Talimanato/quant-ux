import { ACL, QuxUser, ROLES, hasRole } from './ACL';
import { SQLiteClient } from '../db/SQLiteClient';

export class AppAcl extends ACL {
  constructor(private db: SQLiteClient) {
    super();
  }

  private async checkPermission(user: QuxUser | null, appId: string, minPermission: number): Promise<boolean> {
    if (!user || !hasRole(user, ROLES.USER)) return false;
    if (appId === undefined || appId === null) return false;

    const app = this.db.findOne('app', { _id: appId });
    if (app && app.isPublic) {
      if (minPermission >= 3) return true; // public apps are readable by default
    }

    const team = this.db.findOne('team', { userID: user.id, appID: appId });
    if (!team) return false;
    return team.permission >= minPermission;
  }

  async canRead(user: QuxUser | null, appId?: string): Promise<boolean> {
    return this.checkPermission(user, appId || '', 1);
  }

  async canWrite(user: QuxUser | null, appId?: string): Promise<boolean> {
    return this.checkPermission(user, appId || '', 2);
  }

  async canDelete(user: QuxUser | null, appId?: string): Promise<boolean> {
    return this.checkPermission(user, appId || '', 3);
  }

  async canTest(user: QuxUser | null, appId?: string): Promise<boolean> {
    return this.checkPermission(user, appId || '', 1);
  }
}
