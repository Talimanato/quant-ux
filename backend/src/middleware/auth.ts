import { Request, Response, NextFunction } from 'express';
import { JWTService } from '../services/JWTService';
import { QuxUser } from '../acl/ACL';

declare global {
  namespace Express {
    interface Request {
      user?: QuxUser;
    }
  }
}

export function createAuthMiddleware(jwt: JWTService) {
  return (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token && req.query.token) {
      token = req.query.token as string;
    }

    if (token) {
      const user = jwt.getUser(token);
      if (user) {
        req.user = user;
      }
    }

    next();
  };
}
