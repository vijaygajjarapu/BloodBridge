import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { partnerService, PARTNER_TYPES } from './partners.service.js';

const router = Router();

const wrap =
  (fn: (req: Request) => Promise<unknown>, status = 200) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(status).json(await fn(req));
    } catch (e) {
      next(e);
    }
  };

const redeemSchema = z.object({ code: z.string({ required_error: 'Enter the code.' }).trim().min(4, 'Enter the code.').max(24) });
const date = z.string().refine((v) => !isNaN(Date.parse(v)), 'Choose a date.');
const createSchema = z.object({
  name: z.string({ required_error: 'Enter the partner name.' }).trim().min(2, 'Enter the partner name.').max(100),
  partnerType: z.enum(PARTNER_TYPES, { errorMap: () => ({ message: 'Choose the kind of partner.' }) }),
  code: z.string().trim().max(24).optional(),
  seats: z.number({ required_error: 'Enter how many people can use the code.' }).int().min(1).max(10_000_000),
  monthsFree: z.number().int().min(1).max(36).optional(),
  endsAt: date.nullable().optional(),
  contactName: z.string().trim().max(100).optional(),
  contactEmail: z.string().trim().email('Enter a valid email.').optional().or(z.literal('')),
});
const updateSchema = z.object({
  active: z.boolean().optional(),
  seats: z.number().int().min(1).max(10_000_000).optional(),
  monthsFree: z.number().int().min(1).max(36).optional(),
  endsAt: date.nullable().optional(),
});

// People
router.get('/code/:code', requireAuth, wrap((req) => partnerService.lookup(req.params.code)));
router.post('/redeem', requireAuth, validate(redeemSchema), wrap((req) => partnerService.redeem(req.user!.userId, req.body.code)));
router.get('/mine', requireAuth, wrap((req) => partnerService.mySponsor(req.user!.userId)));

// BloodBridge staff
router.get('/admin', requireAuth, requireAdmin, wrap(() => partnerService.adminList()));
router.post('/admin', requireAuth, requireAdmin, validate(createSchema), wrap((req) => partnerService.adminCreate(req.user!.userId, req.body), 201));
router.patch('/admin/:id', requireAuth, requireAdmin, validate(updateSchema), wrap((req) => partnerService.adminUpdate(req.user!.userId, req.params.id, req.body)));
router.get('/admin/:id/report', requireAuth, requireAdmin, wrap((req) => partnerService.report(req.params.id)));

export default router;
