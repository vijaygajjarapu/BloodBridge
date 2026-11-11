import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { organisationService, ORG_TYPES } from './organisations.service.js';

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

const email = z.string({ required_error: 'Enter your work email.' }).trim().email('Enter a valid work email.');
const registerSchema = z.object({
  name: z.string({ required_error: 'Enter the organisation name.' }).trim().min(2, 'Enter the organisation name.').max(100),
  type: z.enum(ORG_TYPES),
  workEmail: email,
  emailDomains: z.array(z.string().max(80)).max(5).optional(),
  country: z.string().optional(),
  state: z.string({ required_error: 'Choose the state.' }).min(1, 'Choose the state.'),
  district: z.string({ required_error: 'Choose the district.' }).min(1, 'Choose the district.'),
  city: z.string({ required_error: 'Enter the city.' }).trim().min(2, 'Enter the city.'),
});
const joinSchema = z.object({
  inviteCode: z.string({ required_error: 'Enter the invite code.' }).trim().min(4, 'Enter the invite code.').max(20),
  workEmail: email,
  employeeId: z.string().trim().max(40).optional(),
});
const codeSchema = z.object({ code: z.string().trim().min(4).max(10) });
const impactSchema = z.object({ countInImpact: z.boolean() });
const memberSchema = z.object({ role: z.enum(['member', 'admin']).optional(), remove: z.boolean().optional() });
const announceSchema = z.object({
  kind: z.enum(['announcement', 'camp']),
  title: z.string({ required_error: 'Enter a title.' }).trim().min(3, 'Enter a title.').max(100),
  body: z.string({ required_error: 'Write the message.' }).trim().min(5, 'Write the message.').max(600),
  campDate: z.string().refine((v) => !isNaN(Date.parse(v)), 'Choose a date.').optional(),
  place: z.string().trim().max(120).optional(),
});
const adminUpdateSchema = z.object({
  verified: z.boolean().optional(),
  plan: z.enum(['pilot', 'paid']).optional(),
  emailDomains: z.array(z.string().max(80)).max(5).optional(),
});

// Employee side
router.get('/mine', requireAuth, wrap((req) => organisationService.mine(req.user!.userId)));
router.get('/by-code/:code', requireAuth, wrap((req) => organisationService.byInviteCode(req.params.code)));
router.post('/register', requireAuth, validate(registerSchema), wrap((req) => organisationService.register(req.user!.userId, req.body), 201));
router.post('/join', requireAuth, validate(joinSchema), wrap((req) => organisationService.join(req.user!.userId, req.body.inviteCode, req.body.workEmail, req.body.employeeId)));
router.post('/:id/verify-email', requireAuth, validate(codeSchema), wrap((req) => organisationService.verifyEmail(req.user!.userId, req.params.id, req.body.code)));
router.post('/:id/resend-code', requireAuth, wrap((req) => organisationService.resendCode(req.user!.userId, req.params.id)));
router.post('/:id/leave', requireAuth, wrap((req) => organisationService.leave(req.user!.userId, req.params.id)));
router.patch('/:id/me', requireAuth, validate(impactSchema), wrap((req) => organisationService.setCountInImpact(req.user!.userId, req.params.id, req.body.countInImpact)));
router.get('/:id/announcements', requireAuth, wrap((req) => organisationService.announcements(req.user!.userId, req.params.id)));

// Organisation admin (HR / CSR team)
router.get('/:id/dashboard', requireAuth, wrap((req) => organisationService.dashboard(req.user!.userId, req.params.id)));
router.get('/:id/members', requireAuth, wrap((req) => organisationService.members(req.user!.userId, req.params.id)));
router.patch('/:id/members/:memberId', requireAuth, validate(memberSchema), wrap((req) => organisationService.updateMember(req.user!.userId, req.params.id, req.params.memberId, req.body)));
router.post('/:id/announcements', requireAuth, validate(announceSchema), wrap((req) => organisationService.announce(req.user!.userId, req.params.id, req.body), 201));

// BloodNation staff
router.get('/admin/all', requireAdmin, wrap(() => organisationService.adminList()));
router.patch('/admin/:id', requireAdmin, validate(adminUpdateSchema), wrap((req) => organisationService.adminUpdate(req.user!.userId, req.params.id, req.body)));

export default router;
