import crypto from 'crypto';
import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/types.js';
import { logger } from '../../shared/logger.js';
import { validateLocation, formatPhone } from '../../shared/location.js';
import { isValidPostalCode } from '../../../../shared/countries.js';
import { rememberHospital, suggestHospitals } from './hospitals.js';
import { emitToUser } from '../../sockets/socket.server.js';
import { subscriptionService } from '../subscriptions/subscriptions.service.js';
import { familyService } from '../family/family.service.js';
import { assessNewRequest, applyRisk, parseFlags, riskLevel } from './fraud.service.js';
import { canBeAlerted, checkEligibility } from '../eligibility/eligibility.rules.js';
import { scoreDonor, waveSize, waveIntervalMinutes, MANUAL_WAVE_COOLDOWN_MINUTES } from './matching.js';
import { communityService } from '../communities/communities.service.js';
import { outreachService } from '../outreach/outreach.service.js';
import { organisationService } from '../organisations/organisations.service.js';
import { remoteDonationService } from '../remote/remote.service.js';

export const BLOOD_GROUPS = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'] as const;
export const COMPONENTS = ['whole_blood', 'red_cells', 'platelets', 'plasma'] as const;
export const URGENCIES = ['critical', 'urgent', 'planned'] as const;

/**
 * The 10 request statuses. The verification track (verificationStatus) and the admin hold (onHold)
 * are kept separate from these, as decided in CONF-001.
 */
export const BLOOD_REQUEST_STATUSES = [
  'submitted', // just created
  'open', // live, no matching donors found nearby yet
  'donors_notified', // matching donors were alerted
  'donor_found', // at least one donor accepted
  'in_progress', // donation is happening
  'partially_fulfilled', // some units received
  'fulfilled', // all units received
  'cancelled', // requester (or a rejected verification) cancelled it
  'expired', // the "needed by" time passed
  'closed', // final, read-only
] as const;
export type RequestStatus = (typeof BLOOD_REQUEST_STATUSES)[number];

/** Which status can follow which */
const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  submitted: ['open', 'donors_notified', 'cancelled'],
  open: ['donors_notified', 'donor_found', 'cancelled', 'expired'],
  donors_notified: ['donor_found', 'cancelled', 'expired'],
  donor_found: ['in_progress', 'partially_fulfilled', 'fulfilled', 'cancelled', 'expired'],
  in_progress: ['partially_fulfilled', 'fulfilled', 'cancelled'],
  partially_fulfilled: ['in_progress', 'fulfilled', 'cancelled', 'closed'],
  fulfilled: ['closed'],
  cancelled: ['closed'],
  expired: ['closed'],
  closed: [],
};

/** Statuses the requester may set by hand (the others are set by the system) */
const REQUESTER_SETTABLE: RequestStatus[] = ['in_progress', 'partially_fulfilled', 'fulfilled', 'cancelled', 'closed'];

/** Statuses in which donors can still respond */
const LIVE: RequestStatus[] = ['submitted', 'open', 'donors_notified', 'donor_found', 'in_progress', 'partially_fulfilled'];

/**
 * Verification track: which verification states may sit with which request statuses (allowed-pairs table).
 * A rejected request can only be cancelled or closed.
 */
const ALLOWED_PAIRS: Record<string, RequestStatus[]> = {
  unverified: [...BLOOD_REQUEST_STATUSES],
  pending_review: [...BLOOD_REQUEST_STATUSES],
  verified: [...BLOOD_REQUEST_STATUSES],
  rejected: ['cancelled', 'closed'],
};

/** Red-cell compatibility: which donor groups can give to each patient group */
const COMPATIBLE_DONORS: Record<string, string[]> = {
  'O-': ['O-'],
  'O+': ['O+', 'O-'],
  'A-': ['A-', 'O-'],
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
};

/** Who may be alerted now: age, weight, gap between donations (men 90 / women 120 days) and reasons to wait */
const ELIGIBILITY_FIELDS = {
  lastDonationDate: true,
  totalDonations: true,
  sex: true,
  weightKg: true,
  deferredUntil: true,
  deferralReason: true,
  permanentlyDeferred: true,
  onCallUntil: true,
  bloodGroupVerifiedAt: true,
  pausedUntil: true,
  user: { select: { dateOfBirth: true } },
} as const;
const MAX_LIVE_REQUESTS = 3;
const MAX_ALERTS_PER_REQUEST = 200;

const firstName = (name?: string | null) => (name || 'A donor').trim().split(/\s+/)[0];

/** JSON list of ids stored on a request ("[]" / null / broken = none) */
function parseIdList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function newPublicCode() {
  return 'REQ-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function canDonateNow(p: {
  lastDonationDate: Date | null;
  totalDonations: number;
  sex: string | null;
  weightKg: number | null;
  deferredUntil: Date | null;
  deferralReason: string | null;
  permanentlyDeferred: boolean;
  pausedUntil?: Date | null;
  user: { dateOfBirth: Date | null };
}) {
  return canBeAlerted({ ...p, dateOfBirth: p.user.dateOfBirth });
}

function assertPair(verificationStatus: string, status: RequestStatus) {
  if (!(ALLOWED_PAIRS[verificationStatus] || []).includes(status)) {
    throw new AppError('This change is not allowed while the request is rejected by our team.', 409, 'CONFLICT');
  }
}

export interface CreateRequestInput {
  patientName: string;
  bloodGroup: string;
  component?: string;
  unitsNeeded: number;
  hospitalName: string;
  hospitalArea?: string;
  hospitalPinCode?: string;
  country?: string;
  state: string;
  district: string;
  city: string;
  urgency: string;
  neededBy?: string | null;
  notes?: string;
  alertCommunityIds?: string[];
  shareNumberInAlerts?: boolean;
  /** Requester's organisations whose colleagues should be alerted (only offered to members) */
  alertOrgIds?: string[];
  /** Also ask colleagues in other cities to donate at a partner blood bank (replacement) */
  askRemoteReplacement?: boolean;
}

export class RequestService {

  compatibleDonorGroups(patientGroup: string) {
    return COMPATIBLE_DONORS[patientGroup] || [patientGroup];
  }

  /** A request whose "needed by" time passed more than a day ago becomes expired */
  private async expireIfDue(req: { id: string; status: string; neededBy: Date | null }) {
    if (!req.neededBy || !LIVE.includes(req.status as RequestStatus)) return req.status;
    if (req.status === 'in_progress' || req.status === 'partially_fulfilled') return req.status;
    if (Date.now() - req.neededBy.getTime() > 24 * 60 * 60 * 1000) {
      await prisma.bloodRequest.update({ where: { id: req.id }, data: { status: 'expired' } });
      return 'expired';
    }
    return req.status;
  }

  /** Donors who can receive an alert for this request (same district, compatible, available, can donate now) */
  private async findMatchingDonors(r: {
    requesterUserId: string;
    bloodGroup: string;
    country: string;
    state: string;
    district: string;
    hospitalPinCode?: string | null;
  }) {
    const profiles = await prisma.donorProfile.findMany({
      where: {
        country: r.country,
        // Donors in the hospital's district, plus donors living in the hospital's PIN code area
        OR: [
          { state: r.state, district: r.district },
          ...(r.hospitalPinCode ? [{ postalCode: r.hospitalPinCode }] : []),
        ],
        bloodGroup: { in: this.compatibleDonorGroups(r.bloodGroup) },
        isAvailable: true,
        // Donor chose to be reachable for public requests near them
        reachRegular: true,
        userId: { not: r.requesterUserId },
        user: { status: 'active', isEmailVerified: true },
      },
      select: {
        userId: true,
        postalCode: true,
        city: true,
        ...ELIGIBILITY_FIELDS,
        user: { select: { dateOfBirth: true, lastActiveAt: true } },
      },
      take: 1000,
    });
    return profiles.filter((p) => canDonateNow(p));
  }

  /**
   * Family & Allies: donors who pledged for this family and allowed "send me this family's emergency requests"
   * get the alert wherever they live (only for compatible groups).
   */
  private async findFamilyAllies(requesterUserId: string, patientGroup: string) {
    // The saved donor list (people who pledged to this family, incl. referred donors) is a subscriber feature
    if (!(await subscriptionService.isActive(requesterUserId))) return [];
    await familyService.syncReferredDonors(requesterUserId).catch(() => undefined);
    const pledges = await prisma.bloodPledge.findMany({
      where: {
        ownerUserId: requesterUserId,
        status: 'active',
        allowRequestAlerts: true,
        donor: { status: 'active' },
      },
      select: {
        donorUserId: true,
        bloodGroup: true,
        donor: { select: { donorProfile: { select: { bloodGroup: true, ...ELIGIBILITY_FIELDS } } } },
      },
    });
    const ok = this.compatibleDonorGroups(patientGroup);
    return pledges
      .filter((p) => ok.includes(p.donor.donorProfile?.bloodGroup || p.bloodGroup))
      // Saved donors are alerted wherever they live, but only if they can donate right now
      .filter((p) => !p.donor.donorProfile || canDonateNow(p.donor.donorProfile))
      .map((p) => p.donorUserId);
  }

  async create(userId: string, input: CreateRequestInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('Account not found.', 404, 'NOT_FOUND');
    if (!user.isEmailVerified) {
      throw new AppError('Please verify your email before posting a blood request.', 403, 'EMAIL_NOT_VERIFIED');
    }
    if (!user.phone) {
      throw new AppError('Add your mobile number to your profile first. Donors who accept will call you on it.', 400, 'PHONE_REQUIRED');
    }

    const live = await prisma.bloodRequest.count({
      where: { requesterUserId: userId, status: { in: LIVE } },
    });
    if (live >= MAX_LIVE_REQUESTS) {
      throw new AppError(
        `You already have ${live} active requests. Please close or cancel one before posting another.`,
        429,
        'TOO_MANY_REQUESTS',
      );
    }

    const loc = validateLocation({
      country: input.country || user.country,
      state: input.state,
      district: input.district,
      city: input.city,
    }, { requireCity: true });

    const hospitalPinCode = (input.hospitalPinCode || '').trim() || null;
    if (hospitalPinCode && !isValidPostalCode(loc.country, hospitalPinCode)) {
      throw new AppError('Please enter a valid 6-digit PIN code.', 400, 'VALIDATION_FAILED', { hospitalPinCode: 'Please enter a valid 6-digit PIN code.' });
    }

    let neededBy: Date | null = null;
    if (input.neededBy) {
      neededBy = new Date(input.neededBy);
      if (isNaN(neededBy.getTime())) {
        throw new AppError('Please enter a valid date and time.', 400, 'VALIDATION_FAILED', { neededBy: 'Please enter a valid date and time.' });
      }
      if (neededBy.getTime() < Date.now() - 60 * 60 * 1000) {
        throw new AppError('"Needed by" cannot be in the past.', 400, 'VALIDATION_FAILED', { neededBy: '"Needed by" cannot be in the past.' });
      }
    }

    const alertCommunityIds = await communityService.cleanChosenIds(input.alertCommunityIds, { country: loc.country, state: loc.state });
    const alertOrgIds = await organisationService.cleanAlertOrgIds(userId, input.alertOrgIds);

    let publicCode = newPublicCode();
    while (await prisma.bloodRequest.findUnique({ where: { publicCode } })) publicCode = newPublicCode();

    const request = await prisma.bloodRequest.create({
      data: {
        publicCode,
        requesterUserId: userId,
        patientName: input.patientName.trim(),
        bloodGroup: input.bloodGroup,
        component: input.component || 'whole_blood',
        unitsNeeded: input.unitsNeeded,
        hospitalName: input.hospitalName.trim(),
        hospitalArea: input.hospitalArea?.trim() || null,
        hospitalPinCode,
        country: loc.country,
        state: loc.state,
        district: loc.district,
        city: loc.city,
        urgency: input.urgency,
        neededBy,
        notes: input.notes?.trim() || null,
        contactPhone: user.phone,
        status: 'submitted',
        alertCommunityIds: alertCommunityIds.length ? JSON.stringify(alertCommunityIds) : null,
        shareNumberInAlerts: Boolean(input.shareNumberInAlerts),
        alertOrgIds: alertOrgIds.length ? JSON.stringify(alertOrgIds) : null,
        askRemoteReplacement: Boolean(alertOrgIds.length && input.askRemoteReplacement),
      },
    });

    // Grow the hospital list used for suggestions
    const hospitalKnown = await rememberHospital({
      name: request.hospitalName,
      area: request.hospitalArea,
      city: request.city,
      district: request.district,
      state: request.state,
      country: request.country,
      pinCode: request.hospitalPinCode,
    }).catch(() => true);

    // Fraud checks: warning signs -> under review / held before any donor is alerted
    const flags = await assessNewRequest({
      requesterUserId: userId,
      requestId: request.id,
      patientName: request.patientName,
      notes: request.notes,
      hospitalName: request.hospitalName,
      hospitalArea: request.hospitalArea,
      hospitalPinCode: request.hospitalPinCode,
      district: request.district,
      state: request.state,
      country: request.country,
      unitsNeeded: request.unitsNeeded,
      urgency: request.urgency,
      hospitalKnown: Boolean(hospitalKnown),
    });
    if (flags.length) await applyRisk(request.id, flags, 'New request');

    const { total: notified, savedDonors: savedDonorsAlerted } = await this.notifyDonors(request.id);
    // Colleagues in other cities: "donate at a partner blood bank in your city" (replacement), if the family asked
    if (request.askRemoteReplacement && !request.onHold) {
      const colleagues = await organisationService.colleagueIds(userId, alertOrgIds);
      await remoteDonationService.askColleaguesElsewhere(request, colleagues).catch((err) => logger.error(`Remote ask failed: ${err?.message}`));
    }
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'BLOOD_REQUEST_CREATED',
        entityType: 'BloodRequest',
        entityId: request.id,
        details: JSON.stringify({ bloodGroup: request.bloodGroup, district: request.district, notified, savedDonorsAlerted }),
      },
    });
    return { ...(await this.getForRequester(userId, request.id)), savedDonorsAlerted };
  }

  /**
   * Smart matching, step 1: rank every donor who can help (compatible, available, eligible now) and store the list.
   * Donors already on the list keep their place and status; new donors (for example someone who just became eligible) are added.
   */
  async rankCandidates(requestId: string) {
    const r = await prisma.bloodRequest.findUnique({ where: { id: requestId } });
    if (!r) return { added: 0 };
    const [nearby, allies, communityOnlyIds, colleagueAll, existing, links] = await Promise.all([
      this.findMatchingDonors(r),
      this.findFamilyAllies(r.requesterUserId, r.bloodGroup),
      communityService.donorIdsForRequest(r.requesterUserId, parseIdList(r.alertCommunityIds)).catch(() => [] as string[]),
      organisationService.colleagueIds(r.requesterUserId, parseIdList(r.alertOrgIds)).catch(() => [] as string[]),
      prisma.requestCandidate.findMany({ where: { requestId }, select: { donorUserId: true } }),
      prisma.referral.findMany({
        where: {
          OR: [
            { referrerUserId: r.requesterUserId, referredUserId: { not: null } },
            { referredUserId: r.requesterUserId },
          ],
        },
        select: { referrerUserId: true, referredUserId: true },
      }),
    ]);
    const known = new Set(links.flatMap((l) => [l.referrerUserId, l.referredUserId]).filter(Boolean) as string[]);
    const already = new Set(existing.map((e) => e.donorUserId));

    // Family donors may live anywhere: load their details too
    const allyIds = allies.filter((id) => !nearby.some((n) => n.userId === id));
    const allyProfiles = allyIds.length
      ? await prisma.donorProfile.findMany({
          where: { userId: { in: allyIds } },
          select: { userId: true, postalCode: true, city: true, ...ELIGIBILITY_FIELDS, user: { select: { dateOfBirth: true, lastActiveAt: true } } },
        })
      : [];
    // Community donors may also live outside the district (fellow members who asked to be alerted):
    // same checks as nearby donors (compatible group, available, verified, can donate now)
    // Colleagues are alerted like community members, but only those in the hospital's state (others can donate remotely)
    const colleagueNear = colleagueAll.length
      ? (await prisma.donorProfile.findMany({ where: { userId: { in: colleagueAll }, state: r.state }, select: { userId: true } })).map((p) => p.userId)
      : [];
    const colleagueSet = new Set(colleagueNear);
    const communityIds = [...new Set([...communityOnlyIds, ...colleagueNear])];
    const communitySet = new Set(communityOnlyIds);
    const extraCommunityIds = communityIds.filter((id) => !nearby.some((n) => n.userId === id) && !allyIds.includes(id));
    const communityProfiles = extraCommunityIds.length
      ? (
          await prisma.donorProfile.findMany({
            where: {
              userId: { in: extraCommunityIds },
              bloodGroup: { in: this.compatibleDonorGroups(r.bloodGroup) },
              isAvailable: true,
              user: { status: 'active', isEmailVerified: true },
            },
            select: { userId: true, postalCode: true, city: true, ...ELIGIBILITY_FIELDS, user: { select: { dateOfBirth: true, lastActiveAt: true } } },
          })
        ).filter((p) => canDonateNow(p))
      : [];
    const pool = [...nearby, ...allyProfiles, ...communityProfiles].filter((p) => p.userId !== r.requesterUserId && !already.has(p.userId));
    if (!pool.length) return { added: 0 };

    const ids = pool.map((p) => p.userId);
    const [alertCounts, acceptCounts] = await Promise.all([
      prisma.notification.groupBy({
        by: ['recipientId'],
        where: { recipientId: { in: ids }, notificationType: 'emergency_request' },
        _count: { _all: true },
      }),
      prisma.requestResponse.groupBy({
        by: ['donorUserId'],
        where: { donorUserId: { in: ids }, status: { in: ['accepted', 'donated'] } },
        _count: { _all: true },
      }),
    ]);
    const alertsOf = new Map(alertCounts.map((a) => [a.recipientId, a._count._all]));
    const acceptsOf = new Map(acceptCounts.map((a) => [a.donorUserId, a._count._all]));
    const cityOf = (s?: string | null) => (s || '').trim().toLowerCase();

    const scored = pool.map((p) => {
      const isFamily = allies.includes(p.userId);
      const { score, reasons } = scoreDonor({
        samePin: Boolean(r.hospitalPinCode && p.postalCode === r.hospitalPinCode),
        sameCity: Boolean(cityOf(p.city) && cityOf(p.city) === cityOf(r.city)),
        isFamily,
        knowsRequester: known.has(p.userId),
        community: communitySet.has(p.userId),
        colleague: colleagueSet.has(p.userId),
        onCall: Boolean(p.onCallUntil && p.onCallUntil > new Date()),
        verified: Boolean(p.bloodGroupVerifiedAt),
        alertsReceived: alertsOf.get(p.userId) || 0,
        accepted: acceptsOf.get(p.userId) || 0,
        totalDonations: p.totalDonations,
        lastActiveAt: p.user.lastActiveAt,
      });
      return { donorUserId: p.userId, score, reasons, source: isFamily ? 'family' : colleagueSet.has(p.userId) ? 'colleague' : communitySet.has(p.userId) ? 'community' : 'nearby' };
    });

    const room = Math.max(0, MAX_ALERTS_PER_REQUEST - already.size);
    const toAdd = scored.sort((a, b) => b.score - a.score).slice(0, room);
    for (const c of toAdd) {
      await prisma.requestCandidate.create({
        data: { requestId, donorUserId: c.donorUserId, score: c.score, rank: 0, reasons: JSON.stringify(c.reasons), source: c.source },
      }).catch(() => undefined); // already added by a parallel run
    }

    // Re-number the queue: family first, then by score
    const queue = await prisma.requestCandidate.findMany({ where: { requestId }, orderBy: [{ score: 'desc' }, { createdAt: 'asc' }] });
    const ordered = [...queue.filter((q) => q.source === 'family'), ...queue.filter((q) => q.source !== 'family')];
    for (let i = 0; i < ordered.length; i++) {
      if (ordered[i].rank !== i + 1) await prisma.requestCandidate.update({ where: { id: ordered[i].id }, data: { rank: i + 1 } });
    }
    return { added: toAdd.length };
  }

  /** Accepted donors still needed for this request */
  private async unitsStillNeeded(r: { id: string; unitsNeeded: number; unitsFulfilled: number }) {
    const accepted = await prisma.requestResponse.count({ where: { requestId: r.id, status: { in: ['accepted', 'donated'] } } });
    return Math.max(0, r.unitsNeeded - Math.max(accepted, r.unitsFulfilled));
  }

  /**
   * Smart matching, step 2: contact the next group of ranked donors.
   * Wave 1 = every family donor + the top 5; wave 2 = next 10; then 20 at a time.
   * The next wave is scheduled automatically (10 / 20 / 60 minutes for critical / urgent / planned)
   * and is skipped once enough donors have accepted.
   */
  async sendWave(requestId: string) {
    const r = await prisma.bloodRequest.findUnique({ where: { id: requestId } });
    if (!r || r.onHold || r.verificationStatus === 'rejected' || !LIVE.includes(r.status as RequestStatus)) return { total: 0, savedDonors: 0 };

    const needed = await this.unitsStillNeeded(r);
    if (needed === 0) {
      await prisma.bloodRequest.update({ where: { id: r.id }, data: { nextWaveAt: null } });
      return { total: 0, savedDonors: 0 };
    }

    const wave = r.waveNumber + 1;
    const queued = await prisma.requestCandidate.findMany({ where: { requestId, status: 'queued' }, orderBy: { rank: 'asc' } });
    const family = wave === 1 ? queued.filter((q) => q.source === 'family') : [];
    const others = queued.filter((q) => !family.includes(q)).slice(0, waveSize(wave));
    const batch = [...family, ...others];

    // Never alert the same person twice for one request (also covers alerts sent before smart matching existed)
    const alreadyNotified = await prisma.notification.findMany({
      where: { relatedEntity: `/app/requests/${r.id}`, notificationType: 'emergency_request' },
      select: { recipientId: true },
    });
    const skip = new Set(alreadyNotified.map((n) => n.recipientId));

    const urgencyWord = r.urgency === 'critical' ? 'URGENT: ' : '';
    // The family chose to show their number in alerts, so a donor who misses the alert can still call back
    const familyNumber = r.shareNumberInAlerts
      ? ` Family's number: ${formatPhone(r.contactPhone, r.country)}.`
      : '';
    const place = [r.hospitalName, r.hospitalArea, r.city].filter(Boolean).join(', ') + (r.hospitalPinCode ? ` (PIN ${r.hospitalPinCode})` : '');
    let sent = 0;
    for (const c of batch) {
      await prisma.requestCandidate.update({ where: { id: c.id }, data: { status: 'alerted', wave, alertedAt: new Date() } });
      if (skip.has(c.donorUserId)) continue;
      const recipientId = c.donorUserId;
      const isAlly = c.source === 'family';
      sent++;
      await prisma.notification.create({
        data: {
          recipientId,
          notificationType: 'emergency_request',
          title: `${urgencyWord}${r.bloodGroup} blood needed in ${r.city}`,
          message: (isAlly
            ? `Someone you pledged to help needs ${r.unitsNeeded} unit(s) of ${r.bloodGroup} at ${place}. Can you donate?`
            : c.source === 'colleague'
            ? `A colleague's family needs ${r.unitsNeeded} unit(s) of ${r.bloodGroup} at ${place}. Can you donate? (You can turn off company alerts on your profile.) Donating is always free: never pay anyone.`
            : c.source === 'community'
            ? `${r.unitsNeeded} unit(s) of ${r.bloodGroup} needed at ${place}. You get this because of a community you joined (you can mute it in Communities). Can you donate? Donating is always free: never pay anyone.`
            : `${r.unitsNeeded} unit(s) of ${r.bloodGroup} needed at ${place}. You are a matching donor nearby. Can you donate? Donating is always free: never pay anyone.`
          ) + familyNumber,
          relatedEntity: `/app/requests/${r.id}`,
        },
      });
      emitToUser(recipientId, 'notification:new', { type: 'emergency_request', requestId: r.id });
      // SMS with a one-tap link / automatic call for critical requests (only when switched on, and never in quiet hours)
      outreachService.alertOutsideApp(c.id).catch((err) => logger.error(`Outside-app alert failed: ${err?.message}`));
    }

    const remaining = await prisma.requestCandidate.count({ where: { requestId, status: 'queued' } });
    const total = r.donorsNotified + sent;
    let status = r.status as RequestStatus;
    if (status === 'submitted') status = total > 0 ? 'donors_notified' : 'open';
    else if (status === 'open' && sent > 0) status = 'donors_notified';
    await prisma.bloodRequest.update({
      where: { id: r.id },
      data: {
        donorsNotified: total,
        status,
        waveNumber: batch.length ? wave : r.waveNumber,
        // Check again later even when nobody is queued: new donors may become eligible or available
        nextWaveAt: new Date(Date.now() + waveIntervalMinutes(r.urgency) * 60 * 1000),
      },
    });
    logger.info(`Blood request ${r.publicCode}: wave ${wave}, alerted ${sent} donor(s), ${remaining} waiting`);
    return { total: sent, savedDonors: batch.filter((c) => c.source === 'family').length };
  }

  /** Rank donors and, for a new request, contact the first wave */
  async notifyDonors(requestId: string) {
    await this.rankCandidates(requestId);
    const r = await prisma.bloodRequest.findUnique({ where: { id: requestId }, select: { waveNumber: true } });
    if (!r) return { total: 0, savedDonors: 0 };
    if (r.waveNumber === 0) return this.sendWave(requestId);
    return { total: 0, savedDonors: 0 };
  }

  /** Background job (every minute): send the next wave for requests that still need donors */
  async runDueWaves(now = new Date()) {
    const due = await prisma.bloodRequest.findMany({
      where: { nextWaveAt: { lte: now }, status: { in: LIVE }, onHold: false, verificationStatus: { not: 'rejected' } },
      select: { id: true, neededBy: true, status: true },
      take: 50,
    });
    let waves = 0;
    for (const r of due) {
      const status = await this.expireIfDue(r);
      if (!LIVE.includes(status as RequestStatus)) {
        await prisma.bloodRequest.update({ where: { id: r.id }, data: { nextWaveAt: null } });
        continue;
      }
      await this.rankCandidates(r.id);
      const res = await this.sendWave(r.id);
      if (res.total > 0) waves++;
    }
    return { checked: due.length, waves };
  }

  /** Requester: "Alert more donors now" (contacts the next group without waiting) */
  async alertMoreNow(userId: string, id: string) {
    const r = await prisma.bloodRequest.findUnique({ where: { id } });
    if (!r || r.requesterUserId !== userId) throw new AppError('Request not found.', 404, 'NOT_FOUND');
    if (r.onHold) throw new AppError('This request is paused while our team reviews it.', 400, 'ON_HOLD');
    if (!LIVE.includes(r.status as RequestStatus)) throw new AppError('This request is no longer active.', 400, 'NOT_ACTIVE');
    if (r.lastManualWaveAt && Date.now() - r.lastManualWaveAt.getTime() < MANUAL_WAVE_COOLDOWN_MINUTES * 60 * 1000) {
      throw new AppError(`Please wait ${MANUAL_WAVE_COOLDOWN_MINUTES} minutes between alerts so donors have time to answer.`, 429, 'TOO_SOON');
    }
    await this.rankCandidates(id);
    const queued = await prisma.requestCandidate.count({ where: { requestId: id, status: 'queued' } });
    if (!queued) throw new AppError('Every matching donor has already been contacted. We will keep checking for new donors.', 400, 'NO_MORE_DONORS');
    await prisma.bloodRequest.update({ where: { id }, data: { lastManualWaveAt: new Date() } });
    await this.sendWave(id);
    return this.getForRequester(userId, id);
  }

  /** Live progress for the requester: counts only, never who */
  private async matchingSummary(r: { id: string; waveNumber: number; nextWaveAt: Date | null; status: string }) {
    const rows = await prisma.requestCandidate.groupBy({ by: ['status'], where: { requestId: r.id }, _count: { _all: true } });
    const n = (s: string) => rows.find((x) => x.status === s)?._count._all || 0;
    const contacted = n('alerted') + n('viewed') + n('accepted') + n('declined') + n('withdrawn');
    return {
      wave: r.waveNumber,
      contacted,
      viewed: n('viewed') + n('accepted') + n('declined'),
      accepted: n('accepted'),
      declined: n('declined'),
      fromCommunities: await prisma.requestCandidate.count({ where: { requestId: r.id, source: 'community', status: { not: 'queued' } } }),
      waiting: n('queued'),
      nextWaveAt: LIVE.includes(r.status as RequestStatus) && n('queued') > 0 ? r.nextWaveAt?.toISOString() ?? null : null,
    };
  }

  /** Counts only (no donor cards): how many matching donors are in an area */
  async donorCounts(q: { bloodGroup: string; country?: string; state: string; district?: string }) {
    const country = (q.country || 'IN').toUpperCase();
    const compatible = this.compatibleDonorGroups(q.bloodGroup);
    const area = { country, state: q.state, ...(q.district ? { district: q.district } : {}) };
    const base = { reachRegular: true, user: { status: 'active', isEmailVerified: true } } as const;

    const [exact, compatibleRows] = await Promise.all([
      prisma.donorProfile.count({ where: { ...area, ...base, bloodGroup: q.bloodGroup } }),
      prisma.donorProfile.findMany({
        where: { ...area, ...base, bloodGroup: { in: compatible } },
        select: { isAvailable: true, ...ELIGIBILITY_FIELDS },
      }),
    ]);
    const availableNow = compatibleRows.filter((p) => p.isAvailable && canDonateNow(p)).length;
    return {
      bloodGroup: q.bloodGroup,
      area: { country, state: q.state, district: q.district || null },
      exactMatch: exact,
      compatible: compatibleRows.length,
      availableNow,
      compatibleGroups: compatible,
    };
  }

  private serialize(
    r: any,
    view: 'requester' | 'donor' | 'admin',
    extra: Record<string, unknown> = {},
  ) {
    const base = {
      id: r.id,
      publicCode: r.publicCode,
      bloodGroup: r.bloodGroup,
      component: r.component,
      unitsNeeded: r.unitsNeeded,
      unitsFulfilled: r.unitsFulfilled,
      hospitalName: r.hospitalName,
      hospitalArea: r.hospitalArea,
      hospitalPinCode: r.hospitalPinCode,
      country: r.country,
      state: r.state,
      district: r.district,
      city: r.city,
      urgency: r.urgency,
      neededBy: r.neededBy?.toISOString() || null,
      notes: r.notes,
      status: r.status,
      verificationStatus: r.verificationStatus,
      onHold: r.onHold,
      holdReason: view === 'donor' ? null : r.holdReason,
      donorsNotified: r.donorsNotified,
      documentStatus: r.documentStatus,
      // Fraud details only for our team
      ...(view === 'admin'
        ? { riskScore: r.riskScore, riskLevel: riskLevel(r.riskScore), riskFlags: parseFlags(r.riskFlags), reportCount: r.reportCount }
        : {}),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      allowedNextStatuses:
        view === 'requester'
          ? TRANSITIONS[r.status as RequestStatus].filter(
              (s) => REQUESTER_SETTABLE.includes(s) && (ALLOWED_PAIRS[r.verificationStatus] || []).includes(s),
            )
          : [],
    };
    return { ...base, ...extra };
  }

  async listMine(userId: string) {
    const rows = await prisma.bloodRequest.findMany({
      where: { requesterUserId: userId },
      include: { _count: { select: { responses: { where: { status: { in: ['accepted', 'donated'] } } } } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    for (const r of rows) r.status = await this.expireIfDue(r);
    return rows.map((r) =>
      this.serialize(r, 'requester', { patientName: r.patientName, acceptedCount: r._count.responses }),
    );
  }

  /** Requester view: includes donors who accepted. Donor phones stay hidden unless the donor chose to share. */
  async getForRequester(userId: string, id: string) {
    const r = await prisma.bloodRequest.findUnique({
      where: { id },
      include: {
        responses: {
          where: { status: { in: ['accepted', 'donated'] } },
          include: {
            donor: {
              select: { fullName: true, username: true, phone: true, country: true, donorProfile: { select: { bloodGroup: true, bloodGroupVerifiedAt: true } } },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!r || r.requesterUserId !== userId) throw new AppError('Request not found.', 404, 'NOT_FOUND');
    r.status = await this.expireIfDue(r);
    const matching = await this.matchingSummary(r);
    return this.serialize(r, 'requester', {
      patientName: r.patientName,
      isRequester: true,
      matching,
      shareNumberInAlerts: r.shareNumberInAlerts,
      colleaguesAlerted: parseIdList(r.alertOrgIds).length > 0,
      remote: await remoteDonationService.summary(r.id),
      // Call a donor through Manvi Blood (their number stays hidden)
      maskedCallAvailable: outreachService.status().maskedCalls,
      responses: r.responses.map((x) => ({
        id: x.id,
        donorFirstName: firstName(x.donor.fullName || x.donor.username),
        donorBloodGroup: x.donor.donorProfile?.bloodGroup || null,
        donorBloodGroupVerified: Boolean(x.donor.donorProfile?.bloodGroupVerifiedAt),
        status: x.status,
        // Phone privacy: hidden by default; shown only if this donor opted in for this request
        phone: x.shareDirectNumber ? formatPhone(x.donor.phone, x.donor.country) : null,
        phoneHidden: !x.shareDirectNumber,
        respondedAt: x.createdAt.toISOString(),
      })),
    });
  }

  /** Can this person respond as a donor? */
  private async donorEligibility(userId: string, r: { requesterUserId: string; bloodGroup: string; status: string; onHold: boolean; verificationStatus: string }) {
    if (r.requesterUserId === userId) return { canRespond: false, reason: 'This is your own request.' };
    const profile = await prisma.donorProfile.findUnique({ where: { userId } });
    if (!profile) return { canRespond: false, reason: 'Add your blood group to your profile to respond as a donor.' };
    if (!this.compatibleDonorGroups(r.bloodGroup).includes(profile.bloodGroup)) {
      return { canRespond: false, reason: `Your blood group (${profile.bloodGroup}) cannot be given to ${/^[AO]/.test(r.bloodGroup) ? 'an' : 'a'} ${r.bloodGroup} patient.` };
    }
    if (r.onHold) return { canRespond: false, reason: 'This request is paused while our team reviews it.' };
    if (r.verificationStatus === 'rejected') return { canRespond: false, reason: 'This request is no longer active.' };
    if (!LIVE.includes(r.status as RequestStatus)) return { canRespond: false, reason: 'This request is no longer accepting donors.' };
    return { canRespond: true, reason: null as string | null };
  }

  /** Donor view: hospital details always; the requester's number only after this donor accepted */
  async getForDonor(userId: string, id: string) {
    const r = await prisma.bloodRequest.findUnique({
      where: { id },
      include: { requester: { select: { fullName: true, username: true, country: true } } },
    });
    if (!r) throw new AppError('Request not found.', 404, 'NOT_FOUND');
    if (r.requesterUserId === userId) return this.getForRequester(userId, id);
    r.status = await this.expireIfDue(r);

    const [mine, eligibility] = await Promise.all([
      prisma.requestResponse.findUnique({ where: { requestId_donorUserId: { requestId: id, donorUserId: userId } } }),
      this.donorEligibility(userId, r),
    ]);
    // Live progress for the family: this contacted donor has opened the request
    await prisma.requestCandidate.updateMany({
      where: { requestId: id, donorUserId: userId, status: 'alerted' },
      data: { status: 'viewed', viewedAt: new Date() },
    });
    const accepted = mine && (mine.status === 'accepted' || mine.status === 'donated');
    return this.serialize(r, 'donor', {
      isRequester: false,
      requesterFirstName: firstName(r.requester.fullName || r.requester.username),
      myResponse: mine ? { status: mine.status, shareDirectNumber: mine.shareDirectNumber } : null,
      canRespond: eligibility.canRespond,
      cannotRespondReason: eligibility.reason,
      // Revealed after accepting, or straight away if the family chose to share it in alerts
      requesterPhone: accepted || r.shareNumberInAlerts ? formatPhone(r.contactPhone, r.requester.country) : null,
      maskedCallAvailable: Boolean(accepted) && outreachService.status().maskedCalls,
      // "Donate here, save a life there": offered when the donor lives in another district
      remote: await remoteDonationService.summary(r.id, userId),
      remoteOffered: await this.remoteOffered(userId, r),
    });
  }

  /** Offer "donate at a partner blood bank in your city" to donors far from the hospital, where such a bank exists */
  private async remoteOffered(userId: string, r: { district: string; state: string; status: string; onHold: boolean }) {
    if (!(LIVE as string[]).includes(r.status) || r.onHold) return false;
    const p = await prisma.donorProfile.findUnique({ where: { userId }, select: { district: true, state: true } });
    if (!p || !remoteDonationService.isFar(p, r)) return false;
    return (await prisma.partnerBloodBank.count({ where: { active: true, state: p.state } })) > 0;
  }

  async getById(userId: string, id: string) {
    return this.getForDonor(userId, id);
  }

  /** Open requests that match this donor (compatible group, same district), newest first */
  async listForDonor(userId: string) {
    const profile = await prisma.donorProfile.findUnique({ where: { userId } });
    if (!profile) return { hasProfile: false, items: [] };
    const recipientGroups = Object.entries(COMPATIBLE_DONORS)
      .filter(([, donors]) => donors.includes(profile.bloodGroup))
      .map(([patient]) => patient);
    const rows = await prisma.bloodRequest.findMany({
      where: {
        requesterUserId: { not: userId },
        status: { in: LIVE },
        onHold: false,
        verificationStatus: { not: 'rejected' },
        bloodGroup: { in: recipientGroups },
        OR: [
          { country: profile.country, state: profile.state, district: profile.district },
          ...(profile.postalCode ? [{ country: profile.country, hospitalPinCode: profile.postalCode }] : []),
          { responses: { some: { donorUserId: userId } } },
          // Family & Allies: requests from families I pledged to (with alerts allowed)
          { requester: { pledgesReceived: { some: { donorUserId: userId, status: 'active', allowRequestAlerts: true } } } },
        ],
      },
      include: { responses: { where: { donorUserId: userId }, select: { status: true } } },
      orderBy: [{ createdAt: 'desc' }],
      take: 50,
    });
    return {
      hasProfile: true,
      myBloodGroup: profile.bloodGroup,
      items: rows.map((r) => this.serialize(r, 'donor', { myResponse: r.responses[0]?.status || null })),
    };
  }

  /** Donor accepts or declines. Accepting reveals the requester's number to the donor. */
  async respond(userId: string, id: string, input: { action: 'accept' | 'decline' | 'withdraw'; shareDirectNumber?: boolean }) {
    const r = await prisma.bloodRequest.findUnique({ where: { id } });
    if (!r) throw new AppError('Request not found.', 404, 'NOT_FOUND');
    r.status = await this.expireIfDue(r);

    const existing = await prisma.requestResponse.findUnique({
      where: { requestId_donorUserId: { requestId: id, donorUserId: userId } },
    });

    if (input.action === 'withdraw') {
      if (!existing || existing.status !== 'accepted') {
        throw new AppError('You have not accepted this request.', 400, 'BAD_REQUEST');
      }
      await prisma.requestResponse.update({ where: { id: existing.id }, data: { status: 'withdrawn', shareDirectNumber: false } });
      await prisma.requestCandidate.updateMany({ where: { requestId: id, donorUserId: userId }, data: { status: 'withdrawn', respondedAt: new Date() } });
      // A place opened up again: contact the next donors within a minute
      await prisma.bloodRequest.update({ where: { id }, data: { nextWaveAt: new Date() } });
      await prisma.notification.create({
        data: {
          recipientId: r.requesterUserId,
          notificationType: 'request_update',
          title: 'A donor can no longer come',
          message: `A donor withdrew from your ${r.bloodGroup} request at ${r.hospitalName}. Other matching donors can still respond.`,
          relatedEntity: `/app/requests/${r.id}`,
        },
      });
      return this.getForDonor(userId, id);
    }

    const eligibility = await this.donorEligibility(userId, r);
    if (!eligibility.canRespond) throw new AppError(eligibility.reason || 'You cannot respond to this request.', 400, 'NOT_ELIGIBLE');
    if (input.action === 'accept') {
      // Medical self-check: age, weight, gap since last donation, reasons to wait
      const me = await prisma.donorProfile.findUnique({ where: { userId }, select: ELIGIBILITY_FIELDS });
      if (me) {
        const check = checkEligibility({ ...me, dateOfBirth: me.user.dateOfBirth });
        if (!check.eligible) {
          throw new AppError(`You can't donate right now. ${check.reasons[0]} You can still decline so the family knows.`, 400, 'NOT_ELIGIBLE');
        }
      }
    }
    if (existing?.status === 'donated') throw new AppError('Thank you, your donation is already recorded.', 400, 'BAD_REQUEST');

    const status = input.action === 'accept' ? 'accepted' : 'declined';
    const shareDirectNumber = input.action === 'accept' ? Boolean(input.shareDirectNumber) : false;
    await prisma.requestResponse.upsert({
      where: { requestId_donorUserId: { requestId: id, donorUserId: userId } },
      create: { requestId: id, donorUserId: userId, status, shareDirectNumber },
      update: { status, shareDirectNumber },
    });
    // Live progress + waves: record the answer; stop contacting more donors once enough have accepted
    const candidate = await prisma.requestCandidate.findUnique({ where: { requestId_donorUserId: { requestId: id, donorUserId: userId } } });
    if (candidate) {
      await prisma.requestCandidate.update({ where: { id: candidate.id }, data: { status, respondedAt: new Date() } });
    } else {
      // Responded without being contacted (saw it in their list or on the public page)
      await prisma.requestCandidate.create({
        data: { requestId: id, donorUserId: userId, score: 0, rank: 9999, reasons: '[]', source: 'self', status, respondedAt: new Date() },
      }).catch(() => undefined);
    }
    if (status === 'accepted' && (await this.unitsStillNeeded(r)) === 0) {
      await prisma.bloodRequest.update({ where: { id }, data: { nextWaveAt: null } });
    } else if (status === 'declined' && r.nextWaveAt && r.nextWaveAt.getTime() - Date.now() > 3 * 60 * 1000) {
      // Every "no" brings the next wave a little closer (at most 3 minutes away)
      const soon = new Date(Date.now() + 3 * 60 * 1000);
      const declined = await prisma.requestCandidate.count({ where: { requestId: id, wave: r.waveNumber, status: 'declined' } });
      const inWave = await prisma.requestCandidate.count({ where: { requestId: id, wave: r.waveNumber } });
      if (inWave > 0 && declined >= Math.ceil(inWave / 2)) await prisma.bloodRequest.update({ where: { id }, data: { nextWaveAt: soon } });
    }

    if (status === 'accepted') {
      if (['submitted', 'open', 'donors_notified'].includes(r.status)) {
        await prisma.bloodRequest.update({ where: { id }, data: { status: 'donor_found' } });
      }
      const donor = await prisma.user.findUnique({ where: { id: userId } });
      await prisma.notification.create({
        data: {
          recipientId: r.requesterUserId,
          notificationType: 'request_update',
          title: 'A donor accepted your request',
          message: `${firstName(donor?.fullName || donor?.username)} can donate for your ${r.bloodGroup} request at ${r.hospitalName}. They now have your number and will contact you.`,
          relatedEntity: `/app/requests/${r.id}`,
        },
      });
      emitToUser(r.requesterUserId, 'notification:new', { type: 'request_update', requestId: r.id });
    }
    return this.getForDonor(userId, id);
  }

  /** Requester changes the status (within the allowed transitions and verification pairs) */
  async updateStatus(userId: string, id: string, next: RequestStatus) {
    const r = await prisma.bloodRequest.findUnique({ where: { id } });
    if (!r || r.requesterUserId !== userId) throw new AppError('Request not found.', 404, 'NOT_FOUND');
    const current = (await this.expireIfDue(r)) as RequestStatus;
    if (!REQUESTER_SETTABLE.includes(next) || !TRANSITIONS[current].includes(next)) {
      throw new AppError(`A request that is "${current.replace(/_/g, ' ')}" cannot be changed to "${next.replace(/_/g, ' ')}".`, 409, 'CONFLICT');
    }
    assertPair(r.verificationStatus, next);
    const done = ['fulfilled', 'cancelled', 'closed'].includes(next);
    await prisma.bloodRequest.update({
      where: { id },
      data: {
        status: next,
        closedAt: done ? new Date() : null,
        unitsFulfilled: next === 'fulfilled' ? r.unitsNeeded : r.unitsFulfilled,
      },
    });
    if (next === 'cancelled' || next === 'fulfilled') {
      const responders = await prisma.requestResponse.findMany({ where: { requestId: id, status: 'accepted' }, select: { donorUserId: true } });
      for (const x of responders) {
        await prisma.notification.create({
          data: {
            recipientId: x.donorUserId,
            notificationType: 'request_update',
            title: next === 'fulfilled' ? 'Request fulfilled, thank you!' : 'Request cancelled',
            message:
              next === 'fulfilled'
                ? `The ${r.bloodGroup} request at ${r.hospitalName} has all the blood it needs. Thank you for stepping up.`
                : `The ${r.bloodGroup} request at ${r.hospitalName} was cancelled. You don't need to go.`,
            relatedEntity: `/app/requests/${r.id}`,
          },
        });
      }
    }
    return this.getForRequester(userId, id);
  }

  /** Requester confirms a donor donated: counts units, updates the donor's record */
  async markDonated(userId: string, id: string, responseId: string) {
    const r = await prisma.bloodRequest.findUnique({ where: { id } });
    if (!r || r.requesterUserId !== userId) throw new AppError('Request not found.', 404, 'NOT_FOUND');
    const resp = await prisma.requestResponse.findUnique({ where: { id: responseId } });
    if (!resp || resp.requestId !== id || resp.status !== 'accepted') {
      throw new AppError('Only a donor who accepted can be marked as donated.', 400, 'BAD_REQUEST');
    }
    assertPair(r.verificationStatus, 'partially_fulfilled');
    const units = Math.min(r.unitsNeeded, r.unitsFulfilled + 1);
    const status: RequestStatus = units >= r.unitsNeeded ? 'fulfilled' : 'partially_fulfilled';
    const before = await prisma.donorProfile.findUnique({ where: { userId: resp.donorUserId }, select: { lastDonationDate: true } });
    await prisma.$transaction([
      // The donor is taken off the alert list straight away (their health comes first) and asked to confirm.
      // If they say they did not donate, this is undone.
      prisma.donationRecord.create({
        data: {
          userId: resp.donorUserId,
          donatedOn: new Date(),
          source: 'request',
          requestId: r.id,
          place: r.hospitalName,
          status: 'pending_donor',
          previousLastDonationDate: before?.lastDonationDate ?? null,
        },
      }),
      prisma.requestResponse.update({ where: { id: responseId }, data: { status: 'donated' } }),
      prisma.bloodRequest.update({
        where: { id },
        data: { unitsFulfilled: units, status, closedAt: status === 'fulfilled' ? new Date() : null },
      }),
      prisma.donorProfile.updateMany({
        where: { userId: resp.donorUserId },
        data: { totalDonations: { increment: 1 }, lastDonationDate: new Date() },
      }),
      prisma.notification.create({
        data: {
          recipientId: resp.donorUserId,
          notificationType: 'request_update',
          title: 'Thank you for donating! Please confirm',
          message: `The family says you donated today for the ${r.bloodGroup} request at ${r.hospitalName}. Please confirm it on your profile. We pause your alerts until you can donate again, so nobody asks you too soon.`,
          relatedEntity: '/app/profile#donations',
        },
      }),
    ]);
    return this.getForRequester(userId, id);
  }

  /** Public, information-only page: no names, no numbers */
  async getPublic(code: string, viewerUserId?: string) {
    const r = await prisma.bloodRequest.findUnique({ where: { publicCode: code.trim().toUpperCase() } });
    if (!r) throw new AppError('This request link is not valid.', 404, 'NOT_FOUND');
    r.status = await this.expireIfDue(r);
    const isLive = LIVE.includes(r.status as RequestStatus) && !r.onHold && r.verificationStatus !== 'rejected';
    let viewer: Record<string, unknown> = { signedIn: false };
    if (viewerUserId) {
      const e = await this.donorEligibility(viewerUserId, r);
      viewer = { signedIn: true, isRequester: r.requesterUserId === viewerUserId, canRespond: e.canRespond, cannotRespondReason: e.reason, requestId: r.id };
    }
    return {
      publicCode: r.publicCode,
      bloodGroup: r.bloodGroup,
      component: r.component,
      unitsNeeded: r.unitsNeeded,
      unitsFulfilled: r.unitsFulfilled,
      hospitalName: r.hospitalName,
      hospitalArea: r.hospitalArea,
      hospitalPinCode: r.hospitalPinCode,
      city: r.city,
      district: r.district,
      state: r.state,
      urgency: r.urgency,
      neededBy: r.neededBy?.toISOString() || null,
      status: r.status,
      isLive,
      paused: r.onHold,
      compatibleDonorGroups: this.compatibleDonorGroups(r.bloodGroup),
      createdAt: r.createdAt.toISOString(),
      viewer,
    };
  }

  /** Hospital name suggestions for the request form (state + district, PIN code first) */
  async hospitals(q: { country?: string; state: string; district?: string; pinCode?: string; search?: string }) {
    return suggestHospitals({ country: (q.country || 'IN').toUpperCase(), state: q.state, district: q.district, pinCode: q.pinCode, search: q.search });
  }

  // ---------- Admin ----------

  async adminList(q: { status?: string; verification?: string; country?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 20));
    const where: any = {};
    if (q.status && q.status !== 'ALL') where.status = q.status;
    if (q.verification && q.verification !== 'ALL') where.verificationStatus = q.verification;
    if (q.country && q.country !== 'ALL') where.country = q.country;
    const [total, rows] = await Promise.all([
      prisma.bloodRequest.count({ where }),
      prisma.bloodRequest.findMany({
        where,
        include: {
          requester: { select: { fullName: true, username: true, email: true, phone: true, country: true } },
          _count: { select: { responses: { where: { status: { in: ['accepted', 'donated'] } } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map((r) =>
        this.serialize(r, 'admin', {
          patientName: r.patientName,
          requesterName: r.requester.fullName || r.requester.username,
          requesterEmail: r.requester.email,
          requesterPhone: formatPhone(r.contactPhone, r.requester.country),
          acceptedCount: r._count.responses,
        }),
      ),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async adminSetVerification(adminId: string, id: string, input: { verificationStatus: string; note?: string }) {
    const r = await prisma.bloodRequest.findUnique({ where: { id } });
    if (!r) throw new AppError('Request not found.', 404, 'NOT_FOUND');
    const data: any = { verificationStatus: input.verificationStatus, verificationNote: input.note || null };
    // Allowed pairs: a rejected request is cancelled automatically
    if (input.verificationStatus === 'rejected' && !ALLOWED_PAIRS.rejected.includes(r.status as RequestStatus)) {
      data.status = 'cancelled';
      data.closedAt = new Date();
    }
    await prisma.bloodRequest.update({ where: { id }, data });
    await prisma.auditLog.create({
      data: { actorId: adminId, action: 'BLOOD_REQUEST_VERIFICATION', entityType: 'BloodRequest', entityId: id, details: JSON.stringify(input) },
    });
    await prisma.notification.create({
      data: {
        recipientId: r.requesterUserId,
        notificationType: 'request_update',
        title: input.verificationStatus === 'verified' ? 'Your request is verified' : input.verificationStatus === 'rejected' ? 'Your request was not approved' : 'Your request is being reviewed',
        message:
          input.verificationStatus === 'rejected'
            ? `Our team could not approve your ${r.bloodGroup} request${input.note ? `: ${input.note}` : '.'} Please contact support if this is a mistake.`
            : `Your ${r.bloodGroup} request at ${r.hospitalName} is now ${input.verificationStatus.replace('_', ' ')}.`,
        relatedEntity: `/app/requests/${r.id}`,
      },
    });
    return { success: true };
  }

  async adminSetHold(adminId: string, id: string, input: { onHold: boolean; reason?: string }) {
    const r = await prisma.bloodRequest.findUnique({ where: { id } });
    if (!r) throw new AppError('Request not found.', 404, 'NOT_FOUND');
    await prisma.bloodRequest.update({ where: { id }, data: { onHold: input.onHold, holdReason: input.onHold ? input.reason || null : null } });
    await prisma.auditLog.create({
      data: { actorId: adminId, action: input.onHold ? 'BLOOD_REQUEST_HOLD' : 'BLOOD_REQUEST_RELEASE', entityType: 'BloodRequest', entityId: id, details: JSON.stringify(input) },
    });
    if (!input.onHold) await this.notifyDonors(id); // catch up on alerts paused by the hold
    return { success: true };
  }
}

export const requestService = new RequestService();
