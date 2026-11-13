import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, authenticate } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { familyService, BLOOD_GROUPS, RELATIONS } from './family.service.js';
import { subscriptionService } from '../subscriptions/subscriptions.service.js';
import { AppError } from '../../shared/types.js';

const router = Router();

const memberSchema = z.object({
  name: z.string().trim().min(2, 'Enter the family member’s name (at least 2 letters).').max(60),
  relation: z.enum(RELATIONS, { errorMap: () => ({ message: 'Choose how this person is related to you.' }) }),
  bloodGroup: z.enum(BLOOD_GROUPS, { errorMap: () => ({ message: 'Choose a blood group.' }) }),
  dateOfBirth: z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || (!isNaN(Date.parse(v)) && new Date(v) < new Date()), 'Enter a date of birth in the past.'),
  // Optional: this family member (18+) is willing to donate blood
  willingToDonate: z.boolean().optional(),
  useOwnerPhone: z.boolean().optional(),
  donorPhone: z.string().trim().max(20).optional().nullable(),
  contactConsent: z.boolean().optional(),
});

const pledgeSchema = z.object({
  bloodGroups: z.array(z.enum(BLOOD_GROUPS)).min(1, 'Choose at least one blood group.'),
  shareContact: z.boolean(),
});

const wrap =
  (fn: (req: Request) => Promise<unknown>, status = 200) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(status).json(await fn(req));
    } catch (e) {
      next(e);
    }
  };

// Family members (owner)
router.get('/members', requireAuth, wrap((req) => familyService.listMembers(req.user!.userId)));
router.post('/members', requireAuth, validate(memberSchema), wrap((req) => familyService.addMember(req.user!.userId, req.body), 201));
router.put('/members/:id', requireAuth, validate(memberSchema.partial()), wrap((req) => familyService.updateMember(req.user!.userId, req.params.id, req.body)));
router.delete('/members/:id', requireAuth, wrap((req) => familyService.removeMember(req.user!.userId, req.params.id)));

// Invite link (owner)
// Creating / sharing the family invite link is a subscriber feature (pledging through a link stays free)
router.post(
  '/invite',
  requireAuth,
  wrap(async (req) => {
    if (req.user!.role !== 'admin' && !(await subscriptionService.isActive(req.user!.userId))) {
      throw new AppError(
        'Sharing a family invite is part of the Donor Circle subscription. Finding donors and posting blood requests are always free.',
        402,
        'SUBSCRIPTION_REQUIRED',
      );
    }
    return familyService.getOrCreateInvite(req.user!.userId);
  }),
);

// Public invite page: only first name + blood groups
router.get('/invites/:code', authenticate, wrap((req) => familyService.getInvitePublic(req.params.code, req.user?.userId)));

// Donor pledges
router.post('/invites/:code/pledge', requireAuth, validate(pledgeSchema), wrap((req) => familyService.pledge(req.user!.userId, req.params.code, req.body)));
router.get('/my-pledges', requireAuth, wrap((req) => familyService.myPledges(req.user!.userId)));
router.delete('/my-pledges/:ownerUserId', requireAuth, wrap((req) => familyService.withdrawFromFamily(req.user!.userId, req.params.ownerUserId)));

// Donor Circle (owner dashboard; names hidden unless subscribed)
router.get('/circle', requireAuth, wrap((req) => familyService.circle(req.user!.userId)));

// Per-relationship permissions (donor side)
router.patch(
  '/my-pledges/:ownerUserId/permissions',
  requireAuth,
  validate(z.object({ shareContact: z.boolean().optional(), allowRequestAlerts: z.boolean().optional(), shareAvailability: z.boolean().optional() })),
  wrap((req) => familyService.updatePermissions(req.user!.userId, req.params.ownerUserId, req.body)),
);

// Family owner ends a relationship (optionally: don't let them pledge again)
router.post(
  '/circle/donors/:donorUserId/end',
  requireAuth,
  validate(z.object({ block: z.boolean().optional() })),
  wrap((req) => familyService.endRelationship(req.user!.userId, req.params.donorUserId, req.body)),
);

export default router;
