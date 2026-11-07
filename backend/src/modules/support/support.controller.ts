import { Request, Response, NextFunction } from 'express';
import { supportService } from './support.service.js';

export class SupportController {
  async submitInquiry(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await supportService.submitInquiry({
        ...req.body,
        userId: req.user?.userId,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getFaqs(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await supportService.getFaqs();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const supportController = new SupportController();
