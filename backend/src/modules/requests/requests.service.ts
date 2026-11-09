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
  user: { select: { dateOfBirth: true } },
} as const;
const MAX_LIVE_REQUESTS = 3;
const MAX_ALERTS_PER_REQUEST = 200;

const firstName = (name?: string | null) => (name || 'A donor').trim().split(/\s+/)[0];

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
        userId: { not: r.requesterUserId },
        user: { status: 'active', isEmailVerified: true },
      },
      select: { userId: true, ...ELIGIBILITY_FIELDS },
      take: 1000,
    });
    return profiles.filter((p) => canDonateNow(p)).map((p) => p.userId);
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

  /** Sends in-app alerts to matching donors and Family & Allies (once per donor per request) */
  async notifyDonors(requestId: string) {
    const r = await prisma.bloodRequest.findUnique({ where: { id: requestId } });
    if (!r || r.onHold || r.verificationStatus === 'rejected' || !LIVE.includes(r.status as RequestStatus)) return { total: 0, savedDonors: 0 };

    const [nearby, allies, alreadyNotified] = await Promise.all([
      this.findMatchingDonors(r),
      this.findFamilyAllies(r.requesterUserId, r.bloodGroup),
      prisma.notification.findMany({
        where: { relatedEntity: `/app/requests/${r.id}`, notificationType: 'emergency_request' },
        select: { recipientId: true },
      }),
    ]);
    const skip = new Set([r.requesterUserId, ...alreadyNotified.map((n) => n.recipientId)]);
    const recipients = [...new Set([...allies, ...nearby])].filter((id) => !skip.has(id)).slice(0, MAX_ALERTS_PER_REQUEST);

    const urgencyWord = r.urgency === 'critical' ? 'URGENT: ' : '';
    const place = [r.hospitalName, r.hospitalArea, r.city].filter(Boolean).join(', ') + (r.hospitalPinCode ? ` (PIN ${r.hospitalPinCode})` : '');
    for (const recipientId of recipients) {
      const isAlly = allies.includes(recipientId);
      await prisma.notification.create({
        data: {
          recipientId,
          notificationType: 'emergency_request',
          title: `${urgencyWord}${r.bloodGroup} blood needed in ${r.city}`,
          message: isAlly
            ? `A family you pledged to help needs ${r.unitsNeeded} unit(s) of ${r.bloodGroup} at ${place}. Can you donate?`
            : `${r.unitsNeeded} unit(s) of ${r.bloodGroup} needed at ${place}. You are a matching donor nearby. Can you donate? Donating is always free: never pay anyone.`,
          relatedEntity: `/app/requests/${r.id}`,
        },
      });
      emitToUser(recipientId, 'notification:new', { type: 'emergency_request', requestId: r.id });
    }

    const total = r.donorsNotified + recipients.length;
    let status = r.status as RequestStatus;
    if (status === 'submitted') status = total > 0 ? 'donors_notified' : 'open';
    else if (status === 'open' && recipients.length > 0) status = 'donors_notified';
    await prisma.bloodRequest.update({ where: { id: r.id }, data: { donorsNotified: total, status } });
    logger.info(`Blood request ${r.publicCode}: alerted ${recipients.length} donor(s)`);
    return { total: recipients.length, savedDonors: recipients.filter((id) => allies.includes(id)).length };
  }

  /** Counts only (no donor cards): how many matching donors are in an area */
  async donorCounts(q: { bloodGroup: string; country?: string; state: string; district?: string }) {
    const country = (q.country || 'IN').toUpperCase();
    const compatible = this.compatibleDonorGroups(q.bloodGroup);
    const area = { country, state: q.state, ...(q.district ? { district: q.district } : {}) };
    const base = { user: { status: 'active', isEmailVerified: true } } as const;

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
              select: { fullName: true, username: true, phone: true, country: true, donorProfile: { select: { bloodGroup: true } } },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!r || r.requesterUserId !== userId) throw new AppError('Request not found.', 404, 'NOT_FOUND');
    r.status = await this.expireIfDue(r);
    return this.serialize(r, 'requester', {
      patientName: r.patientName,
      isRequester: true,
      responses: r.responses.map((x) => ({
        id: x.id,
        donorFirstName: firstName(x.donor.fullName || x.donor.username),
        donorBloodGroup: x.donor.donorProfile?.bloodGroup || null,
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
    const accepted = mine && (mine.status === 'accepted' || mine.status === 'donated');
    return this.serialize(r, 'donor', {
      isRequester: false,
      requesterFirstName: firstName(r.requester.fullName || r.requester.username),
      myResponse: mine ? { status: mine.status, shareDirectNumber: mine.shareDirectNumber } : null,
      canRespond: eligibility.canRespond,
      cannotRespondReason: eligibility.reason,
      // Revealed only after accepting
      requesterPhone: accepted ? formatPhone(r.contactPhone, r.requester.country) : null,
    });
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
    await prisma.$transaction([
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
          title: 'Thank you for donating!',
          message: `Your donation for the ${r.bloodGroup} request at ${r.hospitalName} was confirmed. You helped save a life.`,
          relatedEntity: `/app/requests/${r.id}`,
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
