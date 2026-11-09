import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/types.js';
import { DEFERRALS, RULES, checkEligibility, deferralEnds, type DeferralKey } from './eligibility.rules.js';

const router = Router();

const wrap = (fn: (req: Request) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
  fn(req).then((data) => res.json(data)).catch(next);

const DEFERRAL_KEYS = Object.keys(DEFERRALS) as [DeferralKey, ...DeferralKey[]];

const detailsSchema = z.object({
  sex: z.enum(['male', 'female', 'other']).nullable().optional(),
  weightKg: z.number().int().min(20, 'Enter your weight in kg.').max(250, 'Enter your weight in kg.').nullable().optional(),
});

const deferralSchema = z.object({
  reason: z.enum(DEFERRAL_KEYS, { errorMap: () => ({ message: 'Choose a reason.' }) }),
  date: z
    .string()
    .optional()
    .refine((v) => !v || (!isNaN(Date.parse(v)) && new Date(v) <= new Date()), 'Enter a date that is today or in the past.'),
});

async function loadMine(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { donorProfile: true } });
  if (!user) throw new AppError('Account not found.', 404, 'NOT_FOUND');
  return user;
}

function view(user: Awaited<ReturnType<typeof loadMine>>) {
  const p = user.donorProfile;
  const result = checkEligibility({
    dateOfBirth: user.dateOfBirth,
    sex: p?.sex,
    weightKg: p?.weightKg,
    lastDonationDate: p?.lastDonationDate,
    totalDonations: p?.totalDonations,
    deferredUntil: p?.deferredUntil,
    deferralReason: p?.deferralReason,
    permanentlyDeferred: p?.permanentlyDeferred,
  });
  return {
    hasDonorProfile: Boolean(p),
    ...result,
    details: {
      sex: p?.sex ?? null,
      weightKg: p?.weightKg ?? null,
      lastDonationDate: p?.lastDonationDate?.toISOString() ?? null,
      deferralReason: p?.deferralReason ?? null,
      deferredUntil: p?.deferredUntil?.toISOString() ?? null,
    },
    rules: RULES,
    deferralOptions: Object.entries(DEFERRALS).map(([key, d]) => ({ key, label: d.label })),
    note: 'This is a self-check. The blood bank always checks haemoglobin, blood pressure and health before taking blood.',
  };
}

// My eligibility (self-check)
router.get('/me', requireAuth, wrap(async (req) => view(await loadMine(req.user!.userId))));

// Sex and weight (used for the gap between donations and the minimum weight)
router.put(
  '/me',
  requireAuth,
  validate(detailsSchema),
  wrap(async (req) => {
    const user = await loadMine(req.user!.userId);
    if (!user.donorProfile) throw new AppError('Add your blood group to your profile first.', 400, 'NO_DONOR_PROFILE');
    await prisma.donorProfile.update({
      where: { userId: user.id },
      data: {
        ...(req.body.sex !== undefined && { sex: req.body.sex }),
        ...(req.body.weightKg !== undefined && { weightKg: req.body.weightKg }),
      },
    });
    return view(await loadMine(user.id));
  }),
);

// Add a reason to wait (tattoo, illness, pregnancy...). The longer wait is kept.
router.post(
  '/me/deferral',
  requireAuth,
  validate(deferralSchema),
  wrap(async (req) => {
    const user = await loadMine(req.user!.userId);
    if (!user.donorProfile) throw new AppError('Add your blood group to your profile first.', 400, 'NO_DONOR_PROFILE');
    const key = req.body.reason as DeferralKey;
    const until = deferralEnds(key, req.body.date ? new Date(req.body.date) : new Date());
    const current = user.donorProfile.deferredUntil;
    const keepCurrent = current && current > until;
    await prisma.donorProfile.update({
      where: { userId: user.id },
      data: {
        ...(keepCurrent ? {} : { deferredUntil: until, deferralReason: key }),
        ...(DEFERRALS[key].permanent && { permanentlyDeferred: true }),
      },
    });
    await prisma.auditLog.create({
      data: { actorId: user.id, action: 'DONOR_DEFERRAL_ADDED', entityType: 'DonorProfile', entityId: user.donorProfile.id, details: JSON.stringify({ reason: key }) },
    }).catch(() => undefined);
    return view(await loadMine(user.id));
  }),
);

// Clear my reason to wait (it no longer applies, or it was a mistake)
router.delete(
  '/me/deferral',
  requireAuth,
  wrap(async (req) => {
    const user = await loadMine(req.user!.userId);
    if (!user.donorProfile) throw new AppError('Add your blood group to your profile first.', 400, 'NO_DONOR_PROFILE');
    await prisma.donorProfile.update({
      where: { userId: user.id },
      data: { deferredUntil: null, deferralReason: null, permanentlyDeferred: false },
    });
    return view(await loadMine(user.id));
  }),
);

export default router;
