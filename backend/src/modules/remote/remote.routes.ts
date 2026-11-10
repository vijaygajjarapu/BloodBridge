import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { remoteDonationService } from './remote.service.js';

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
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

const pledgeSchema = z.object({ bloodBankId: z.string().min(1, 'Choose a partner blood bank.') });
const donatedSchema = z.object({ donationRef: z.string({ required_error: 'Enter the slip or donor card number.' }).trim().min(3, 'Enter the slip or donor card number.').max(40) });
const confirmSchema = z.object({ ok: z.boolean() });
const bankSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(3).max(120),
  licenceNo: z.string().trim().max(60).optional(),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(60),
  district: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  phone: z.string().trim().max(20).optional(),
  active: z.boolean().optional(),
});

router.get('/banks', requireAuth, wrap((req) => remoteDonationService.banks({ country: str(req.query.country), state: str(req.query.state), district: str(req.query.district) })));
router.get('/requests/:id', requireAuth, wrap((req) => remoteDonationService.summary(req.params.id, req.user!.userId)));
router.get('/requests/:id/credits', requireAuth, wrap((req) => remoteDonationService.creditsForRequester(req.user!.userId, req.params.id)));
router.post('/requests/:id/pledge', requireAuth, validate(pledgeSchema), wrap((req) => remoteDonationService.pledge(req.user!.userId, req.params.id, req.body.bloodBankId)));
router.post('/requests/:id/donated', requireAuth, validate(donatedSchema), wrap((req) => remoteDonationService.markDonated(req.user!.userId, req.params.id, req.body.donationRef)));
router.post('/requests/:id/cancel', requireAuth, wrap((req) => remoteDonationService.cancel(req.user!.userId, req.params.id)));

// BloodBridge staff
router.get('/admin/queue', requireAdmin, wrap(() => remoteDonationService.adminQueue()));
router.post('/admin/:id/confirm', requireAdmin, validate(confirmSchema), wrap((req) => remoteDonationService.adminConfirm(req.user!.userId, req.params.id, req.body.ok)));
router.get('/admin/banks', requireAdmin, wrap(() => remoteDonationService.adminListBanks()));
router.post('/admin/banks', requireAdmin, validate(bankSchema), wrap((req) => remoteDonationService.adminSaveBank(req.body)));

export default router;
