import { Request, Response, NextFunction } from 'express';
import { adminService } from './admin.service.js';
import { consentService } from '../consent/consent.service.js';

export class AdminController {
  async getMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminService.getOverviewMetrics(req.query.country as string | undefined);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 10;
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;
      const country = req.query.country as string | undefined;

      const result = await adminService.listUsers({ search, status, country, page, pageSize });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminService.updateUserStatus(req.params.id, req.body.status, req.user?.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async listDonors(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 10;
      const result = await adminService.listDonors({ ...req.query, page, pageSize });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateDonorRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminService.updateDonorRecord(req.params.id, req.body, req.user?.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async listReferrals(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 10;
      const search = req.query.search as string | undefined;
      const country = req.query.country as string | undefined;

      const result = await adminService.listReferrals({ search, country, page, pageSize });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async toggleReferral(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminService.toggleReferralCode(req.params.id, req.body.isActive, req.user?.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async listConsents(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 10;
      const status = req.query.status as string | undefined;
      const country = req.query.country as string | undefined;

      const result = await consentService.listConsentsAdmin({ status, country, page, pageSize });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async listAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 10;
      const entityType = req.query.entityType as string | undefined;

      const result = await adminService.listAuditLogs({ entityType, page, pageSize });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminService.getSettings();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminService.updateSettings(req.body, req.user?.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();
