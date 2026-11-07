import { Request, Response, NextFunction } from 'express';
import { donorService } from './donors.service.js';

export class DonorController {
  async listMyDonors(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await donorService.listMyDonors(req.user!.userId, req.query as any);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getDonorById(req: Request, res: Response, next: NextFunction) {
    try {
      const donor = await donorService.getDonorById(req.params.id, req.user?.userId, req.user?.role);
      res.json(donor);
    } catch (error) {
      next(error);
    }
  }

  async registerDonor(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await donorService.registerDonor(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateDonor(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await donorService.updateDonor(req.params.id, req.body, req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async reportIncorrectInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await donorService.reportIncorrectInfo(req.params.id, req.body.reason, req.user?.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const donorController = new DonorController();
