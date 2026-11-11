/**
 * Partner programmes: insurers, term-insurance providers, banks, colleges, employers and large groups
 * sponsor Donor Circle for their customers or members.
 *
 * How it works:
 * - BloodNation staff create a programme with a code (e.g. ACMELIFE-7KQ2), a number of seats and free months.
 * - The partner shares the code with its customers (policy welcome kit, bank app banner, college notice, WhatsApp).
 * - A person redeems it once: Donor Circle switches on for them at no cost.
 * - The partner gets a counts-only report (redeemed, families set up, donors pledged, emergencies helped).
 *   Small counts (< 3) are hidden, and no names or health details ever go to the partner.
 *
 * Searching for donors and posting requests stay free for everyone, sponsored or not.
 */
import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/types.js';
import { generateRandomToken } from '../../shared/password.js';
import { safeCount } from '../communities/communities.service.js';

export const PARTNER_TYPES = ['insurer', 'term_insurer', 'bank', 'college', 'employer', 'group', 'ngo', 'other'] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

const DAY = 24 * 60 * 60 * 1000;

export interface ProgramInput {
  name: string;
  partnerType: PartnerType;
  code?: string;
  seats: number;
  monthsFree?: number;
  endsAt?: string | null;
  contactName?: string;
  contactEmail?: string;
}

const normalise = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '');

function makeCode(name: string) {
  const stem = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'PARTNER';
  return `${stem}-${generateRandomToken(2).toUpperCase()}`;
}

export class PartnerService {
  private async seatsUsed(programId: string) {
    return prisma.partnerRedemption.count({ where: { programId } });
  }

  /** Why a code can't be used right now (null = it can) */
  private unavailableReason(p: { active: boolean; startsAt: Date; endsAt: Date | null; seats: number }, used: number, now = new Date()) {
    if (!p.active) return 'This code is not active.';
    if (p.startsAt > now) return 'This code is not open yet.';
    if (p.endsAt && p.endsAt < now) return 'This code has expired.';
    if (used >= p.seats) return 'All places on this code have been used.';
    return null;
  }

  /** What a person sees before redeeming: the sponsor's name and what they get (never seat numbers) */
  async lookup(code: string) {
    const p = await prisma.partnerProgram.findUnique({ where: { code: normalise(code) } });
    if (!p) throw new AppError('We could not find this code. Please check it and try again.', 404, 'NOT_FOUND');
    const reason = this.unavailableReason(p, await this.seatsUsed(p.id));
    return { code: p.code, name: p.name, partnerType: p.partnerType, monthsFree: p.monthsFree, available: !reason, reason };
  }

  /** Redeem a code: Donor Circle switches on (or is extended) at no cost to the person */
  async redeem(userId: string, code: string) {
    const p = await prisma.partnerProgram.findUnique({ where: { code: normalise(code) } });
    if (!p) throw new AppError('We could not find this code. Please check it and try again.', 404, 'NOT_FOUND');

    const already = await prisma.partnerRedemption.findUnique({ where: { programId_userId: { programId: p.id, userId } } });
    if (already) throw new AppError('You have already used this code.', 409, 'ALREADY_REDEEMED');

    // One sponsored period at a time (stops collecting codes from several partners)
    const now = new Date();
    const sponsored = await prisma.subscription.findFirst({ where: { userId, provider: 'partner', status: 'active', endsAt: { gt: now } } });
    if (sponsored) {
      throw new AppError(`You already have sponsored cover until ${sponsored.endsAt!.toDateString()}. You can use another code after that.`, 409, 'ALREADY_SPONSORED');
    }

    // Starts now, or straight after a period the person already paid for
    const current = await prisma.subscription.findFirst({ where: { userId, status: 'active', endsAt: { gt: now } }, orderBy: { endsAt: 'desc' } });
    const startsAt = current?.endsAt && current.endsAt > now ? current.endsAt : now;
    const endsAt = new Date(startsAt);
    endsAt.setMonth(endsAt.getMonth() + p.monthsFree);

    const result = await prisma.$transaction(async (tx) => {
      const used = await tx.partnerRedemption.count({ where: { programId: p.id } });
      const reason = this.unavailableReason(p, used, now);
      if (reason) throw new AppError(reason, 400, 'CODE_UNAVAILABLE');
      const sub = await tx.subscription.create({
        data: { userId, plan: 'family_yearly', amountPaise: 0, status: 'active', provider: 'partner', autoRenew: false, startsAt, endsAt },
      });
      await tx.partnerRedemption.create({ data: { programId: p.id, userId, subscriptionId: sub.id } });
      await tx.notification.create({
        data: {
          recipientId: userId,
          notificationType: 'system',
          title: `Donor Circle is on, sponsored by ${p.name}`,
          message: `Add your family members and invite relatives and friends to pledge. Covered until ${endsAt.toDateString()}.`,
          relatedEntity: '/app/family',
        },
      });
      return sub;
    });
    return { success: true, sponsoredBy: p.name, startsAt: result.startsAt!.toISOString(), endsAt: result.endsAt!.toISOString() };
  }

  /** The sponsor of the person's current cover, if any (shown on the subscription page) */
  async mySponsor(userId: string) {
    const now = new Date();
    const sub = await prisma.subscription.findFirst({
      where: { userId, provider: 'partner', status: 'active', endsAt: { gt: now } },
      orderBy: { endsAt: 'desc' },
    });
    if (!sub) return null;
    const r = await prisma.partnerRedemption.findFirst({ where: { subscriptionId: sub.id }, include: { program: { select: { name: true, partnerType: true } } } });
    return { name: r?.program.name || 'a partner', partnerType: r?.program.partnerType || 'other', endsAt: sub.endsAt!.toISOString() };
  }

  // ---------- BloodNation staff ----------

  async adminCreate(adminId: string, input: ProgramInput) {
    let code = input.code ? normalise(input.code) : makeCode(input.name);
    if (!/^[A-Z0-9-]{4,24}$/.test(code)) {
      throw new AppError('Codes use letters, numbers and dashes (4 to 24).', 400, 'VALIDATION_FAILED', { code: 'Letters, numbers and dashes only.' });
    }
    if (await prisma.partnerProgram.findUnique({ where: { code } })) {
      if (input.code) throw new AppError('This code is already used by another programme.', 409, 'CONFLICT', { code: 'Choose a different code.' });
      code = makeCode(input.name + 'X');
    }
    const p = await prisma.partnerProgram.create({
      data: {
        name: input.name.trim(),
        partnerType: input.partnerType,
        code,
        seats: input.seats,
        monthsFree: input.monthsFree ?? 12,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        contactName: input.contactName?.trim() || null,
        contactEmail: input.contactEmail?.trim() || null,
        createdById: adminId,
      },
    });
    await prisma.auditLog
      .create({ data: { actorId: adminId, action: 'PARTNER_PROGRAM_CREATED', entityType: 'PartnerProgram', entityId: p.id, details: JSON.stringify({ code, seats: p.seats }) } })
      .catch(() => undefined);
    return p;
  }

  async adminUpdate(adminId: string, id: string, input: { active?: boolean; seats?: number; monthsFree?: number; endsAt?: string | null }) {
    const p = await prisma.partnerProgram.findUnique({ where: { id } });
    if (!p) throw new AppError('Programme not found.', 404, 'NOT_FOUND');
    if (typeof input.seats === 'number' && input.seats < (await this.seatsUsed(id))) {
      throw new AppError('Seats cannot be fewer than the codes already used.', 400, 'VALIDATION_FAILED', { seats: 'Too low.' });
    }
    const updated = await prisma.partnerProgram.update({
      where: { id },
      data: {
        ...(typeof input.active === 'boolean' && { active: input.active }),
        ...(typeof input.seats === 'number' && { seats: input.seats }),
        ...(typeof input.monthsFree === 'number' && { monthsFree: input.monthsFree }),
        ...(input.endsAt !== undefined && { endsAt: input.endsAt ? new Date(input.endsAt) : null }),
      },
    });
    await prisma.auditLog
      .create({ data: { actorId: adminId, action: 'PARTNER_PROGRAM_UPDATED', entityType: 'PartnerProgram', entityId: id, details: JSON.stringify(input) } })
      .catch(() => undefined);
    return updated;
  }

  /**
   * The partner's report: counts only, small counts hidden. Safe to send to the partner as it is.
   */
  async report(id: string) {
    const p = await prisma.partnerProgram.findUnique({ where: { id } });
    if (!p) throw new AppError('Programme not found.', 404, 'NOT_FOUND');
    const userIds = (await prisma.partnerRedemption.findMany({ where: { programId: id }, select: { userId: true } })).map((r) => r.userId);
    const [familiesSetUp, pledges, requests, fulfilled] = userIds.length
      ? await Promise.all([
          prisma.familyMember.groupBy({ by: ['ownerUserId'], where: { ownerUserId: { in: userIds } } }).then((g) => g.length),
          prisma.bloodPledge.findMany({ where: { ownerUserId: { in: userIds }, status: 'active' }, select: { donorUserId: true }, distinct: ['donorUserId'] }).then((x) => x.length),
          prisma.bloodRequest.count({ where: { requesterUserId: { in: userIds } } }),
          prisma.bloodRequest.count({ where: { requesterUserId: { in: userIds }, status: 'fulfilled' } }),
        ])
      : [0, 0, 0, 0];
    return {
      id: p.id,
      name: p.name,
      partnerType: p.partnerType,
      code: p.code,
      seats: p.seats,
      redeemed: userIds.length, // the partner pays per seat used, so this number is exact
      familiesSetUp: safeCount(familiesSetUp),
      donorsPledged: safeCount(pledges),
      emergenciesPosted: safeCount(requests),
      emergenciesFulfilled: safeCount(fulfilled),
      generatedAt: new Date().toISOString(),
    };
  }

  async adminList() {
    const rows = await prisma.partnerProgram.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { redemptions: true } } } });
    const now = Date.now();
    return rows.map(({ _count, ...p }) => ({
      ...p,
      redeemed: _count.redemptions,
      status: !p.active ? 'paused' : p.endsAt && p.endsAt.getTime() < now ? 'ended' : _count.redemptions >= p.seats ? 'full' : 'open',
      endingSoon: Boolean(p.endsAt && p.endsAt.getTime() > now && p.endsAt.getTime() - now < 14 * DAY),
    }));
  }
}

export const partnerService = new PartnerService();
