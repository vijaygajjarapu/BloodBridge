import { Request, Response, NextFunction } from 'express';
import { usersService } from './users.service.js';

export class UsersController {
  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await usersService.getProfile(req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await usersService.updateProfile(req.user!.userId, req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async exportData(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await usersService.exportData(req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async deleteAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await usersService.requestAccountDeletion(req.user!.userId, req.body.reason || '');
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const usersController = new UsersController();
