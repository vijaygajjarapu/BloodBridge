/**
 * Communities v1: a community is just a tag a donor adds to themselves (gated community, villa, apartment,
 * college, company, place of worship, club). Communities never have to sign up; an organiser can claim one later.
 *
 * Privacy rules:
 * - A donor's communities are never shown to other users. Other people only see COUNTS, and any count below 3
 *   is shown as "fewer than 3" so nobody can work out who lives where.
 * - Joining is optional and can be undone at any time.
 * - Students and people who move: "Still at X?" every 6 months; no answer for 30 days = stale (no alerts).
 *   Alumni stay listed but get no "nearby" alerts.
 */
import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/types.js';
import { validateLocation } from '../../shared/location.js';
import { canBeAlerted } from '../eligibility/eligibility.rules.js';
import { generateRandomToken } from '../../shared/password.js';
import { config } from '../../config/index.js';

export const COMMUNITY_TYPES = ['gated', 'villa', 'apartment', 'college', 'company', 'worship', 'club', 'whatsapp', 'association', 'other'] as const;
/** Groups of people who know each other (not a place): members help each other wherever the hospital is */
export const PEOPLE_GROUP_TYPES = ['whatsapp', 'association', 'club', 'worship'];
export type CommunityType = (typeof COMMUNITY_TYPES)[number];

export const MAX_MEMBERSHIPS = 5;
export const MAX_CREATED_PER_DAY = 5;
export const RECONFIRM_AFTER_DAYS = 180;
export const STALE_AFTER_ASK_DAYS = 30;
/** Counts below this are shown as "fewer than 3" */
export const MIN_VISIBLE_COUNT = 3;

const DAY = 24 * 60 * 60 * 1000;

/** "Green Meadows Phase-2 " -> "greenmeadowsphase2" (stops near-duplicate communities) */
export function communityKey(name: string) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(the|apartments?|apts?|residency|society|chs)\b/g, '')
    .replace(/[^a-z0-9ऀ-ൿ]+/g, '');
}

/** Privacy-safe count: exact when 3 or more, otherwise null with a label */
export function safeCount(n: number) {
  return n >= MIN_VISIBLE_COUNT ? { count: n, label: String(n) } : { count: null, label: n === 0 ? '0' : 'fewer than 3' };
}

export interface CreateCommunityInput {
  name: string;
  type: CommunityType;
  country?: string;
  state: string;
  district: string;
  city: string;
  locality?: string;
  pinCode?: string;
}

export interface MembershipPrefs {
  alertNearby?: boolean;
  alertFromMembers?: boolean;
  muted?: boolean;
  isAlumni?: boolean;
}

const ELIGIBILITY_SELECT = {
  bloodGroup: true,
  isAvailable: true,
  lastDonationDate: true,
  totalDonations: true,
  sex: true,
  weightKg: true,
  deferredUntil: true,
  deferralReason: true,
  permanentlyDeferred: true,
  pausedUntil: true,
} as const;

const publicCommunity = (c: {
  id: string; name: string; type: string; country: string; state: string; district: string; city: string;
  locality: string | null; pinCode: string | null; claimed: boolean;
}) => ({
  id: c.id,
  name: c.name,
  type: c.type,
  country: c.country,
  state: c.state,
  district: c.district,
  city: c.city,
  locality: c.locality,
  pinCode: c.pinCode,
  claimed: c.claimed,
});

export class CommunityService {
  /** My communities, with my alert settings */
  async mine(userId: string) {
    const rows = await prisma.communityMember.findMany({
      where: { userId },
      include: { community: true },
      orderBy: { createdAt: 'asc' },
    });
    const now = Date.now();
    return rows.map((m) => ({
      ...publicCommunity(m.community),
      membership: {
        alertNearby: m.alertNearby,
        alertFromMembers: m.alertFromMembers,
        muted: m.muted,
        isAlumni: m.isAlumni,
        status: m.status,
        confirmedAt: m.confirmedAt,
        needsConfirm: m.status === 'stale' || Boolean(m.reconfirmAskedAt) || now - m.confirmedAt.getTime() > RECONFIRM_AFTER_DAYS * DAY,
      },
    }));
  }

  /** Find communities to join (by name, in a district) */
  async search(q: { q?: string; country?: string; state?: string; district?: string; pinCode?: string }) {
    const key = q.q ? communityKey(q.q) : '';
    if (!key && !q.district && !q.pinCode) return [];
    const rows = await prisma.community.findMany({
      where: {
        country: q.country || 'IN',
        ...(q.state ? { state: q.state } : {}),
        ...(q.district ? { district: q.district } : {}),
        ...(q.pinCode ? { pinCode: q.pinCode } : {}),
        ...(key ? { nameKey: { contains: key } } : {}),
      },
      include: { _count: { select: { members: { where: { status: 'active' } } } } },
      orderBy: { name: 'asc' },
      take: 30,
    });
    return rows.map((c) => ({ ...publicCommunity(c), members: safeCount(c._count.members) }));
  }

  /** Add a community (or find the same one someone already added) and join it */
  async create(userId: string, input: CreateCommunityInput) {
    const name = input.name.trim().replace(/\s+/g, ' ');
    const nameKey = communityKey(name);
    if (nameKey.length < 3) {
      throw new AppError('Please enter the full name of the community.', 400, 'VALIDATION_FAILED', { name: 'Enter the full name (at least 3 letters).' });
    }
    const loc = validateLocation(
      { country: input.country || 'IN', state: input.state, district: input.district, city: input.city, postalCode: input.pinCode },
      { requireCity: true },
    );

    let community = await prisma.community.findUnique({
      where: { country_state_district_nameKey: { country: loc.country, state: loc.state, district: loc.district, nameKey } },
    });
    if (!community) {
      if ((await prisma.communityMember.count({ where: { userId } })) >= MAX_MEMBERSHIPS) {
        throw new AppError(`You can be in up to ${MAX_MEMBERSHIPS} communities. Leave one to add another.`, 400, 'LIMIT_REACHED');
      }
      const madeToday = await prisma.community.count({ where: { createdByUserId: userId, createdAt: { gte: new Date(Date.now() - DAY) } } });
      if (madeToday >= MAX_CREATED_PER_DAY) {
        throw new AppError('You have added a lot of communities today. Please try again tomorrow.', 429, 'TOO_MANY_REQUESTS');
      }
      community = await prisma.community.create({
        data: {
          name,
          nameKey,
          type: input.type,
          country: loc.country,
          state: loc.state,
          district: loc.district,
          city: loc.city,
          locality: input.locality?.trim() || null,
          pinCode: loc.postalCode,
          createdByUserId: userId,
        },
      });
    }
    await this.join(userId, community.id);
    // Groups of people (WhatsApp group, association): the person who adds it wants members to help each other
    if (PEOPLE_GROUP_TYPES.includes(community.type)) {
      await prisma.communityMember.updateMany({ where: { communityId: community.id, userId }, data: { alertFromMembers: true } });
    }
    return publicCommunity(community);
  }

  async join(userId: string, communityId: string) {
    const community = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new AppError('Community not found.', 404, 'NOT_FOUND');
    const existing = await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId, userId } } });
    if (existing) return this.mine(userId);
    const count = await prisma.communityMember.count({ where: { userId } });
    if (count >= MAX_MEMBERSHIPS) {
      throw new AppError(`You can be in up to ${MAX_MEMBERSHIPS} communities. Leave one to add another.`, 400, 'LIMIT_REACHED');
    }
    await prisma.communityMember.create({ data: { communityId, userId } });
    return this.mine(userId);
  }

  // ---------- Invite links (WhatsApp groups, associations, clubs) ----------

  /** A member gets the group's shareable link (created on first use) and a ready-made WhatsApp message */
  async inviteLink(userId: string, communityId: string) {
    const m = await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId, userId } }, include: { community: true } });
    if (!m) throw new AppError('Join this community first to invite others.', 403, 'FORBIDDEN');
    let code = m.community.inviteCode;
    if (!code) {
      for (let i = 0; i < 5 && !code; i++) {
        const candidate = 'GRP-' + generateRandomToken(3).toUpperCase();
        if (!(await prisma.community.findFirst({ where: { inviteCode: candidate } }))) code = candidate;
      }
      if (!code) throw new AppError('Please try again.', 500, 'INTERNAL_ERROR');
      await prisma.community.update({ where: { id: communityId }, data: { inviteCode: code } });
    }
    const url = `${config.frontendUrl}/app/communities/join/${code}`;
    const message =
      `Join "${m.community.name}" on Manvi Blood. If anyone in our group needs blood, the members who can donate get an alert at once. ` +
      `Your number stays hidden. It's free: ${url}`;
    return { code, url, whatsappUrl: `https://wa.me/?text=${encodeURIComponent(message)}`, message };
  }

  /** What someone sees when they open an invite link: the group, how many members (small counts hidden) */
  async byInviteCode(code: string, viewerUserId?: string) {
    const c = await prisma.community.findFirst({
      where: { inviteCode: code.trim().toUpperCase() },
      include: { _count: { select: { members: { where: { status: 'active' } } } } },
    });
    if (!c) throw new AppError('This invite link is not valid. Ask the group for a new one.', 404, 'NOT_FOUND');
    const isMember = viewerUserId ? Boolean(await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId: c.id, userId: viewerUserId } } })) : false;
    const { _count, ...rest } = c;
    return { ...publicCommunity(rest), members: safeCount(_count.members), isMember, peopleGroup: PEOPLE_GROUP_TYPES.includes(c.type) };
  }

  /** Join through an invite link. "Alert me when a member needs blood" is the person's own choice (ticked by default for people-groups). */
  async joinByInviteCode(userId: string, code: string, alertFromMembers?: boolean) {
    const c = await prisma.community.findFirst({ where: { inviteCode: code.trim().toUpperCase() } });
    if (!c) throw new AppError('This invite link is not valid. Ask the group for a new one.', 404, 'NOT_FOUND');
    await this.join(userId, c.id);
    const wants = typeof alertFromMembers === 'boolean' ? alertFromMembers : PEOPLE_GROUP_TYPES.includes(c.type);
    await prisma.communityMember.updateMany({ where: { communityId: c.id, userId }, data: { alertFromMembers: wants } });
    return this.mine(userId);
  }

  async leave(userId: string, communityId: string) {
    await prisma.communityMember.deleteMany({ where: { communityId, userId } });
    return this.mine(userId);
  }

  async updatePrefs(userId: string, communityId: string, prefs: MembershipPrefs) {
    const m = await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId, userId } } });
    if (!m) throw new AppError('You are not in this community.', 404, 'NOT_FOUND');
    const data: MembershipPrefs = {};
    for (const k of ['alertNearby', 'alertFromMembers', 'muted', 'isAlumni'] as const) {
      if (typeof prefs[k] === 'boolean') data[k] = prefs[k];
    }
    await prisma.communityMember.update({ where: { id: m.id }, data });
    return this.mine(userId);
  }

  /** "Yes, I'm still here" (or "I've moved" = alumni) */
  async confirm(userId: string, communityId: string, stillHere: boolean) {
    const m = await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId, userId } } });
    if (!m) throw new AppError('You are not in this community.', 404, 'NOT_FOUND');
    await prisma.communityMember.update({
      where: { id: m.id },
      data: stillHere
        ? { status: 'active', confirmedAt: new Date(), reconfirmAskedAt: null, isAlumni: false }
        : { status: 'active', confirmedAt: new Date(), reconfirmAskedAt: null, isAlumni: true, alertNearby: false },
    });
    return this.mine(userId);
  }

  /**
   * Communities near a hospital, with how many members could donate for this blood group right now.
   * Same PIN code first, then the rest of the district. Counts below 3 are hidden.
   */
  async near(q: { country?: string; state: string; district: string; pinCode?: string; donorGroups: string[]; excludeUserId?: string }) {
    const communities = await prisma.community.findMany({
      where: { country: q.country || 'IN', state: q.state, district: q.district },
      select: {
        id: true, name: true, type: true, country: true, state: true, district: true, city: true, locality: true, pinCode: true, claimed: true,
        members: {
          where: { status: 'active', muted: false, isAlumni: false, alertNearby: true, ...(q.excludeUserId ? { userId: { not: q.excludeUserId } } : {}) },
          select: {
            user: {
              select: {
                status: true,
                isEmailVerified: true,
                dateOfBirth: true,
                donorProfile: { select: ELIGIBILITY_SELECT },
              },
            },
          },
        },
      },
      take: 200,
    });
    const groups = new Set(q.donorGroups);
    const rows = communities
      .map((c) => {
        const ready = c.members.filter((m) => {
          const p = m.user.donorProfile;
          if (!p || m.user.status !== 'active' || !m.user.isEmailVerified) return false;
          if (!p.isAvailable || !groups.has(p.bloodGroup)) return false;
          return canBeAlerted({ ...p, dateOfBirth: m.user.dateOfBirth });
        }).length;
        const { members, ...rest } = c;
        return {
          ...publicCommunity(rest),
          samePin: Boolean(q.pinCode && c.pinCode === q.pinCode),
          readyCount: ready,
          ready: safeCount(ready),
          members: safeCount(members.length),
        };
      })
      .filter((c) => c.readyCount > 0)
      .sort((a, b) => Number(b.samePin) - Number(a.samePin) || b.readyCount - a.readyCount)
      .slice(0, 12);
    // Never send exact small counts to the browser
    return rows.map(({ readyCount, ...c }) => c);
  }

  /**
   * Donors to add to a request's candidate list because of communities:
   * - fellow members of the requester's own communities who said "alert me when a member needs blood" (any hospital)
   * - members of communities near the hospital that the requester chose to alert, who allow "nearby" alerts
   * Blood group, availability and eligibility are checked by the caller.
   */
  async donorIdsForRequest(requesterUserId: string, chosenCommunityIds: string[]) {
    const myCommunities = await prisma.communityMember.findMany({
      where: { userId: requesterUserId, status: 'active' },
      select: { communityId: true },
    });
    const mineIds = myCommunities.map((m) => m.communityId);
    const [fellows, nearby] = await Promise.all([
      mineIds.length
        ? prisma.communityMember.findMany({
            where: { communityId: { in: mineIds }, userId: { not: requesterUserId }, status: 'active', muted: false, alertFromMembers: true },
            select: { userId: true },
          })
        : Promise.resolve([]),
      chosenCommunityIds.length
        ? prisma.communityMember.findMany({
            where: { communityId: { in: chosenCommunityIds }, userId: { not: requesterUserId }, status: 'active', muted: false, isAlumni: false, alertNearby: true },
            select: { userId: true },
          })
        : Promise.resolve([]),
    ]);
    return [...new Set([...fellows, ...nearby].map((m) => m.userId))];
  }

  /** Keeps a request's chosen communities sensible: real, in the same state, at most 10 */
  async cleanChosenIds(ids: unknown, where: { country: string; state: string }) {
    if (!Array.isArray(ids) || !ids.length) return [];
    const list = [...new Set(ids.filter((x): x is string => typeof x === 'string'))].slice(0, 10);
    const found = await prisma.community.findMany({
      where: { id: { in: list }, country: where.country, state: where.state },
      select: { id: true },
    });
    return found.map((f) => f.id);
  }

  /**
   * Hourly: ask "Still at X?" after 6 months; no answer 30 days after asking -> stale (no alerts until confirmed).
   */
  async processReconfirmations(now = new Date()) {
    const askBefore = new Date(now.getTime() - RECONFIRM_AFTER_DAYS * DAY);
    const toAsk = await prisma.communityMember.findMany({
      where: { status: 'active', reconfirmAskedAt: null, confirmedAt: { lt: askBefore } },
      include: { community: { select: { name: true } } },
      take: 500,
    });
    for (const m of toAsk) {
      await prisma.notification.create({
        data: {
          recipientId: m.userId,
          notificationType: 'community_reconfirm',
          title: `Still at ${m.community.name}?`,
          message: `Please confirm you are still part of ${m.community.name}, or mark that you have moved. Otherwise we stop sending you its alerts in 30 days.`,
          relatedEntity: '/app/communities',
        },
      });
      await prisma.communityMember.update({ where: { id: m.id }, data: { reconfirmAskedAt: now } });
    }
    const staleBefore = new Date(now.getTime() - STALE_AFTER_ASK_DAYS * DAY);
    const stale = await prisma.communityMember.updateMany({
      where: { status: 'active', reconfirmAskedAt: { lt: staleBefore } },
      data: { status: 'stale' },
    });
    return { asked: toAsk.length, markedStale: stale.count };
  }
}

export const communityService = new CommunityService();
