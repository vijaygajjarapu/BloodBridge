import { Request, Response, NextFunction } from 'express';
import { notificationService } from './notifications.service.js';

export class NotificationController {
  async getNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await notificationService.getNotifications(req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationService.markAsRead(req.params.id, req.user!.userId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationService.markAllAsRead(req.user!.userId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
