import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export interface UserToken {
  id: string;
  email: string;
  name: string;
  lastname: string;
  role: string;
}

export class JWTService {
  private secret: string;

  constructor(secret?: string) {
    this.secret = secret && secret.trim().length > 0 ? secret.trim() : uuidv4();
    if (!secret || secret.trim().length === 0) {
      console.warn('JWTService: No JWT secret provided, using random secret.');
    }
  }

  setSecret(secret: string): void {
    this.secret = secret;
  }

  getToken(user: any, days = 7): string {
    const payload = {
      id: user._id || user.id,
      email: user.email,
      name: user.name,
      lastname: user.lastname,
      role: user.role
    };
    return jwt.sign(payload, this.secret, {
      issuer: 'MATC',
      expiresIn: `${days}d`
    });
  }

  getUser(token: string): UserToken | null {
    try {
      const decoded = jwt.verify(token, this.secret, { issuer: 'MATC' }) as any;
      return {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
        lastname: decoded.lastname,
        role: decoded.role
      };
    } catch (err) {
      return null;
    }
  }

  getExpiresAt(token: string): string {
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.exp) {
        return new Date(decoded.exp * 1000).toISOString();
      }
    } catch (err) {
      // ignore
    }
    return '-';
  }
}
