export interface QuxUser {
  id: string;
  email: string;
  name: string;
  lastname: string;
  role: string;
}

export const ROLES = {
  GUEST: 'guest',
  USER: 'user'
};

export const PERMISSIONS = {
  OWNER: 1,
  WRITE: 2,
  READ: 3,
  EXECUTE: 4,
  TEST: 5,
  GUEST: 6
};

export function hasRole(user: QuxUser | null, role: string): boolean {
  if (!user) return role === ROLES.GUEST;
  if (role === ROLES.GUEST) return user.role === ROLES.GUEST || user.role === ROLES.USER;
  if (role === ROLES.USER) return user.role === ROLES.USER;
  return false;
}

export abstract class ACL {
  abstract canRead(user: QuxUser | null, resourceId?: string): Promise<boolean> | boolean;
  abstract canWrite(user: QuxUser | null, resourceId?: string): Promise<boolean> | boolean;
  abstract canDelete(user: QuxUser | null, resourceId?: string): Promise<boolean> | boolean;
  abstract canTest(user: QuxUser | null, resourceId?: string): Promise<boolean> | boolean;
}

export class TrueACL extends ACL {
  canRead() { return true; }
  canWrite() { return true; }
  canDelete() { return true; }
  canTest() { return true; }
}

export class UserAcl extends ACL {
  canRead(user: QuxUser | null, resourceId?: string): boolean {
    if (!user) return false;
    if (hasRole(user, ROLES.USER)) return true;
    return false;
  }

  canWrite(user: QuxUser | null, resourceId?: string): boolean {
    if (!user) return false;
    if (hasRole(user, ROLES.USER)) return true;
    return false;
  }

  canDelete(user: QuxUser | null, resourceId?: string): boolean {
    return this.canWrite(user, resourceId);
  }

  canTest(user: QuxUser | null, resourceId?: string): boolean {
    return this.canRead(user, resourceId);
  }
}
