import { Request, Response } from 'express';
import { oauthService, OAUTH_STATE_COOKIE } from './oauth.service.js';
import { AppError } from '../../shared/types.js';
import { logger } from '../../shared/logger.js';

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

const isProduction = process.env.NODE_ENV === 'production';

export class OAuthController {
  /** GET /auth/google?country=IN — returns the Google consent URL and sets the state cookie */
  getGoogleUrl(req: Request, res: Response) {
    try {
      const { url, nonce } = oauthService.getGoogleAuthUrl(req.query.country as string | undefined);
      // Cookies are scoped to the host (not the port), so the backend callback on :5000 can read it
      res.cookie(OAUTH_STATE_COOKIE, nonce, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
        maxAge: 10 * 60 * 1000,
        path: '/',
      });
      res.json({ url, configured: true });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ code: error.code, message: error.message, configured: false });
      }
      throw error;
    }
  }

  /** GET /auth/google/callback — Google sends the browser here; we always redirect back to the website */
  async googleCallback(req: Request, res: Response) {
    const nonce = readCookie(req, OAUTH_STATE_COOKIE);
    res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });

    if (req.query.error) {
      return res.redirect(oauthService.errorRedirectUrl('Google sign-in was cancelled.'));
    }

    const code = req.query.code as string | undefined;
    if (!code) {
      return res.redirect(oauthService.errorRedirectUrl('Google did not return a sign-in code. Please try again.'));
    }

    try {
      const result = await oauthService.handleGoogleCallback(code, req.query.state as string | undefined, nonce);
      res.redirect(result.redirectUrl);
    } catch (error: any) {
      logger.error('Google sign-in failed:', error?.message || error);
      const message = error instanceof AppError ? error.message : 'Google sign-in failed. Please try again.';
      res.redirect(oauthService.errorRedirectUrl(message));
    }
  }
}

export const oauthController = new OAuthController();
