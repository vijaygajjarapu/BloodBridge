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

/** How long a donor can be "on call" at a time (hours) */
export const ON_CALL_HOURS = [12, 24, 72, 168] as const;
const onCallSchema = z.object({
  hours: z.number().refine((h) => (ON_CALL_HOURS as readonly number[]).includes(h), 'Choose how long you are on call.'),
});

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
    onCall: {
      until: p?.onCallUntil && p.onCallUntil > new Date() ? p.onCallUntil.toISOString() : null,
      options: ON_CALL_HOURS,
    },
    bloodGroupVerified: p?.bloodGroupVerifiedAt
      ? { at: p.bloodGroupVerifiedAt.toISOString(), source: p.bloodGroupVerifySource ?? null }
      : null,
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
        onCallUntil: null,
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

// On call: "contact me first" for 12 hours to 7 days. Only when available and able to donate now.
router.post(
  '/me/on-call',
  requireAuth,
  validate(onCallSchema),
  wrap(async (req) => {
    const user = await loadMine(req.user!.userId);
    const p = user.donorProfile;
    if (!p) throw new AppError('Add your blood group to your profile first.', 400, 'NO_DONOR_PROFILE');
    const check = view(user);
    if (!check.eligible) {
      throw new AppError(`You can go on call once you can donate again. ${check.reasons[0] || ''}`.trim(), 400, 'NOT_ELIGIBLE');
    }
    const until = new Date(Date.now() + req.body.hours * 60 * 60 * 1000);
    await prisma.donorProfile.update({ where: { userId: user.id }, data: { onCallUntil: until, isAvailable: true } });
    return view(await loadMine(user.id));
  }),
);

router.delete(
  '/me/on-call',
  requireAuth,
  wrap(async (req) => {
    const user = await loadMine(req.user!.userId);
    if (user.donorProfile) await prisma.donorProfile.update({ where: { userId: user.id }, data: { onCallUntil: null } });
    return view(await loadMine(user.id));
  }),
);

export default router;
