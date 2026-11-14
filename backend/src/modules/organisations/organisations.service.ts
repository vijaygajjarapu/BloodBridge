/**
 * Organisations v1: companies (and colleges, NGOs...) bring their people onto BloodNation.
 *
 * Rules
 * - ONE account per person. Joining a company adds a link (OrgMember) to the person's own account; leaving the
 *   job ends the link, never the account or its donation history. People sign in with their personal mobile.
 * - The company decides who is eligible, not the employee (like Headspace / Cult.fit for work):
 *   BloodNation staff add the company after the contract and name its HR admin; HR uploads the employee list
 *   (employee ID + date of birth, optional work email). An employee links by matching a row (ID + date of birth),
 *   or with a code sent to the work email on their row. Employees cannot create a company on their own.
 * - Being removed from the list counts as leaving the company.
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
/** Wrong employee ID / date of birth / work email tries allowed per person per day (stops guessing) */
const MAX_LINK_FAILS_PER_DAY = 5;
const MAX_LIST_ROWS = 5000;
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
const normId = (v: string) => v.trim().toUpperCase().replace(/\s+/g, '');
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Date of birth as HR files usually have it: 1990-02-28, 28-02-1990, 28/02/1990 or 28.02.1990 (day first) */
export function parseDob(raw: string): Date | null {
  const v = (raw || '').trim();
  let y: number, m: number, d: number;
  let r = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(v);
  if (r) [y, m, d] = [+r[1], +r[2], +r[3]];
  else if ((r = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(v))) [d, m, y] = [+r[1], +r[2], +r[3]];
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  const age = (Date.now() - dt.getTime()) / (365.25 * DAY);
  if (age < 14 || age > 100) return null;
  return dt;
}

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

export interface CompanyRequestInput {
  name: string;
  type: (typeof ORG_TYPES)[number];
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  country?: string;
  state: string;
  district: string;
  city: string;
}

export interface EligibilityRowInput {
  employeeId: string;
  dateOfBirth: string;
  workEmail?: string;
}

type LinkInput =
  | { inviteCode: string; method: 'employee_id'; employeeId: string; dateOfBirth: string }
  | { inviteCode: string; method: 'work_email'; workEmail: string };

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
      membership: { role: m.role, status: m.status, workEmail: m.workEmail, employeeId: m.employeeId, countInImpact: m.countInImpact, joinedAt: m.joinedAt },
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
   * "Bring BloodNation to my company": anyone can ask, but it only records the request and who to contact.
   * Nobody becomes an admin and nobody can link until the company signs the contract and staff verify it.
   */
  async requestCompany(userId: string, input: CompanyRequestInput) {
    const contactEmail = input.contactEmail.trim().toLowerCase();
    const loc = validateLocation({ country: input.country || 'IN', state: input.state, district: input.district, city: input.city }, { requireCity: true });
    const recent = await prisma.organization.count({ where: { createdById: userId, createdAt: { gte: new Date(Date.now() - DAY) } } });
    if (recent >= 3) throw new AppError('You can send up to 3 company requests a day.', 429, 'TOO_MANY_REQUESTS');
    // A company already on BloodNation (same work email domain): ask HR for the code instead
    const domain = domainOf(contactEmail);
    if (domain && !FREE_MAIL.has(domain)) {
      const all = await prisma.organization.findMany({ select: { emailDomains: true, name: true } });
      const clash = all.find((o) => parseDomains(o.emailDomains).includes(domain));
      if (clash) throw new AppError(`${clash.name} is already on BloodNation. Ask your HR team for its company code.`, 409, 'ALREADY_EXISTS');
    }
    let inviteCode = newInviteCode();
    while (await prisma.organization.findUnique({ where: { inviteCode } })) inviteCode = newInviteCode();
    const org = await prisma.organization.create({
      data: {
        name: input.name.trim().replace(/\s+/g, ' '),
        type: input.type,
        emailDomains: JSON.stringify(domain && isValidDomain(domain) ? [domain] : []),
        inviteCode,
        country: loc.country,
        state: loc.state,
        district: loc.district,
        city: loc.city,
        createdById: userId,
        contactName: input.contactName.trim(),
        contactEmail,
        contactPhone: input.contactPhone?.trim() || null,
      },
    });
    await prisma.auditLog
      .create({ data: { actorId: userId, action: 'ORG_REQUESTED', entityType: 'Organization', entityId: org.id, details: JSON.stringify({ name: org.name }) } })
      .catch(() => undefined);
    return { requested: true, org: publicOrg(org) };
  }

  /**
   * Link my company to my personal account, using what HR put on the employee list:
   * - employee ID + date of birth: linked at once when they match an eligible row
   * - work email: a code goes to the work email on the row; linked once the code is entered
   * Wrong details give the same message whichever part was wrong, and only 5 wrong tries a day are allowed.
   */
  async link(userId: string, input: LinkInput) {
    const o = await prisma.organization.findUnique({ where: { inviteCode: input.inviteCode.trim().toUpperCase() } });
    if (!o) throw new AppError('No company with this code. Check the code with your HR team.', 404, 'NOT_FOUND');
    if (!o.verified) throw new AppError(`${o.name} hasn't finished joining BloodNation yet. Please try again later.`, 400, 'ORG_NOT_VERIFIED');
    const fails = await prisma.auditLog.count({ where: { actorId: userId, action: 'ORG_LINK_FAILED', createdAt: { gte: new Date(Date.now() - DAY) } } });
    if (fails >= MAX_LINK_FAILS_PER_DAY) {
      throw new AppError('Too many tries today. Please check your details with your HR team and try again tomorrow.', 429, 'TOO_MANY_ATTEMPTS');
    }
    const noMatch = async () => {
      await prisma.auditLog
        .create({ data: { actorId: userId, action: 'ORG_LINK_FAILED', entityType: 'Organization', entityId: o.id, details: JSON.stringify({ method: input.method }) } })
        .catch(() => undefined);
      return new AppError(`We couldn't find these details on ${o.name}'s employee list. Check them with your HR team.`, 400, 'NOT_ON_LIST');
    };

    const row =
      input.method === 'employee_id'
        ? await prisma.orgEligibility.findUnique({ where: { orgId_employeeId: { orgId: o.id, employeeId: normId(input.employeeId) } } })
        : await prisma.orgEligibility.findFirst({ where: { orgId: o.id, workEmail: input.workEmail.trim().toLowerCase() } });
    if (!row || row.status !== 'eligible') throw await noMatch();
    if (input.method === 'employee_id') {
      const dob = parseDob(input.dateOfBirth);
      if (!dob || ymd(dob) !== ymd(row.dateOfBirth)) throw await noMatch();
    }
    await this.refuseIfRowTaken(row, userId, o.name);

    const existing = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId: o.id, userId } } });
    if (existing?.status === 'active') return this.mine(userId);
    if (!existing || existing.status === 'left') await this.checkMembershipLimit(userId);

    if (input.method === 'work_email') {
      const workEmail = row.workEmail!;
      const data = { workEmail, employeeId: row.employeeId, status: 'pending_email', leftAt: null };
      const member = existing
        ? await prisma.orgMember.update({ where: { id: existing.id }, data })
        : await prisma.orgMember.create({ data: { orgId: o.id, userId, ...data } });
      await this.sendCode(member.id, workEmail, o.name);
      return { pending: true, workEmail, org: publicOrg(o) };
    }
    await this.activate(o, userId, row);
    return this.mine(userId);
  }

  /** Old route: join with a work email. Now it only works when that work email is on the company's employee list. */
  async join(userId: string, inviteCode: string, workEmail: string) {
    return this.link(userId, { inviteCode, method: 'work_email', workEmail });
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
    // Still on the employee list (HR may have removed them since the code was sent)
    const row = await prisma.orgEligibility.findFirst({ where: { orgId, workEmail: m.workEmail, status: 'eligible' } });
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    if (!row) throw new AppError(`This work email is no longer on ${org.name}'s employee list. Check with your HR team.`, 400, 'NOT_ON_LIST');
    await this.refuseIfRowTaken(row, userId, org.name);
    await this.activate(org, userId, row);
    return this.mine(userId);
  }

  /** One row of the employee list belongs to one BloodNation account */
  private async refuseIfRowTaken(row: { orgId: string; linkedUserId: string | null }, userId: string, orgName: string) {
    if (!row.linkedUserId || row.linkedUserId === userId) return;
    const other = await prisma.orgMember.findFirst({ where: { orgId: row.orgId, userId: row.linkedUserId, status: { in: ['active', 'pending_email'] } } });
    if (other) {
      throw new AppError(`These details are already linked to another BloodNation account. Ask ${orgName}'s HR team.`, 409, 'ALREADY_EXISTS');
    }
  }

  /** Linked: active member from now; a company that pays shows "Welcome to Corporate Donor Circle" (nothing refunded) */
  private async activate(o: { id: string; name: string; verified: boolean; plan: string }, userId: string, row: { id: string; employeeId: string; workEmail: string | null }) {
    const data = {
      status: 'active',
      employeeId: row.employeeId,
      workEmail: row.workEmail || '',
      workEmailVerifiedAt: new Date(), // the date they linked the company
      leftAt: null,
      coverageEndsAt: null,
      exitSource: null,
      codeHash: null,
      codeExpiresAt: null,
      codeAttempts: 0,
    };
    const existing = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId: o.id, userId } } });
    if (existing) await prisma.orgMember.update({ where: { id: existing.id }, data });
    else await prisma.orgMember.create({ data: { orgId: o.id, userId, ...data } });
    await prisma.orgEligibility.update({ where: { id: row.id }, data: { linkedUserId: userId, linkedAt: new Date() } });
    if (o.verified && o.plan === 'paid') await subscriptionService.welcomeCorporate(userId, o.id, o.name).catch(() => undefined);
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
    // HR may report late: the 30 free days never start before the person linked to the company on BloodNation
    const graceStart = Math.max(exitDate.getTime(), new Date(m.workEmailVerifiedAt || m.joinedAt).getTime());
    const coverageEndsAt = companyPaid ? new Date(graceStart + CORPORATE_GRACE_DAYS * DAY) : null;
    await prisma.orgMember.update({
      where: { id: m.id },
      data: { status: 'left', leftAt: exitDate, role: 'member', exitSource: source, coverageEndsAt },
    });
    // Left the company (HR or the admin said so): off the employee list too, so the details can't be used again.
    // Leaving by themselves keeps the row: they can link again while HR still lists them.
    if (source !== 'self') {
      await prisma.orgEligibility.updateMany({
        where: { orgId: m.orgId, status: 'eligible', OR: [{ linkedUserId: m.userId }, ...(m.employeeId ? [{ employeeId: m.employeeId }] : [])] },
        data: { status: 'removed', removedAt: new Date() },
      });
    }
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
        where: { orgId, OR: [{ workEmail: key.toLowerCase() }, { employeeId: key }, { employeeId: normId(key) }] },
        orderBy: { joinedAt: 'desc' },
      });
      if (!m) {
        // On the list but never linked on BloodNation: just take them off the list
        const r = await prisma.orgEligibility.updateMany({
          where: { orgId, status: 'eligible', OR: [{ employeeId: normId(key) }, { workEmail: key.toLowerCase() }] },
          data: { status: 'removed', removedAt: new Date() },
        });
        results.push({ key, result: r.count ? 'done' : 'not_found' });
      }
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
    const [onList, linkedFromList] = await Promise.all([
      prisma.orgEligibility.count({ where: { orgId, status: 'eligible' } }),
      prisma.orgEligibility.count({ where: { orgId, status: 'eligible', linkedUserId: { not: null } } }),
    ]);
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
      people: { members: members.length, donors: donors.length, waitingForEmailCheck: pending, onList, linkedFromList },
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

  /**
   * HR: the employee list (who the company covers). Rows: employee ID, date of birth, optional work email.
   * fullList = true means "this is everyone": people on the old list but not in this one have left the company
   * (their company-paid Donor Circle then stays free for 30 days, as with any exit).
   */
  async uploadEligibility(userId: string, orgId: string, rows: EligibilityRowInput[], fullList: boolean) {
    await this.requireOrgAdmin(userId, orgId);
    if (rows.length > MAX_LIST_ROWS) throw new AppError(`Up to ${MAX_LIST_ROWS} rows at a time.`, 400, 'VALIDATION_FAILED');
    const problems: { line: number; employeeId: string; reason: 'missing_id' | 'bad_date' | 'bad_email' | 'duplicate' }[] = [];
    const clean = new Map<string, { employeeId: string; dateOfBirth: Date; workEmail: string | null }>();
    const emails = new Set<string>();
    rows.forEach((r, i) => {
      const employeeId = normId(r.employeeId || '');
      const line = i + 1;
      if (!employeeId || employeeId.length > 40) return problems.push({ line, employeeId, reason: 'missing_id' });
      const dateOfBirth = parseDob(r.dateOfBirth);
      if (!dateOfBirth) return problems.push({ line, employeeId, reason: 'bad_date' });
      const workEmail = r.workEmail?.trim().toLowerCase() || null;
      if (workEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail)) return problems.push({ line, employeeId, reason: 'bad_email' });
      if (clean.has(employeeId) || (workEmail && emails.has(workEmail))) return problems.push({ line, employeeId, reason: 'duplicate' });
      if (workEmail) emails.add(workEmail);
      clean.set(employeeId, { employeeId, dateOfBirth, workEmail });
    });
    // A full list with mistakes would wrongly mark people as left: nothing is changed until it is clean
    if (fullList && problems.length) {
      return { added: 0, updated: 0, unchanged: 0, removed: 0, exits: 0, problems, applied: false };
    }

    const existing = await prisma.orgEligibility.findMany({ where: { orgId } });
    const byId = new Map(existing.map((e) => [e.employeeId, e]));
    let added = 0, updated = 0, unchanged = 0, removed = 0, exits = 0;
    for (const r of clean.values()) {
      const e = byId.get(r.employeeId);
      if (!e) {
        await prisma.orgEligibility.create({ data: { orgId, ...r } });
        added++;
      } else if (e.status !== 'eligible' || ymd(e.dateOfBirth) !== ymd(r.dateOfBirth) || (e.workEmail || null) !== r.workEmail) {
        await prisma.orgEligibility.update({ where: { id: e.id }, data: { ...r, status: 'eligible', removedAt: null } });
        updated++;
      } else unchanged++;
    }
    if (fullList) {
      const today = new Date();
      for (const e of existing.filter((x) => x.status === 'eligible' && !clean.has(x.employeeId))) {
        await prisma.orgEligibility.update({ where: { id: e.id }, data: { status: 'removed', removedAt: today } });
        removed++;
        if (!e.linkedUserId || e.linkedUserId === userId) continue;
        const m = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId: e.linkedUserId } } });
        if (m && m.status !== 'left') {
          await this.recordExit(m.id, today, 'hr_upload');
          exits++;
        }
      }
    }
    await prisma.auditLog
      .create({ data: { actorId: userId, action: 'ORG_LIST_UPLOADED', entityType: 'Organization', entityId: orgId, details: JSON.stringify({ fullList, added, updated, removed, exits, problems: problems.length }) } })
      .catch(() => undefined);
    return { added, updated, unchanged, removed, exits, problems, applied: true };
  }

  /** HR: the list they uploaded and who has linked (no health information, no dates of birth back) */
  async eligibility(userId: string, orgId: string) {
    await this.requireOrgAdmin(userId, orgId);
    const rows = await prisma.orgEligibility.findMany({ where: { orgId }, orderBy: [{ status: 'asc' }, { employeeId: 'asc' }], take: MAX_LIST_ROWS });
    return {
      onList: rows.filter((r) => r.status === 'eligible').length,
      linked: rows.filter((r) => r.status === 'eligible' && r.linkedUserId).length,
      removed: rows.filter((r) => r.status === 'removed').length,
      rows: rows.map((r) => ({ employeeId: r.employeeId, workEmail: r.workEmail, status: r.status, linked: !!r.linkedUserId, linkedAt: r.linkedAt, removedAt: r.removedAt })),
    };
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
    return orgs.map((o) => ({
      ...publicOrg(o),
      plan: o.plan,
      inviteCode: o.inviteCode,
      members: o._count.members,
      createdAt: o.createdAt,
      contact: { name: o.contactName, email: o.contactEmail, phone: o.contactPhone },
    }));
  }

  /**
   * After the contract: staff make the company's HR person its admin, using their BloodNation account
   * (email or mobile). Only an admin can upload the employee list.
   */
  async adminAddOrgAdmin(staffId: string, orgId: string, identifier: string) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new AppError('Organisation not found.', 404, 'NOT_FOUND');
    const id = identifier.trim();
    const digits = id.replace(/\D/g, '');
    const user = id.includes('@')
      ? await prisma.user.findUnique({ where: { email: id.toLowerCase() } })
      : await prisma.user.findFirst({ where: { phone: { endsWith: digits.slice(-10) } } });
    if (!user || (!id.includes('@') && digits.length < 10)) {
      throw new AppError('No BloodNation account with this email or mobile. Ask the HR person to sign up first.', 404, 'NOT_FOUND');
    }
    const existing = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId: user.id } } });
    const data = { role: 'admin', status: 'active', leftAt: null, coverageEndsAt: null, exitSource: null };
    if (existing) await prisma.orgMember.update({ where: { id: existing.id }, data: { ...data, workEmailVerifiedAt: existing.workEmailVerifiedAt || new Date() } });
    else await prisma.orgMember.create({ data: { orgId, userId: user.id, workEmail: org.contactEmail || '', workEmailVerifiedAt: new Date(), ...data } });
    await prisma.auditLog
      .create({ data: { actorId: staffId, action: 'ORG_ADMIN_ADDED', entityType: 'Organization', entityId: orgId, details: JSON.stringify({ userId: user.id }) } })
      .catch(() => undefined);
    if (org.verified && org.plan === 'paid') await subscriptionService.welcomeCorporate(user.id, orgId, org.name).catch(() => undefined);
    return { added: true, name: user.fullName || user.username || user.email };
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
    // The company now pays for its people: welcome every active member (nothing refunded)
    if (o.verified && o.plan === 'paid' && (change.plan === 'paid' || change.verified === true)) {
      const members = await prisma.orgMember.findMany({ where: { orgId, status: 'active' }, select: { userId: true } });
      for (const mm of members) await subscriptionService.welcomeCorporate(mm.userId, orgId, o.name).catch(() => undefined);
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
