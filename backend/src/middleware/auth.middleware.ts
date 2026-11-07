import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../shared/jwt.js';
import { AppError } from '../shared/types.js';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err: any) {
    // If token invalid, don't set req.user
    next();
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication required. Missing Bearer token.', 401, 'UNAUTHORIZED'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err: any) {
    return next(new AppError('Invalid or expired authentication session. Please log in again.', 401, 'UNAUTHORIZED'));
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (!req.user || req.user.role !== 'admin') {
      return next(new AppError('Forbidden: Administrator privileges required.', 403, 'FORBIDDEN'));
    }
    next();
  });
}
