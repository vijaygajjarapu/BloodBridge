import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';

export class AuthController {
  async signin(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.signin({
        ...req.body,
        ipAddress: req.ip,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async verifyLoginOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.verifyLoginOtp(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async requestPhoneLoginOtp(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await authService.requestPhoneLoginOtp({ ...req.body, ipAddress: req.ip }));
    } catch (error) {
      next(error);
    }
  }

  async verifyPhoneLoginOtp(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await authService.verifyPhoneLoginOtp(req.body));
    } catch (error) {
      next(error);
    }
  }

  /** Keeps an active session alive: returns a fresh short-lived token */
  async refreshSession(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Your session has ended. Please sign in again.' });
      }
      res.json(await authService.refreshSession(req.user.userId));
    } catch (error) {
      next(error);
    }
  }

  async resendLoginOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.resendLoginOtp({
        ...req.body,
        ipAddress: req.ip,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.signup(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async signupWithReferral(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.signupWithReferral(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.verifyEmail(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async resendVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.resendVerification(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const email = req.body.email || req.body.identifier;
      const result = await authService.signin({
        ...req.body,
        email,
        ipAddress: req.ip,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const verified = await authService.verifyOtp(req.body);
      res.json({ verified, success: true, message: 'OTP verified successfully.' });
    } catch (error) {
      next(error);
    }
  }

  async requestOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const email = req.body.email || (req.user ? req.user.email : '');
      const purpose = req.body.purpose || 'verification';
      const result = await authService.sendEmailOtp(email, purpose, req.user?.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.requestPasswordReset(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async verifyResetToken(req: Request, res: Response, next: NextFunction) {
    try {
      const token = (req.query.token as string) || (req.body.token as string) || '';
      const result = await authService.verifyResetToken(token);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.resetPassword(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required' });
      }
      const result = await authService.changePassword(req.user.userId, req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Not logged in' });
      }
      const result = await authService.getCurrentSession(req.user.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.user) {
        await authService.logout(req.user.userId);
      }
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
