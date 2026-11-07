import { Request, Response, NextFunction } from 'express';
import { consentService } from './consent.service.js';

export class ConsentController {
  async getPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await consentService.getConsentPreferences(req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateConsent(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await consentService.updateConsent(req.user!.userId, req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async listConsentsAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 10;
      const status = req.query.status as string | undefined;

      const result = await consentService.listConsentsAdmin({ status, page, pageSize });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const consentController = new ConsentController();
