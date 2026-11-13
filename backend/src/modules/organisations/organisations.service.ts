/**
 * Organisations v1: companies (and colleges, NGOs...) bring their people onto BloodNation.
 *
 * Rules
 * - ONE account per person. Joining a company adds a link (OrgMember) to the person's own account; leaving the
 *   job ends the link, never the account or its donation history.
 * - Proof of working there: a code sent to a work email on one of the company's domains.
 * - The company sees counts only. It never sees a named employee's blood group, eligibility, pauses or reasons.
 *   Small counts (below 3) are hidden.
 * - Requests are always personal. Membership only means colleagues who allow it are alerted too, and the request
 *   can count in the company's impact report if the employee allows it.
 * - New organisations must be verified by BloodNation staff before people can join.
 */
import crypto from 'crypto';
import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/types.js';
import { emailService } from '../../shared/email.service.js';
import { generateSecureOtp, hashToken } from '../../shared/password.js';
import { validateLocation } from '../../shared/location.js';
import { canBeAlerted } from '../eligibility/eligibility.rules.js';
import { safeCount } from '../communities/communities.service.js';
import { subscriptionService, CORPORATE_GRACE_DAYS } from '../subscriptions/subscriptions.service.js';

export const ORG_TYPES = ['company', 'college', 'ngo', 'hospital_group', 'other'] as const;
const CODE_TTL_MIN = 15;
const MAX_CODE_ATTEMPTS = 5;
const MAX_ORGS_PER_PERSON = 3;
const DAY = 24 * 60 * 60 * 1000;

/** Domains anyone can sign up for: never proof of working somewhere */
const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com',
  'rediffmail.com', 'proton.me', 'protonmail.com', 'aol.com', 'zoho.com', 'yandex.com', 'mail.com', 'gmx.com',
]);

/** Only for automated tests: the last code we generated (never set outside NODE_ENV=test) */
export const testHooks = { lastCode: '' };

const domainOf = (email: string) => email.trim().toLowerCase().split('@')[1] || '';
const parseDomains = (raw: string): string[] => {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};
const cleanDomain = (d: string) => d.trim().toLowerCase().replace(/^@/, '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
const isValidDomain = (d: string) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) && !FREE_MAIL.has(d);
const newInviteCode = () => crypto.randomBytes(5).toString('base64url').replace(/[-_]/g, 'X').toUpperCase().slice(0, 8);

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
  reachCorporate: true,
} as const;

type Org = {
  id: string; name: string; type: string; emailDomains: string; inviteCode: string; city: string; state: string;
  district: string; country: string; verified: boolean; plan: string; createdAt: Date;
};

const publicOrg = (o: Org) => ({
  id: o.id,
  name: o.name,
  type: o.type,
  city: o.city,
  district: o.district,
  state: o.state,
  verified: o.verified,
  emailDomains: parseDomains(o.emailDomains),
});

export interface RegisterOrgInput {
  name: string;
  type: (typeof ORG_TYPES)[number];
  workEmail: string;
  emailDomains?: string[];
  country?: string;
  state: string;
  district: string;
  city: string;
}

export class OrganisationService {
  // ---------- For everyone ----------

  /** My organisations (only shown in the app when I have at least one) */
  async mine(userId: string) {
    const rows = await prisma.orgMember.findMany({
      where: { userId, status: { in: ['pending_email', 'active'] } },
      include: { org: true },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map((m) => ({
      ...publicOrg(m.org),
      membership: { role: m.role, status: m.status, workEmail: m.workEmail, countInImpact: m.countInImpact, joinedAt: m.joinedAt },
      ...(m.role === 'admin' ? { inviteCode: m.org.inviteCode } : {}),
    }));
  }

  /** Find an organisation by its invite code (to join) */
  async byInviteCode(code: string) {
    const o = await prisma.organization.findUnique({ where: { inviteCode: code.trim().toUpperCase() } });
    if (!o) throw new AppError('No organisation with this code. Check the code with your HR team.', 404, 'NOT_FOUND');
    return publicOrg(o);
  }

  /**
   * Register a new organisation. The person becomes its first admin once their work email is checked.
   * BloodNation staff verify the organisation before others can join.
   */
  async register(userId: string, input: RegisterOrgInput) {
    const workEmail = input.workEmail.trim().toLowerCase();
    const mainDomain = domainOf(workEmail);
    if (!isValidDomain(mainDomain)) {
      throw new AppError('Use your work email (not Gmail, Yahoo, Outlook...).', 400, 'VALIDATION_FAILED', { workEmail: 'Use your work email address.' });
    }
    const extra = (input.emailDomains || []).map(cleanDomain).filter(Boolean);
    const bad = extra.find((d) => !isValidDomain(d));
    if (bad) throw new AppError(`"${bad}" can't be used as a work email domain.`, 400, 'VALIDATION_FAILED');
    const domains = [...new Set([mainDomain, ...extra])].slice(0, 5);
    const loc = validateLocation({ country: input.country || 'IN', state: input.state, district: input.district, city: input.city }, { requireCity: true });

    // One organisation per domain, so a company can't be registered twice
    const all = await prisma.organization.findMany({ select: { emailDomains: true, name: true } });
    const clash = all.find((o) => parseDomains(o.emailDomains).some((d) => domains.includes(d)));
    if (clash) {
      throw new AppError(`${clash.name} is already on BloodNation. Ask your HR team for its invite code.`, 409, 'ALREADY_EXISTS');
    }
    await this.checkMembershipLimit(userId);

    let inviteCode = newInviteCode();
    while (await prisma.organization.findUnique({ where: { inviteCode } })) inviteCode = newInviteCode();
    const org = await prisma.organization.create({
      data: {
        name: input.name.trim().replace(/\s+/g, ' '),
        type: input.type,
        emailDomains: JSON.stringify(domains),
        inviteCode,
        country: loc.country,
        state: loc.state,
        district: loc.district,
        city: loc.city,
        createdById: userId,
      },
    });
    const member = await prisma.orgMember.create({ data: { orgId: org.id, userId, role: 'admin', workEmail } });
    await this.sendCode(member.id, workEmail, org.name);
    return { org: publicOrg(org), inviteCode, membership: { status: 'pending_email', workEmail } };
  }

  /** Join with an invite code and a work email; a code is sent to the work email */
  async join(userId: string, inviteCode: string, workEmailRaw: string, employeeId?: string) {
    const o = await prisma.organization.findUnique({ where: { inviteCode: inviteCode.trim().toUpperCase() } });
    if (!o) throw new AppError('No organisation with this code. Check the code with your HR team.', 404, 'NOT_FOUND');
    if (!o.verified) throw new AppError(`${o.name} is waiting for BloodNation to verify it. Please try again in a day or two.`, 400, 'ORG_NOT_VERIFIED');
    const workEmail = workEmailRaw.trim().toLowerCase();
    if (!parseDomains(o.emailDomains).includes(domainOf(workEmail))) {
      throw new AppError(`Use your ${o.name} work email (${parseDomains(o.emailDomains).map((d) => '@' + d).join(', ')}).`, 400, 'VALIDATION_FAILED', {
        workEmail: 'This is not a work email of this organisation.',
      });
    }
    // The same work email can belong to only one person
    const taken = await prisma.orgMember.findFirst({ where: { workEmail, status: 'active', userId: { not: userId } } });
    if (taken) throw new AppError('This work email is already linked to another BloodNation account.', 409, 'ALREADY_EXISTS');

    const existing = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId: o.id, userId } } });
    if (existing?.status === 'active') return this.mine(userId);
    if (!existing) await this.checkMembershipLimit(userId);
    const member = existing
      ? await prisma.orgMember.update({
          where: { id: existing.id },
          data: { workEmail, employeeId: employeeId?.trim() || null, status: 'pending_email', leftAt: null },
        })
      : await prisma.orgMember.create({ data: { orgId: o.id, userId, workEmail, employeeId: employeeId?.trim() || null } });
    await this.sendCode(member.id, workEmail, o.name);
    return { pending: true, workEmail, org: publicOrg(o) };
  }

  /** Enter the code from the work email */
  async verifyEmail(userId: string, orgId: string, code: string) {
    const m = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } });
    if (!m || m.status !== 'pending_email' || !m.codeHash || !m.codeExpiresAt) {
      throw new AppError('There is no code waiting. Ask for a new one.', 400, 'NO_CODE');
    }
    if (m.codeExpiresAt < new Date()) throw new AppError('The code has expired. Ask for a new one.', 400, 'OTP_EXPIRED');
    if (m.codeAttempts >= MAX_CODE_ATTEMPTS) throw new AppError('Too many wrong codes. Ask for a new one.', 400, 'TOO_MANY_ATTEMPTS');
    if (hashToken(code.trim()) !== m.codeHash) {
      await prisma.orgMember.update({ where: { id: m.id }, data: { codeAttempts: { increment: 1 } } });
      throw new AppError('Wrong code. Please check the email and try again.', 400, 'INVALID_OTP');
    }
    await prisma.orgMember.update({
      where: { id: m.id },
      data: { status: 'active', workEmailVerifiedAt: new Date(), codeHash: null, codeExpiresAt: null, codeAttempts: 0, coverageEndsAt: null, exitSource: null },
    });
    // A company that pays for its people: their own paid plan ends today, unused days refunded
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, verified: true, plan: true } });
    if (org?.verified && org.plan === 'paid') {
      await subscriptionService.endPersonalPlansForCompany(userId, org.name).catch(() => undefined);
    }
    return this.mine(userId);
  }

  async resendCode(userId: string, orgId: string) {
    const m = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } }, include: { org: true } });
    if (!m || m.status !== 'pending_email') throw new AppError('Nothing to verify.', 400, 'NO_CODE');
    await this.sendCode(m.id, m.workEmail, m.org.name);
    return { sent: true };
  }

  async leave(userId: string, orgId: string) {
    const m = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } });
    if (!m) return this.mine(userId);
    if (m.role === 'admin' && m.status === 'active') {
      const otherAdmins = await prisma.orgMember.count({ where: { orgId, role: 'admin', status: 'active', userId: { not: userId } } });
      if (!otherAdmins) throw new AppError('Make someone else an admin before you leave.', 400, 'LAST_ADMIN');
    }
    await this.recordExit(m.id, new Date(), 'self');
    return this.mine(userId);
  }

  /**
   * The person stopped working here (they left, the admin removed them, or HR sent the exit).
   * Company-paid Donor Circle stays free for 30 days after the exit date; the person is told and reminded.
   * Their own family, pledges and Donor Circle are never touched: they belong to the person.
   */
  async recordExit(memberId: string, exitDate: Date, source: 'self' | 'org_admin' | 'hr_upload') {
    const m = await prisma.orgMember.findUnique({ where: { id: memberId }, include: { org: true } });
    if (!m || m.status === 'left') return m;
    const companyPaid = m.status === 'active' && m.org.verified && m.org.plan === 'paid';
    const coverageEndsAt = companyPaid ? new Date(exitDate.getTime() + CORPORATE_GRACE_DAYS * DAY) : null;
    await prisma.orgMember.update({
      where: { id: m.id },
      data: { status: 'left', leftAt: exitDate, role: 'member', exitSource: source, coverageEndsAt },
    });
    await prisma.auditLog
      .create({ data: { action: 'ORG_MEMBER_EXIT', entityType: 'OrgMember', entityId: m.id, details: JSON.stringify({ source, exitDate, coverageEndsAt }) } })
      .catch(() => undefined);
    if (coverageEndsAt && coverageEndsAt > new Date()) {
      const stillCovered = (await subscriptionService.getActive(m.userId)) || (await subscriptionService.companyCoverage(m.userId))?.kind === 'company';
      if (!stillCovered) {
        await prisma.notification.create({
          data: {
            recipientId: m.userId,
            notificationType: 'system',
            title: `${m.org.name} no longer pays for your Donor Circle`,
            message: `Your Donor Circle stays free for ${CORPORATE_GRACE_DAYS} days, until ${coverageEndsAt.toDateString()}. Renew before then to keep your family's donors unlocked. If you join another company on BloodNation that pays for its people, it continues free.`,
            relatedEntity: '/app/subscribe',
          },
        });
      }
    }
    return m;
  }

  /**
   * HR tells us who left (one person or a pasted CSV): work email or employee ID, and the last working day.
   * Only for the organisation's admins. Returns a result for each row; nothing about other people.
   */
  async hrExits(userId: string, orgId: string, rows: { key: string; exitDate: string }[]) {
    await this.requireOrgAdmin(userId, orgId);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const results: { key: string; result: 'done' | 'not_found' | 'already_left' | 'bad_date' | 'yourself' }[] = [];
    for (const row of rows.slice(0, 2000)) {
      const key = (row.key || '').trim();
      const d = new Date(row.exitDate);
      if (!key) continue;
      if (isNaN(d.getTime()) || d > today || d.getFullYear() < 2000) {
        results.push({ key, result: 'bad_date' });
        continue;
      }
      const m = await prisma.orgMember.findFirst({
        where: { orgId, OR: [{ workEmail: key.toLowerCase() }, { employeeId: key }] },
        orderBy: { joinedAt: 'desc' },
      });
      if (!m) results.push({ key, result: 'not_found' });
      else if (m.userId === userId) results.push({ key, result: 'yourself' });
      else if (m.status === 'left') results.push({ key, result: 'already_left' });
      else {
        await this.recordExit(m.id, d, 'hr_upload');
        results.push({ key, result: 'done' });
      }
    }
    return {
      results,
      done: results.filter((r) => r.result === 'done').length,
      problems: results.filter((r) => r.result !== 'done').length,
    };
  }

  async setCountInImpact(userId: string, orgId: string, value: boolean) {
    await prisma.orgMember.updateMany({ where: { orgId, userId }, data: { countInImpact: value } });
    return this.mine(userId);
  }

  /** "Alert my colleagues" is only offered when the requester is an active member of a verified organisation */
  async myActiveOrgs(userId: string) {
    const rows = await prisma.orgMember.findMany({
      where: { userId, status: 'active', org: { verified: true } },
      include: { org: true },
    });
    return rows.map((m) => m.org);
  }

  // ---------- Matching ----------

  /** Keep only organisations the requester really belongs to */
  async cleanAlertOrgIds(userId: string, ids: unknown) {
    if (!Array.isArray(ids) || !ids.length) return [];
    const mine = await this.myActiveOrgs(userId);
    return mine.filter((o) => ids.includes(o.id)).map((o) => o.id);
  }

  /** Colleagues (active members who allow corporate alerts) of the chosen organisations, except the requester */
  async colleagueIds(requesterUserId: string, orgIds: string[]) {
    if (!orgIds.length) return [];
    const rows = await prisma.orgMember.findMany({
      where: {
        orgId: { in: orgIds },
        status: 'active',
        userId: { not: requesterUserId },
        user: { status: 'active', donorProfile: { reachCorporate: true } },
      },
      select: { userId: true },
    });
    return [...new Set(rows.map((r) => r.userId))];
  }

  // ---------- Organisation admin ----------

  private async requireOrgAdmin(userId: string, orgId: string) {
    const m = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } }, include: { org: true } });
    if (!m || m.role !== 'admin' || m.status !== 'active') {
      throw new AppError('Only this organisation’s admins can do this.', 403, 'FORBIDDEN');
    }
    return m.org;
  }

  /** Counts only. Never names together with health information. */
  async dashboard(userId: string, orgId: string) {
    const org = await this.requireOrgAdmin(userId, orgId);
    const members = await prisma.orgMember.findMany({
      where: { orgId, status: 'active' },
      select: {
        userId: true,
        countInImpact: true,
        user: { select: { dateOfBirth: true, donorProfile: { select: ELIGIBILITY_SELECT } } },
      },
    });
    const donors = members.filter((m) => m.user.donorProfile);
    const byGroup: Record<string, number> = {};
    let readyNow = 0;
    for (const m of donors) {
      const p = m.user.donorProfile!;
      byGroup[p.bloodGroup] = (byGroup[p.bloodGroup] || 0) + 1;
      if (p.isAvailable && p.reachCorporate && canBeAlerted({ ...p, dateOfBirth: m.user.dateOfBirth })) readyNow++;
    }
    const since = new Date(Date.now() - 90 * DAY);
    const impactIds = members.filter((m) => m.countInImpact).map((m) => m.userId);
    const memberIds = members.map((m) => m.userId);
    const [requests, fulfilled, colleagueHelps, pending, remote] = await Promise.all([
      prisma.bloodRequest.count({ where: { requesterUserId: { in: impactIds }, createdAt: { gte: since } } }),
      prisma.bloodRequest.count({ where: { requesterUserId: { in: impactIds }, createdAt: { gte: since }, status: 'fulfilled' } }),
      prisma.requestResponse.count({
        where: { donorUserId: { in: memberIds }, status: { in: ['accepted', 'donated'] }, createdAt: { gte: since } },
      }),
      prisma.orgMember.count({ where: { orgId, status: 'pending_email' } }),
      prisma.remoteDonation.count({ where: { donorUserId: { in: memberIds }, status: 'confirmed', confirmedAt: { gte: since } } }),
    ]);
    return {
      org: { ...publicOrg(org), inviteCode: org.inviteCode, plan: org.plan },
      people: { members: members.length, donors: donors.length, waitingForEmailCheck: pending },
      readyToDonateNow: safeCount(readyNow),
      bloodGroups: Object.fromEntries(Object.entries(byGroup).map(([g, n]) => [g, safeCount(n)])),
      last90Days: { requests, fulfilled, colleagueHelps, remoteDonations: remote },
    };
  }

  /** Member list for HR: names and work emails only (no health information) */
  async members(userId: string, orgId: string) {
    await this.requireOrgAdmin(userId, orgId);
    const rows = await prisma.orgMember.findMany({
      where: { orgId, status: { in: ['active', 'pending_email'] } },
      include: { user: { select: { fullName: true, username: true } } },
      orderBy: { joinedAt: 'desc' },
      take: 2000,
    });
    return rows.map((m) => ({
      id: m.id,
      name: m.user.fullName || m.user.username || '—',
      workEmail: m.workEmail,
      employeeId: m.employeeId,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
    }));
  }

  /** Remove someone who left the company, or make someone an admin */
  async updateMember(userId: string, orgId: string, memberId: string, change: { role?: 'member' | 'admin'; remove?: boolean }) {
    await this.requireOrgAdmin(userId, orgId);
    const m = await prisma.orgMember.findUnique({ where: { id: memberId } });
    if (!m || m.orgId !== orgId) throw new AppError('Member not found.', 404, 'NOT_FOUND');
    if (change.remove) {
      if (m.userId === userId) throw new AppError('Use "Leave" to remove yourself.', 400, 'VALIDATION_FAILED');
      await this.recordExit(m.id, new Date(), 'org_admin');
    } else if (change.role) {
      if (m.status !== 'active') throw new AppError('Only people who checked their work email can be admins.', 400, 'VALIDATION_FAILED');
      if (change.role === 'member' && m.role === 'admin') {
        const otherAdmins = await prisma.orgMember.count({ where: { orgId, role: 'admin', status: 'active', id: { not: m.id } } });
        if (!otherAdmins) throw new AppError('An organisation needs at least one admin.', 400, 'LAST_ADMIN');
      }
      await prisma.orgMember.update({ where: { id: m.id }, data: { role: change.role } });
    }
    return this.members(userId, orgId);
  }

  /** Announcement or donation camp, sent to members who allow corporate alerts */
  async announce(userId: string, orgId: string, input: { kind: 'announcement' | 'camp'; title: string; body: string; campDate?: string; place?: string }) {
    const org = await this.requireOrgAdmin(userId, orgId);
    if (!org.verified) throw new AppError('Your organisation must be verified by BloodNation first.', 400, 'ORG_NOT_VERIFIED');
    const recent = await prisma.orgAnnouncement.count({ where: { orgId, createdAt: { gte: new Date(Date.now() - DAY) } } });
    if (recent >= 5) throw new AppError('You can send up to 5 announcements a day.', 429, 'TOO_MANY_REQUESTS');
    const recipients = await prisma.orgMember.findMany({
      where: {
        orgId,
        status: 'active',
        userId: { not: userId },
        // People without a donor profile still get announcements; donors only if they allow corporate alerts
        OR: [{ user: { donorProfile: null } }, { user: { donorProfile: { reachCorporate: true } } }],
      },
      select: { userId: true },
    });
    const a = await prisma.orgAnnouncement.create({
      data: {
        orgId,
        authorId: userId,
        kind: input.kind,
        title: input.title.trim(),
        body: input.body.trim(),
        campDate: input.campDate ? new Date(input.campDate) : null,
        place: input.place?.trim() || null,
        sentTo: recipients.length,
      },
    });
    if (recipients.length) {
      await prisma.notification.createMany({
        data: recipients.map((r) => ({
          recipientId: r.userId,
          notificationType: input.kind === 'camp' ? 'org_camp' : 'org_announcement',
          title: `${org.name}: ${a.title}`,
          message: [a.body, a.place ? `Where: ${a.place}` : '', a.campDate ? `When: ${a.campDate.toDateString()}` : ''].filter(Boolean).join(' · '),
          relatedEntity: '/app/organisations',
        })),
      });
    }
    return { id: a.id, sentTo: recipients.length };
  }

  async announcements(userId: string, orgId: string) {
    const m = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } });
    if (!m || m.status !== 'active') throw new AppError('You are not a member of this organisation.', 403, 'FORBIDDEN');
    return prisma.orgAnnouncement.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, kind: true, title: true, body: true, campDate: true, place: true, createdAt: true, sentTo: m.role === 'admin' },
    });
  }

  // ---------- BloodNation staff ----------

  async adminList() {
    const orgs = await prisma.organization.findMany({
      orderBy: [{ verified: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { members: { where: { status: 'active' } } } } },
      take: 500,
    });
    return orgs.map((o) => ({ ...publicOrg(o), plan: o.plan, inviteCode: o.inviteCode, members: o._count.members, createdAt: o.createdAt }));
  }

  async adminUpdate(adminId: string, orgId: string, change: { verified?: boolean; plan?: string; emailDomains?: string[] }) {
    const domains = change.emailDomains?.map(cleanDomain).filter(Boolean);
    if (domains?.some((d) => !isValidDomain(d))) throw new AppError('One of the domains is not valid.', 400, 'VALIDATION_FAILED');
    const o = await prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(typeof change.verified === 'boolean' && { verified: change.verified }),
        ...(change.plan && { plan: change.plan }),
        ...(domains?.length && { emailDomains: JSON.stringify([...new Set(domains)]) }),
      },
    });
    await prisma.auditLog
      .create({ data: { actorId: adminId, action: 'ORG_UPDATED', entityType: 'Organization', entityId: orgId, details: JSON.stringify(change) } })
      .catch(() => undefined);
    // The company now pays for its people: members' own paid plans end today, unused days refunded
    if (o.verified && o.plan === 'paid' && (change.plan === 'paid' || change.verified === true)) {
      const members = await prisma.orgMember.findMany({ where: { orgId, status: 'active' }, select: { userId: true } });
      for (const mm of members) await subscriptionService.endPersonalPlansForCompany(mm.userId, o.name).catch(() => undefined);
    }
    return publicOrg(o);
  }

  // ---------- Helpers ----------

  private async checkMembershipLimit(userId: string) {
    const n = await prisma.orgMember.count({ where: { userId, status: { in: ['active', 'pending_email'] } } });
    if (n >= MAX_ORGS_PER_PERSON) throw new AppError(`You can be in up to ${MAX_ORGS_PER_PERSON} organisations.`, 400, 'LIMIT_REACHED');
  }

  private async sendCode(memberId: string, workEmail: string, orgName: string) {
    const code = generateSecureOtp();
    if (process.env.NODE_ENV === 'test') testHooks.lastCode = code;
    await prisma.orgMember.update({
      where: { id: memberId },
      data: { codeHash: hashToken(code), codeExpiresAt: new Date(Date.now() + CODE_TTL_MIN * 60 * 1000), codeAttempts: 0 },
    });
    await emailService.sendOtpEmail(workEmail, code, `join ${orgName}`).catch(() => false);
  }
}

export const organisationService = new OrganisationService();
