/**
 * Organisations v1 and "donate here, save a life there":
 * one account per person, work-email check, counts-only dashboard, colleague alerts, reachability choices,
 * and replacement donations confirmed by staff.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { hashPassword } from '../src/shared/password.js';
import { signAccessToken } from '../src/shared/jwt.js';
import { requestService } from '../src/modules/requests/requests.service.js';
import { testHooks } from '../src/modules/organisations/organisations.service.js';

const api = '/api/v1';
const TAG = 'orgtest';
const PASSWORD = 'OrgTest123!';
const ids: Record<string, string> = {};
const auth: Record<string, Record<string, string>> = {};
const VIZAG = { state: 'Andhra Pradesh', district: 'Visakhapatnam', city: 'Visakhapatnam' };
const HYD = { state: 'Telangana', district: 'Hyderabad', city: 'Hyderabad' };
let orgId = '';
let inviteCode = '';
let bankId = '';
let adminAuth: Record<string, string> = {};

async function makeUser(key: string, phone: string, donor?: { bloodGroup: string; place: typeof VIZAG }) {
  const u = await prisma.user.create({
    data: {
      email: `${TAG}.${key}@example.org`,
      phone,
      fullName: `Org ${key}`,
      passwordHash: await hashPassword(PASSWORD),
      isEmailVerified: true,
      dateOfBirth: new Date('1992-02-02'),
      createdAt: new Date('2025-01-01'),
      ...(donor ? { donorProfile: { create: { bloodGroup: donor.bloodGroup, country: 'IN', ...donor.place, sex: 'male', weightKg: 70, isAvailable: true } } } : {}),
    },
  });
  ids[key] = u.id;
  // Sign the token directly: many back-to-back logins trip the login rate limit
  auth[key] = { Authorization: `Bearer ${signAccessToken({ userId: u.id, email: u.email, role: u.role })}` };
}

async function joinAs(key: string, email: string) {
  const j = await request(app).post(`${api}/organisations/join`).set(auth[key]).send({ inviteCode, workEmail: email });
  expect(j.status).toBe(200);
  const v = await request(app).post(`${api}/organisations/${orgId}/verify-email`).set(auth[key]).send({ code: testHooks.lastCode });
  expect(v.status).toBe(200);
}

beforeAll(async () => {
  await prisma.$connect();
  await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}.` } } });
  await prisma.organization.deleteMany({ where: { name: { startsWith: 'Orgtest' } } });
  await prisma.partnerBloodBank.deleteMany({ where: { name: { startsWith: 'Orgtest' } } });
  await makeUser('hr', '+919444000001');
  await makeUser('family', '+919444000002');
  await makeUser('nearColleague', '+919444000003', { bloodGroup: 'O+', place: VIZAG });
  await makeUser('farColleague', '+919444000004', { bloodGroup: 'A+', place: HYD });
  await makeUser('optedOut', '+919444000005', { bloodGroup: 'O-', place: VIZAG });
  await makeUser('outsider', '+919444000006', { bloodGroup: 'O+', place: VIZAG });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@bloodbridge.org' } });
  adminAuth = { Authorization: `Bearer ${signAccessToken({ userId: admin.id, email: admin.email, role: admin.role })}` };
});

afterAll(async () => {
  await prisma.remoteDonation.deleteMany({ where: { donor: { email: { startsWith: `${TAG}.` } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}.` } } });
  await prisma.organization.deleteMany({ where: { name: { startsWith: 'Orgtest' } } });
  await prisma.partnerBloodBank.deleteMany({ where: { name: { startsWith: 'Orgtest' } } });
  await prisma.$disconnect();
});

describe('Registering and joining an organisation', () => {
  it('needs a real work email (not Gmail) to register', async () => {
    const res = await request(app).post(`${api}/organisations/register`).set(auth.hr)
      .send({ name: 'Orgtest Gmail Co', type: 'company', workEmail: 'hr@gmail.com', ...VIZAG });
    expect(res.status).toBe(400);
  });

  it('HR registers; BloodNation staff verify; the same domain cannot be registered twice', async () => {
    const res = await request(app).post(`${api}/organisations/register`).set(auth.hr)
      .send({ name: 'Orgtest Infra Ltd', type: 'company', workEmail: 'hr@orgtest-infra.in', ...VIZAG });
    expect(res.status).toBe(201);
    orgId = res.body.org.id;
    inviteCode = res.body.inviteCode;
    const ok = await request(app).post(`${api}/organisations/${orgId}/verify-email`).set(auth.hr).send({ code: testHooks.lastCode });
    expect(ok.body[0].membership).toMatchObject({ role: 'admin', status: 'active' });

    const dup = await request(app).post(`${api}/organisations/register`).set(auth.family)
      .send({ name: 'Orgtest Infra Again', type: 'company', workEmail: 'me@orgtest-infra.in', ...VIZAG });
    expect(dup.status).toBe(409);

    // Not verified yet: nobody can join
    const early = await request(app).post(`${api}/organisations/join`).set(auth.family).send({ inviteCode, workEmail: 'f@orgtest-infra.in' });
    expect(early.status).toBe(400);
    const v = await request(app).patch(`${api}/organisations/admin/${orgId}`).set(adminAuth).send({ verified: true });
    expect(v.status).toBe(200);
  });

  it('employees join with a work email on the company domain, using their own personal account', async () => {
    const wrong = await request(app).post(`${api}/organisations/join`).set(auth.family).send({ inviteCode, workEmail: 'family@gmail.com' });
    expect(wrong.status).toBe(400);
    await joinAs('family', 'family@orgtest-infra.in');
    await joinAs('nearColleague', 'near@orgtest-infra.in');
    await joinAs('farColleague', 'far@orgtest-infra.in');
    await joinAs('optedOut', 'out@orgtest-infra.in');
    // One work email belongs to one person
    const taken = await request(app).post(`${api}/organisations/join`).set(auth.outsider).send({ inviteCode, workEmail: 'near@orgtest-infra.in' });
    expect(taken.status).toBe(409);
    const accounts = await prisma.user.count({ where: { email: `${TAG}.family@example.org` } });
    expect(accounts).toBe(1);
  });

  it('a wrong code is refused', async () => {
    await request(app).post(`${api}/organisations/join`).set(auth.outsider).send({ inviteCode, workEmail: 'outsider@orgtest-infra.in' });
    const bad = await request(app).post(`${api}/organisations/${orgId}/verify-email`).set(auth.outsider).send({ code: '000000' });
    expect(bad.status).toBe(400);
    await request(app).post(`${api}/organisations/${orgId}/leave`).set(auth.outsider);
  });
});

describe('Reachability and the counts-only dashboard', () => {
  it('a donor can stop company alerts and public alerts separately', async () => {
    const res = await request(app).put(`${api}/outreach/me`).set(auth.optedOut).send({ reachCorporate: false });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ reachCorporate: false, reachRegular: true, inOrganisation: true });
  });

  it('only admins see the dashboard, and it never names anyone with a blood group', async () => {
    const no = await request(app).get(`${api}/organisations/${orgId}/dashboard`).set(auth.family);
    expect(no.status).toBe(403);
    const d = await request(app).get(`${api}/organisations/${orgId}/dashboard`).set(auth.hr);
    expect(d.status).toBe(200);
    expect(d.body.people.members).toBe(5);
    expect(d.body.bloodGroups['O+']).toEqual({ count: null, label: 'fewer than 3' });
    expect(JSON.stringify(d.body)).not.toMatch(/Org nearColleague|near@orgtest/);
    const members = await request(app).get(`${api}/organisations/${orgId}/members`).set(auth.hr);
    expect(JSON.stringify(members.body)).not.toMatch(/bloodGroup|O\+|eligib/);
  });
});

describe('Colleague alerts', () => {
  it('colleagues near the hospital are contacted; opted-out colleagues and non-members are not', async () => {
    const r = await requestService.create(ids.family, {
      patientName: 'Org Test Patient', bloodGroup: 'O+', unitsNeeded: 1, hospitalName: 'King George Hospital', ...VIZAG,
      urgency: 'urgent', alertOrgIds: [orgId, 'not-mine'], askRemoteReplacement: true,
    });
    ids.request = r.id;
    await prisma.bloodRequest.update({ where: { id: r.id }, data: { onHold: false, verificationStatus: 'verified' } });
    await requestService.rankCandidates(r.id);
    const stored = await prisma.bloodRequest.findUniqueOrThrow({ where: { id: r.id } });
    expect(JSON.parse(stored.alertOrgIds || '[]')).toEqual([orgId]);
    const c = await prisma.requestCandidate.findMany({ where: { requestId: r.id } });
    expect(c.find((x) => x.donorUserId === ids.nearColleague)?.source).toBe('colleague');
    expect(c.find((x) => x.donorUserId === ids.optedOut)?.source).not.toBe('colleague');
    expect(c.find((x) => x.donorUserId === ids.farColleague)).toBeUndefined(); // A+ can't give to O+, and lives in another state
  });

  it('a donor who switched off public requests is not contacted by strangers', async () => {
    await prisma.donorProfile.update({ where: { userId: ids.outsider }, data: { reachRegular: false } });
    const r = await requestService.create(ids.hr, {
      patientName: 'Org Test Patient Two', bloodGroup: 'O+', unitsNeeded: 1, hospitalName: 'King George Hospital', ...VIZAG, urgency: 'urgent',
    });
    await prisma.bloodRequest.update({ where: { id: r.id }, data: { onHold: false, verificationStatus: 'verified' } });
    await requestService.rankCandidates(r.id);
    const c = await prisma.requestCandidate.findMany({ where: { requestId: r.id, donorUserId: ids.outsider } });
    expect(c).toHaveLength(0);
  });
});

describe('Donate here, save a life there', () => {
  it('a colleague in another city pledges at a partner blood bank, donates, and staff confirm the credit', async () => {
    const bank = await request(app).post(`${api}/remote-donations/admin/banks`).set(adminAuth).send({ name: 'Orgtest Partner Blood Bank', ...HYD });
    expect(bank.status).toBe(200);
    bankId = bank.body.id;

    // Offered on the request page because the donor lives in another district and a partner bank exists there
    const view = await request(app).get(`${api}/requests/${ids.request}`).set(auth.farColleague);
    expect(view.body.remoteOffered).toBe(true);

    const p = await request(app).post(`${api}/remote-donations/requests/${ids.request}/pledge`).set(auth.farColleague).send({ bloodBankId: bankId });
    expect(p.status).toBe(200);
    expect(p.body.mine.status).toBe('pledged');

    const d = await request(app).post(`${api}/remote-donations/requests/${ids.request}/donated`).set(auth.farColleague).send({ donationRef: 'HYD-2026-123' });
    expect(d.body.mine.status).toBe('donated');
    // The donor now rests like after any donation
    const me = await request(app).get(`${api}/eligibility/me`).set(auth.farColleague);
    expect(me.body.eligible).toBe(false);

    const q = await request(app).get(`${api}/remote-donations/admin/queue`).set(adminAuth);
    const item = q.body.find((x: { donationRef: string }) => x.donationRef === 'HYD-2026-123');
    expect(item).toBeTruthy();
    const ok = await request(app).post(`${api}/remote-donations/admin/${item.id}/confirm`).set(adminAuth).send({ ok: true });
    expect(ok.status).toBe(200);

    const credits = await request(app).get(`${api}/remote-donations/requests/${ids.request}/credits`).set(auth.family);
    expect(credits.body[0]).toMatchObject({ status: 'confirmed', donationRef: 'HYD-2026-123' });
    const nosy = await request(app).get(`${api}/remote-donations/requests/${ids.request}/credits`).set(auth.nearColleague);
    expect(nosy.status).toBe(404);
  });

  it('only staff can manage banks and confirm credits', async () => {
    const res = await request(app).get(`${api}/remote-donations/admin/queue`).set(auth.hr);
    expect(res.status).toBe(403);
  });
});
