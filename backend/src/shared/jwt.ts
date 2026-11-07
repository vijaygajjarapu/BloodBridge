import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
}

/**
 * Access tokens live only as long as the idle timeout (default 5 minutes).
 * The website refreshes the token while the person is active, so an idle session simply expires.
 */
export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign({ userId: payload.userId, email: payload.email, role: payload.role }, config.jwt.secret, {
    expiresIn: `${config.session.idleMinutes}m`,
    issuer: 'bloodbridge-api',
    audience: 'bloodbridge-app',
  });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiry as any,
    issuer: 'bloodbridge-api',
    audience: 'bloodbridge-refresh',
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwt.secret, {
    issuer: 'bloodbridge-api',
    audience: 'bloodbridge-app',
  }) as TokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, config.jwt.secret, {
    issuer: 'bloodbridge-api',
    audience: 'bloodbridge-refresh',
  }) as RefreshTokenPayload;
}
