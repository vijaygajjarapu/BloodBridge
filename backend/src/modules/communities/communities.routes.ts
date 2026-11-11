import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { communityService, COMMUNITY_TYPES } from './communities.service.js';
import { requestService, BLOOD_GROUPS } from '../requests/requests.service.js';
import { AppError } from '../../shared/types.js';

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

const createSchema = z.object({
  name: z.string({ required_error: 'Enter the community name.' }).trim().min(3, 'Enter the full name (at least 3 letters).').max(80),
  type: z.enum(COMMUNITY_TYPES, { errorMap: () => ({ message: 'Choose what kind of community this is.' }) }),
  country: z.string().optional(),
  state: z.string({ required_error: 'Choose the state.' }).min(1, 'Choose the state.'),
  district: z.string({ required_error: 'Choose the district.' }).min(1, 'Choose the district.'),
  city: z.string({ required_error: 'Enter the city or town.' }).trim().min(2, 'Enter the city or town.'),
  locality: z.string().trim().max(80).optional(),
  pinCode: z.string().trim().optional(),
});

const prefsSchema = z.object({
  alertNearby: z.boolean().optional(),
  alertFromMembers: z.boolean().optional(),
  muted: z.boolean().optional(),
  isAlumni: z.boolean().optional(),
});

const confirmSchema = z.object({ stillHere: z.boolean() });
const joinCodeSchema = z.object({ alertFromMembers: z.boolean().optional() });

router.get('/mine', requireAuth, wrap((req) => communityService.mine(req.user!.userId)));

router.get(
  '/search',
  requireAuth,
  wrap((req) =>
    communityService.search({
      q: str(req.query.q),
      country: str(req.query.country),
      state: str(req.query.state),
      district: str(req.query.district),
      pinCode: str(req.query.pinCode),
    }),
  ),
);

/** Communities near a hospital with how many members could donate now (counts only, small counts hidden) */
router.get(
  '/near',
  requireAuth,
  wrap(async (req) => {
    const state = str(req.query.state);
    const district = str(req.query.district);
    const bloodGroup = str(req.query.bloodGroup);
    if (!state || !district) throw new AppError('Choose the state and district first.', 400, 'VALIDATION_FAILED');
    const groups =
      bloodGroup && (BLOOD_GROUPS as readonly string[]).includes(bloodGroup)
        ? requestService.compatibleDonorGroups(bloodGroup)
        : [...BLOOD_GROUPS];
    return communityService.near({
      country: str(req.query.country),
      state,
      district,
      pinCode: str(req.query.pinCode),
      donorGroups: groups,
      excludeUserId: req.user!.userId,
    });
  }),
);

// Invite links for groups (WhatsApp groups, associations, clubs)
router.get('/by-code/:code', requireAuth, wrap((req) => communityService.byInviteCode(req.params.code, req.user!.userId)));
router.post('/join-code/:code', requireAuth, validate(joinCodeSchema), wrap((req) => communityService.joinByInviteCode(req.user!.userId, req.params.code, req.body.alertFromMembers)));
router.post('/:id/invite', requireAuth, wrap((req) => communityService.inviteLink(req.user!.userId, req.params.id)));

router.post('/', requireAuth, validate(createSchema), wrap((req) => communityService.create(req.user!.userId, req.body), 201));
router.post('/:id/join', requireAuth, wrap((req) => communityService.join(req.user!.userId, req.params.id)));
router.delete('/:id/membership', requireAuth, wrap((req) => communityService.leave(req.user!.userId, req.params.id)));
router.patch('/:id/membership', requireAuth, validate(prefsSchema), wrap((req) => communityService.updatePrefs(req.user!.userId, req.params.id, req.body)));
router.post('/:id/confirm', requireAuth, validate(confirmSchema), wrap((req) => communityService.confirm(req.user!.userId, req.params.id, req.body.stillHere)));

export default router;
