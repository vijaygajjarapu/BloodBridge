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
const requestSchema = z.object({
  name: z.string({ required_error: 'Enter the company name.' }).trim().min(2, 'Enter the company name.').max(100),
  type: z.enum(ORG_TYPES),
  contactName: z.string({ required_error: 'Enter the HR contact name.' }).trim().min(2, 'Enter the HR contact name.').max(80),
  contactEmail: z.string({ required_error: 'Enter the HR contact email.' }).trim().email('Enter a valid email.'),
  contactPhone: z.string().trim().max(20).optional(),
  country: z.string().optional(),
  state: z.string({ required_error: 'Choose the state.' }).min(1, 'Choose the state.'),
  district: z.string({ required_error: 'Choose the district.' }).min(1, 'Choose the district.'),
  city: z.string({ required_error: 'Enter the city.' }).trim().min(2, 'Enter the city.'),
});
const inviteCode = z.string({ required_error: 'Enter the company code.' }).trim().min(4, 'Enter the company code.').max(20);
const joinSchema = z.object({ inviteCode, workEmail: email });
const linkSchema = z.discriminatedUnion('method', [
  z.object({
    inviteCode,
    method: z.literal('employee_id'),
    employeeId: z.string({ required_error: 'Enter your employee ID.' }).trim().min(1, 'Enter your employee ID.').max(40),
    dateOfBirth: z.string({ required_error: 'Enter your date of birth.' }).trim().min(8, 'Enter your date of birth.').max(10),
  }),
  z.object({ inviteCode, method: z.literal('work_email'), workEmail: email }),
]);
const listSchema = z.object({
  rows: z
    .array(z.object({ employeeId: z.string().max(60), dateOfBirth: z.string().max(20), workEmail: z.string().max(200).optional() }))
    .min(1, 'Add at least one employee.')
    .max(5000, 'Up to 5000 rows at a time.'),
  fullList: z.boolean().default(false),
});
const addAdminSchema = z.object({ identifier: z.string({ required_error: 'Enter an email or mobile number.' }).trim().min(5).max(120) });
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
// "Bring BloodNation to my company": only a request; staff add the company after the contract
router.post('/request', requireAuth, validate(requestSchema), wrap((req) => organisationService.requestCompany(req.user!.userId, req.body), 201));
// Link my company: employee ID + date of birth, or a code to the work email on the company's employee list
router.post('/link', requireAuth, validate(linkSchema), wrap((req) => organisationService.link(req.user!.userId, req.body)));
router.post('/join', requireAuth, validate(joinSchema), wrap((req) => organisationService.join(req.user!.userId, req.body.inviteCode, req.body.workEmail)));
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
// HR: tell us who left (one person, or a pasted CSV of work email / employee ID and last working day)
const exitsSchema = z.object({
  rows: z
    .array(z.object({ key: z.string().trim().min(1).max(200), exitDate: z.string().trim().min(8).max(30) }))
    .min(1, 'Add at least one person.')
    .max(2000, 'Up to 2000 rows at a time.'),
});
// HR: the employee list (who the company covers)
router.get('/:id/eligibility', requireAuth, wrap((req) => organisationService.eligibility(req.user!.userId, req.params.id)));
router.post('/:id/eligibility', requireAuth, validate(listSchema), wrap((req) => organisationService.uploadEligibility(req.user!.userId, req.params.id, req.body.rows, req.body.fullList)));
router.post('/:id/exits', requireAuth, validate(exitsSchema), wrap((req) => organisationService.hrExits(req.user!.userId, req.params.id, req.body.rows)));

// BloodNation staff
router.get('/admin/all', requireAdmin, wrap(() => organisationService.adminList()));
router.post('/admin/:id/admins', requireAdmin, validate(addAdminSchema), wrap((req) => organisationService.adminAddOrgAdmin(req.user!.userId, req.params.id, req.body.identifier)));
router.patch('/admin/:id', requireAdmin, validate(adminUpdateSchema), wrap((req) => organisationService.adminUpdate(req.user!.userId, req.params.id, req.body)));

export default router;
