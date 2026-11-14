/**
 * Corporate chain: a company that pays ("paid" plan) covers its people's personal Donor Circle.
 * - while they work there: free, and a personal plan they paid for ends with a pro-rata refund
 * - HR records the exit (or the admin removes them, or they leave): free for 30 days, reminders, then locked
 * - joining another paying company continues it; family, pledges and the circle stay the person's own
 * - colleagues are alerted on requests wherever they are
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { hashPassword } from '../src/shared/password.js';
import { signAccessToken } from '../src/shared/jwt.js';
import { subscriptionService } from '../src/modules/subscriptions/subscriptions.service.js';
import { requestService } from '../src/modules/requests/requests.service.js';

const api = '/api/v1';
const TAG = 'corptest';
const DAY = 24 * 60 * 60 * 1000;
const ids: Record<string, string> = {};
const auth: Record<string, Record<string, string>> = {};
const org: Record<string, string> = {};
const VIZAG = { state: 'Andhra Pradesh', district: 'Visakhapatnam', city: 'Visakhapatnam' };
const DELHI = { state: 'Delhi', district: 'New Delhi', city: 'New Delhi' };

async function makeUser(key: string, phone: string, place = VIZAG, group = 'O+') {
  const u = await prisma.user.create({
    data: {
      email: `${TAG}.${key}@example.org`,
      phone,
      fullName: `Corp ${key}`,
      passwordHash: await hashPassword('CorpTest123!'),
      isEmailVerified: true,
      dateOfBirth: new Date('1990-02-02'),
      createdAt: new Date('2025-01-01'),
      donorProfile: { create: { bloodGroup: group, country: 'IN', ...place, sex: 'male', weightKg: 70, isAvailable: true } },
    },
  });
  ids[key] = u.id;
  auth[key] = { Authorization: `Bearer ${signAccessToken({ userId: u.id, email: u.email, role: u.role })}` };
}

async function makeOrg(key: string, plan: 'paid' | 'pilot') {
  const o = await prisma.organization.create({
    data: { name: `Corp ${key} Ltd`, emailDomains: JSON.stringify([`${key}.corptest.in`]), inviteCode: `CORP${key.toUpperCase()}`, ...VIZAG, verified: true, plan },
  });
  org[key] = o.id;
}

const member = (orgKey: string, userKey: string, role = 'member', employeeId?: string) =>
  prisma.orgMember.create({
    data: { orgId: org[orgKey], userId: ids[userKey], role, status: 'active', workEmail: `${userKey}@${orgKey}.corptest.in`, workEmailVerifiedAt: new Date(), employeeId },
  });

beforeAll(async () => {
  await prisma.$connect();
  await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}.` } } });
  await prisma.organization.deleteMany({ where: { name: { startsWith: 'Corp ' } } });
  await makeUser('hr', '+919555000001');
  await makeUser('emp', '+919555000002');
  await makeUser('far', '+919555000003', DELHI, 'O-');
  await makeOrg('acme', 'paid');
  await makeOrg('beta', 'paid');
  await makeOrg('pilotco', 'pilot');
  await member('acme', 'hr', 'admin');
  await member('acme', 'far');
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}.` } } });
  await prisma.organization.deleteMany({ where: { name: { startsWith: 'Corp ' } } });
  await prisma.$disconnect();
});

describe('While working at a paying company', () => {
  it('already paying personally, then the company covers them: "Welcome to Corporate Donor Circle", nothing refunded', async () => {
    const startsAt = new Date(Date.now() - 300 * DAY);
    await prisma.subscription.create({
      data: { userId: ids.emp, amountPaise: 20000, status: 'active', provider: 'dev_simulated', startsAt, endsAt: new Date(startsAt.getTime() + 365 * DAY), autoRenew: true },
    });
    // Joins Acme: work email checked
    const { hashToken } = await import('../src/shared/password.js');
    await prisma.orgMember.create({
      data: { orgId: org.acme, userId: ids.emp, status: 'pending_email', workEmail: 'emp@acme.corptest.in', employeeId: 'EMP7', codeHash: hashToken('123456'), codeExpiresAt: new Date(Date.now() + 600000) },
    });
    const v = await request(app).post(`${api}/organisations/${org.acme}/verify-email`).set(auth.emp).send({ code: '123456' });
    expect(v.status).toBe(200);

    const sub = await prisma.subscription.findFirstOrThrow({ where: { userId: ids.emp } });
    expect(sub.status).toBe('active'); // kept on record, not ended
    expect(sub.refundPaise).toBeNull(); // nothing refunded
    expect(sub.autoRenew).toBe(false); // not charged again while the company pays
    expect(await prisma.notification.count({ where: { recipientId: ids.emp, title: 'Welcome to Corporate Donor Circle' } })).toBe(1);

    const mine = await request(app).get(`${api}/subscriptions/me`).set(auth.emp);
    expect(mine.body.active).toBe(true);
    expect(mine.body.company).toMatchObject({ kind: 'company', orgName: 'Corp acme Ltd' });

    // Their own plan runs out while they still work there
    await prisma.subscription.update({ where: { id: sub.id }, data: { endsAt: new Date(Date.now() - DAY) } });
  });

  it('signing up with an official email links them to that company once the email is verified', async () => {
    const { organisationService } = await import('../src/modules/organisations/organisations.service.js');
    // A free email is never proof of working somewhere
    expect(await organisationService.autoLinkByEmail(ids.emp, 'someone@gmail.com')).toEqual([]);
    const u2 = await prisma.user.create({
      data: { email: `${TAG}.newjoiner@acme.corptest.in`, phone: '+919555000010', fullName: 'Corp newjoiner', isEmailVerified: true, dateOfBirth: new Date('1991-01-01') },
    });
    const linked2 = await organisationService.autoLinkByEmail(u2.id, u2.email);
    expect(linked2).toEqual([org.acme]);
    expect((await subscriptionService.companyCoverage(u2.id))?.kind).toBe('company');
    expect(await prisma.notification.count({ where: { recipientId: u2.id, title: 'Welcome to Corporate Donor Circle' } })).toBe(1);
  });

  it('a pilot (unpaid) company does not cover anyone', async () => {
    await member('pilotco', 'hr');
    const cov = await subscriptionService.companyCoverage(ids.hr);
    expect(cov?.orgName).toBe('Corp acme Ltd'); // only the paying one
  });

  it('colleagues are alerted wherever they are (no state limit)', async () => {
    const r = await requestService.create(ids.hr, {
      patientName: 'Corp Patient', bloodGroup: 'O+', unitsNeeded: 1, hospitalName: 'King George Hospital', ...VIZAG,
      urgency: 'urgent', alertOrgIds: [org.acme],
    });
    await prisma.bloodRequest.update({ where: { id: r.id }, data: { onHold: false, verificationStatus: 'verified' } });
    await requestService.rankCandidates(r.id);
    const c = await prisma.requestCandidate.findFirst({ where: { requestId: r.id, donorUserId: ids.far } });
    expect(c?.source).toBe('colleague'); // O- in Delhi, hospital in Andhra Pradesh
  });
});

describe('Leaving the company', () => {
  it('HR records the exit (CSV rows): free for 30 days, the person is told; bad rows are reported', async () => {
    // The person is also in the circle: their family stays theirs
    await prisma.familyMember.create({ data: { ownerUserId: ids.emp, name: 'Corp Mother', relation: 'mother', bloodGroup: 'O+' } });
    const exitDate = new Date(Date.now() - 2 * DAY).toISOString().slice(0, 10);
    const res = await request(app)
      .post(`${api}/organisations/${org.acme}/exits`)
      .set(auth.hr)
      .send({ rows: [{ key: 'EMP7', exitDate }, { key: 'nobody@acme.corptest.in', exitDate }, { key: 'far@acme.corptest.in', exitDate: '2099-01-01' }] });
    expect(res.status).toBe(200);
    expect(res.body.done).toBe(1);
    expect(res.body.results.map((r: any) => r.result)).toEqual(['done', 'not_found', 'bad_date']);

    const m = await prisma.orgMember.findFirstOrThrow({ where: { userId: ids.emp, orgId: org.acme } });
    expect(m.status).toBe('left');
    expect(m.exitSource).toBe('hr_upload');
    // Linked today, exit reported 2 days back: the 30 days count from the link date
    expect(Math.round((m.coverageEndsAt!.getTime() - Date.now()) / DAY)).toBe(30);

    const cov = await subscriptionService.companyCoverage(ids.emp);
    expect(cov?.kind).toBe('grace');
    expect(await subscriptionService.isActive(ids.emp)).toBe(true);
    expect(await prisma.notification.count({ where: { recipientId: ids.emp, title: { contains: 'no longer pays' } } })).toBe(1);
    expect(await prisma.familyMember.count({ where: { ownerUserId: ids.emp } })).toBe(1);
  });

  it('reported late (exit date before they linked on BloodNation): the 30 free days start from the link date', async () => {
    const res = await request(app).post(`${api}/organisations/${org.acme}/exits`).set(auth.hr).send({ rows: [{ key: 'far@acme.corptest.in', exitDate: '2020-01-01' }] });
    expect(res.body.results[0].result).toBe('done');
    const m = await prisma.orgMember.findFirstOrThrow({ where: { userId: ids.far, orgId: org.acme } });
    expect(Math.round((m.coverageEndsAt!.getTime() - Date.now()) / DAY)).toBe(30);
    expect((await subscriptionService.companyCoverage(ids.far))?.kind).toBe('grace');
  });

  it('only the organisation admin can record exits', async () => {
    const res = await request(app).post(`${api}/organisations/${org.acme}/exits`).set(auth.far).send({ rows: [{ key: 'EMP7', exitDate: '2026-01-01' }] });
    expect(res.status).toBe(403);
  });

  it('reminders before the end, then "locked" once; the family is kept', async () => {
    const m = await prisma.orgMember.findFirstOrThrow({ where: { userId: ids.emp, orgId: org.acme } });
    await prisma.orgMember.update({ where: { id: m.id }, data: { coverageEndsAt: new Date(Date.now() + 6 * DAY) } });
    await subscriptionService.processCorporateGrace();
    await subscriptionService.processCorporateGrace();
    expect(await prisma.notification.count({ where: { recipientId: ids.emp, title: 'Donor Circle: 7 days left to renew' } })).toBe(1);

    await prisma.orgMember.update({ where: { id: m.id }, data: { coverageEndsAt: new Date(Date.now() - 60_000) } });
    await subscriptionService.processCorporateGrace();
    await subscriptionService.processCorporateGrace();
    expect(await prisma.notification.count({ where: { recipientId: ids.emp, title: 'Your Donor Circle is locked' } })).toBe(1);
    expect(await subscriptionService.isActive(ids.emp)).toBe(false);
    expect(await prisma.familyMember.count({ where: { ownerUserId: ids.emp } })).toBe(1);
  });

  it('locked: two ways to unlock (locked days pro rata + 1 year, or ₹120 + GST to the yearly date)', async () => {
    const m = await prisma.orgMember.findFirstOrThrow({ where: { userId: ids.emp, orgId: org.acme } });
    await prisma.orgMember.update({ where: { id: m.id }, data: { coverageEndsAt: new Date(Date.now() - 73 * DAY - 3600_000) } });
    const q = await subscriptionService.unlockQuote(ids.emp);
    expect(q?.lockedDays).toBe(73);
    const prorated = q!.options.find((o) => o.id === 'prorated')!;
    expect(prorated.amountPaise).toBe(24000); // 73/365 of ₹200 = ₹40, + ₹200
    expect(Math.round((new Date(prorated.endsAt).getTime() - Date.now()) / DAY)).toBeGreaterThanOrEqual(364);
    const anniversary = q!.options.find((o) => o.id === 'anniversary')!;
    expect(anniversary.amountPaise).toBe(14160); // ₹120 + 18% GST
    // Their yearly date: first paid 300 days ago, so about 65 days from now
    const daysToAnniversary = Math.round((new Date(anniversary.endsAt).getTime() - Date.now()) / DAY);
    expect(daysToAnniversary).toBeGreaterThanOrEqual(64);
    expect(daysToAnniversary).toBeLessThanOrEqual(66);

    const mine = await request(app).get(`${api}/subscriptions/me`).set(auth.emp);
    expect(mine.body.active).toBe(false);
    expect(mine.body.unlock.options).toHaveLength(2);
  });

  it('joining another paying company continues it at once', async () => {
    await member('beta', 'emp');
    const cov = await subscriptionService.companyCoverage(ids.emp);
    expect(cov).toMatchObject({ kind: 'company', orgName: 'Corp beta Ltd' });
    expect(await subscriptionService.isActive(ids.emp)).toBe(true);
  });

  it('nobody can buy a personal plan while a company pays', async () => {
    const res = await request(app).post(`${api}/subscriptions/order`).set(auth.emp);
    expect([409, 503]).toContain(res.status); // 409 when payments are set up; 503 when they are not
  });
});
