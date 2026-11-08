import { Request, Response, NextFunction } from 'express';
import { referralService } from './referrals.service.js';
import { subscriptionService } from '../subscriptions/subscriptions.service.js';
import { AppError } from '../../shared/types.js';

export class ReferralController {
  async validateCode(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await referralService.validateReferralCode(req.params.code);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await referralService.getReferralStats(req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async share(req: Request, res: Response, next: NextFunction) {
    try {
      // Sharing the savior link is a subscriber feature (admins excepted)
      if (req.user!.role !== 'admin' && !(await subscriptionService.isActive(req.user!.userId))) {
        throw new AppError(
          'Sharing your savior link is part of the Family Circle subscription. Finding donors and posting blood requests are always free.',
          402,
          'SUBSCRIPTION_REQUIRED',
        );
      }
      const result = await referralService.shareReferral(req.user!.userId, req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const referralController = new ReferralController();
