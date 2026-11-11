import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/types.js';
import { DEFERRALS, RULES, ONGOING_UNTIL, PAUSE_DAYS, checkEligibility, deferralEnds, isPaused, type DeferralKey } from './eligibility.rules.js';

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

const pauseSchema = z.object({
  days: z
    .number()
    .nullable()
    .refine((d) => d === null || (PAUSE_DAYS as readonly number[]).includes(d), 'Choose how long to pause.'),
  reason: z.string().trim().max(80, 'Keep the note short (80 characters).').optional(),
});

const DAY = 24 * 60 * 60 * 1000;
const donationSchema = z.object({
  date: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), 'Enter the date you donated.')
    .refine((v) => new Date(v).getTime() <= Date.now() + DAY / 2, 'The date cannot be in the future.')
    .refine((v) => new Date(v).getTime() >= Date.now() - 366 * DAY, 'Only donations in the last 12 months can be added.'),
  place: z.string().trim().max(80, 'Keep the place short (80 characters).').optional(),
});
const confirmSchema = z.object({ donated: z.boolean() });

async function loadMine(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { donorProfile: true, donationRecords: { orderBy: { donatedOn: 'desc' }, take: 10 } },
  });
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
  const paused = p && isPaused(p);
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
    // "Pause my alerts": until a date, or until the donor turns alerts back on
    pause: {
      until: paused && p!.pausedUntil! < ONGOING_UNTIL ? p!.pausedUntil!.toISOString() : null,
      untilTurnedOn: Boolean(paused && p!.pausedUntil! >= ONGOING_UNTIL),
      active: Boolean(paused),
      reason: paused ? p!.pauseReason ?? null : null,
      options: PAUSE_DAYS,
    },
    // Recent donations, and any the family recorded that the donor still needs to confirm
    donations: user.donationRecords
      .filter((d) => d.status !== 'rejected')
      .map((d) => ({
        id: d.id,
        donatedOn: d.donatedOn.toISOString(),
        source: d.source,
        place: d.place,
        status: d.status,
      })),
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
    if (check.pause.active) throw new AppError('Your alerts are paused. Turn them back on first.', 400, 'PAUSED');
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

// Pause my alerts (travel, exams, unwell, family...). Ends by itself, or "until I turn it back on" (days: null).
router.post(
  '/me/pause',
  requireAuth,
  validate(pauseSchema),
  wrap(async (req) => {
    const user = await loadMine(req.user!.userId);
    if (!user.donorProfile) throw new AppError('Add your blood group to your profile first.', 400, 'NO_DONOR_PROFILE');
    const until = req.body.days === null ? ONGOING_UNTIL : new Date(Date.now() + req.body.days * DAY);
    await prisma.donorProfile.update({
      where: { userId: user.id },
      data: { pausedUntil: until, pauseReason: req.body.reason || null, onCallUntil: null },
    });
    return view(await loadMine(user.id));
  }),
);

router.delete(
  '/me/pause',
  requireAuth,
  wrap(async (req) => {
    const user = await loadMine(req.user!.userId);
    if (user.donorProfile) {
      await prisma.donorProfile.update({ where: { userId: user.id }, data: { pausedUntil: null, pauseReason: null } });
    }
    return view(await loadMine(user.id));
  }),
);

// "I donated" (at a blood bank, camp or hospital, outside Manvi Blood). Alerts pause until the donor can give again.
router.post(
  '/me/donations',
  requireAuth,
  validate(donationSchema),
  wrap(async (req) => {
    const user = await loadMine(req.user!.userId);
    const p = user.donorProfile;
    if (!p) throw new AppError('Add your blood group to your profile first.', 400, 'NO_DONOR_PROFILE');
    const donatedOn = new Date(req.body.date);
    const dup = await prisma.donationRecord.findFirst({
      where: { userId: user.id, status: { not: 'rejected' }, donatedOn: { gte: new Date(donatedOn.getTime() - 3 * DAY), lte: new Date(donatedOn.getTime() + 3 * DAY) } },
    });
    if (dup) throw new AppError('A donation around this date is already recorded.', 400, 'ALREADY_RECORDED');
    const newer = !p.lastDonationDate || donatedOn > p.lastDonationDate;
    await prisma.$transaction([
      prisma.donationRecord.create({
        data: { userId: user.id, donatedOn, source: 'self', place: req.body.place || null, status: 'confirmed', confirmedAt: new Date(), previousLastDonationDate: p.lastDonationDate },
      }),
      prisma.donorProfile.update({
        where: { userId: user.id },
        data: { totalDonations: { increment: 1 }, ...(newer && { lastDonationDate: donatedOn, onCallUntil: null }) },
      }),
    ]);
    return view(await loadMine(user.id));
  }),
);

// The family marked "donated": the donor confirms (yes) or says it is a mistake (no = undo).
router.post(
  '/me/donations/:id/confirm',
  requireAuth,
  validate(confirmSchema),
  wrap(async (req) => {
    const user = await loadMine(req.user!.userId);
    const rec = await prisma.donationRecord.findUnique({ where: { id: req.params.id } });
    if (!rec || rec.userId !== user.id) throw new AppError('Donation not found.', 404, 'NOT_FOUND');
    if (rec.status !== 'pending_donor') throw new AppError('You have already answered this.', 400, 'ALREADY_ANSWERED');
    if (req.body.donated) {
      await prisma.donationRecord.update({ where: { id: rec.id }, data: { status: 'confirmed', confirmedAt: new Date() } });
    } else {
      const p = user.donorProfile;
      // Undo only if this donation is still the latest one on the profile
      const isLatest = p?.lastDonationDate && Math.abs(p.lastDonationDate.getTime() - rec.donatedOn.getTime()) < 60 * 1000;
      await prisma.$transaction([
        prisma.donationRecord.update({ where: { id: rec.id }, data: { status: 'rejected', confirmedAt: new Date() } }),
        prisma.donorProfile.update({
          where: { userId: user.id },
          data: {
            totalDonations: Math.max(0, (p?.totalDonations ?? 1) - 1),
            ...(isLatest && { lastDonationDate: rec.previousLastDonationDate }),
          },
        }),
        prisma.auditLog.create({
          data: {
            actorId: user.id,
            action: 'DONATION_DISPUTED',
            entityType: 'BloodRequest',
            entityId: rec.requestId || rec.id,
            details: JSON.stringify({ donationRecordId: rec.id }),
          },
        }),
      ]);
    }
    return view(await loadMine(user.id));
  }),
);

export default router;
