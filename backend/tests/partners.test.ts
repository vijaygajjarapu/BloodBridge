/**
 * Partner programmes (insurers, banks, colleges, big groups) sponsor Family Safety Circle,
 * and WhatsApp groups join through an invite link. The end-to-end story:
 * a sponsored family sets up its circle, a relative pledges, a WhatsApp-group friend joins,
 * and when the family posts an emergency both are alerted first, wherever they live.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { hashPassword } from '../src/shared/password.js';
import { signAccessToken } from '../src/shared/jwt.js';
import { requestService } from '../src/modules/requests/requests.service.js';

const api = '/api/v1';
const TAG = 'partnertest';
const ids: Record<string, string> = {};
const auth: Record<string, Record<string, string>> = {};
const VIZAG = { state: 'Andhra Pradesh', district: 'Visakhapatnam', city: 'Visakhapatnam' };
const HYD = { state: 'Telangana', district: 'Hyderabad', city: 'Hyderabad' };
let adminAuth: Record<string, string> = {};
let programId = '';
let code = '';
let groupCode = '';

async function makeUser(key: string, phone: string, donor?: { bloodGroup: string; place: typeof VIZAG }) {
  const u = await prisma.user.create({
    data: {
      email: `${TAG}.${key}@example.org`,
      phone,
      fullName: `Partner ${key}`,
      passwordHash: await hashPassword('PartnerTest123!'),
      isEmailVerified: true,
      dateOfBirth: new Date('1991-03-03'),
      createdAt: new Date('2025-01-01'),
      ...(donor ? { donorProfile: { create: { bloodGroup: donor.bloodGroup, country: 'IN', ...donor.place, sex: 'male', weightKg: 70, isAvailable: true } } } : {}),
    },
  });
  ids[key] = u.id;
  auth[key] = { Authorization: `Bearer ${signAccessToken({ userId: u.id, email: u.email, role: u.role })}` };
}

beforeAll(async () => {
  await prisma.$connect();
  await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}.` } } });
  await prisma.partnerProgram.deleteMany({ where: { name: { startsWith: 'Partnertest' } } });
  await prisma.community.deleteMany({ where: { name: { startsWith: 'Partnertest' } } });
  await makeUser('family', '+919555000001'); // policyholder who needs blood for a family member
  await makeUser('relative', '+919555000002', { bloodGroup: 'O+', place: HYD }); // pledges, lives in another state
  await makeUser('friend', '+919555000003', { bloodGroup: 'O-', place: HYD }); // in the family's WhatsApp group
  await makeUser('other', '+919555000004');
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@bloodbridge.org' } });
  adminAuth = { Authorization: `Bearer ${signAccessToken({ userId: admin.id, email: admin.email, role: admin.role })}` };
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}.` } } });
  await prisma.partnerProgram.deleteMany({ where: { name: { startsWith: 'Partnertest' } } });
  await prisma.community.deleteMany({ where: { name: { startsWith: 'Partnertest' } } });
  await prisma.$disconnect();
});

describe('Partner programmes', () => {
  it('only BloodBridge staff create programmes', async () => {
    const no = await request(app).post(`${api}/partners/admin`).set(auth.family).send({ name: 'Partnertest Life', partnerType: 'term_insurer', seats: 2 });
    expect(no.status).toBe(403);
    const res = await request(app).post(`${api}/partners/admin`).set(adminAuth).send({ name: 'Partnertest Life', partnerType: 'term_insurer', seats: 2, monthsFree: 12 });
    expect(res.status).toBe(201);
    programId = res.body.id;
    code = res.body.code;
    expect(code).toMatch(/^PARTNERT-[0-9A-F]{4}$/);
  });

  it('a policyholder sees who sponsors the code, redeems it once, and Family Safety Circle switches on', async () => {
    const look = await request(app).get(`${api}/partners/code/${code.toLowerCase()}`).set(auth.family);
    expect(look.body).toMatchObject({ name: 'Partnertest Life', available: true, monthsFree: 12 });
    expect(look.body.seats).toBeUndefined();

    const before = await request(app).get(`${api}/family/circle`).set(auth.family);
    expect(before.body.locked).toBe(true);

    const r = await request(app).post(`${api}/partners/redeem`).set(auth.family).send({ code });
    expect(r.status).toBe(200);
    expect(r.body.sponsoredBy).toBe('Partnertest Life');

    const again = await request(app).post(`${api}/partners/redeem`).set(auth.family).send({ code });
    expect(again.status).toBe(409);

    const mine = await request(app).get(`${api}/partners/mine`).set(auth.family);
    expect(mine.body.name).toBe('Partnertest Life');
    const after = await request(app).get(`${api}/family/circle`).set(auth.family);
    expect(after.body.locked).toBe(false);
  });

  it('a second sponsored code cannot be stacked, and a full or paused code is refused', async () => {
    const second = await request(app).post(`${api}/partners/admin`).set(adminAuth).send({ name: 'Partnertest Bank', partnerType: 'bank', seats: 1, code: 'PTBANK-01' });
    expect(second.status).toBe(201);
    const stack = await request(app).post(`${api}/partners/redeem`).set(auth.family).send({ code: 'PTBANK-01' });
    expect(stack.status).toBe(409);

    expect((await request(app).post(`${api}/partners/redeem`).set(auth.other).send({ code: 'PTBANK-01' })).status).toBe(200);
    const full = await request(app).post(`${api}/partners/redeem`).set(auth.relative).send({ code: 'PTBANK-01' });
    expect(full.status).toBe(400);
    expect(JSON.stringify(full.body)).toMatch(/places/i);

    await request(app).patch(`${api}/partners/admin/${programId}`).set(adminAuth).send({ active: false });
    const paused = await request(app).get(`${api}/partners/code/${code}`).set(auth.relative);
    expect(paused.body.available).toBe(false);
    await request(app).patch(`${api}/partners/admin/${programId}`).set(adminAuth).send({ active: true });

    const dup = await request(app).post(`${api}/partners/admin`).set(adminAuth).send({ name: 'Partnertest Copy', partnerType: 'bank', seats: 1, code: 'PTBANK-01' });
    expect(dup.status).toBe(409);
  });
});

describe('Family circle + WhatsApp group: the people who already know you are alerted first', () => {
  it('the family adds a member, a relative pledges through the invite link', async () => {
    expect((await request(app).post(`${api}/family/members`).set(auth.family).send({ name: 'Amma', relation: 'mother', bloodGroup: 'O+' })).status).toBe(201);
    const inv = await request(app).post(`${api}/family/invite`).set(auth.family);
    expect(inv.status).toBe(200);
    const pub = await request(app).get(`${api}/family/invites/${inv.body.code}`).set(auth.relative);
    expect(pub.body.bloodGroups).toEqual(['O+']);
    expect(JSON.stringify(pub.body)).not.toMatch(/Amma|9555000001/);
    const p = await request(app).post(`${api}/family/invites/${inv.body.code}/pledge`).set(auth.relative).send({ bloodGroups: ['O+'], shareContact: true });
    expect(p.status).toBe(200);
    const circle = await request(app).get(`${api}/family/circle`).set(auth.family);
    expect(circle.body.members[0].donorCount).toBe(1);
  });

  it('the family adds its WhatsApp group; a friend joins through the link and is asked to help members', async () => {
    const g = await request(app).post(`${api}/communities`).set(auth.family).send({ name: 'Partnertest Cousins Group', type: 'whatsapp', ...VIZAG });
    expect(g.status).toBe(201);
    const link = await request(app).post(`${api}/communities/${g.body.id}/invite`).set(auth.family);
    expect(link.body.code).toMatch(/^GRP-/);
    expect(link.body.whatsappUrl).toContain('https://wa.me/?text=');
    groupCode = link.body.code;

    const outsider = await request(app).post(`${api}/communities/${g.body.id}/invite`).set(auth.friend);
    expect(outsider.status).toBe(403);

    const view = await request(app).get(`${api}/communities/by-code/${groupCode}`).set(auth.friend);
    expect(view.body).toMatchObject({ name: 'Partnertest Cousins Group', peopleGroup: true, isMember: false });
    expect(view.body.members.label).toBe('fewer than 3');

    const j = await request(app).post(`${api}/communities/join-code/${groupCode}`).set(auth.friend).send({});
    expect(j.status).toBe(200);
    const mine = j.body.find((c: { name: string }) => c.name === 'Partnertest Cousins Group');
    expect(mine.membership.alertFromMembers).toBe(true);
  });

  it('when the family posts an emergency, the pledged relative and the group friend are first in line, though they live in another state', async () => {
    const r = await requestService.create(ids.family, {
      patientName: 'Partner Test Patient', bloodGroup: 'O+', unitsNeeded: 2, hospitalName: 'King George Hospital', ...VIZAG, urgency: 'critical',
    });
    await prisma.bloodRequest.update({ where: { id: r.id }, data: { onHold: false, verificationStatus: 'verified', status: 'submitted' } });
    await requestService.rankCandidates(r.id);
    const c = await prisma.requestCandidate.findMany({ where: { requestId: r.id }, orderBy: { rank: 'asc' } });
    const relative = c.find((x) => x.donorUserId === ids.relative);
    const friend = c.find((x) => x.donorUserId === ids.friend);
    expect(relative?.source).toBe('family');
    expect(relative?.rank).toBe(c[0].rank); // family first
    expect(friend?.source).toBe('community');

    await requestService.sendWave(r.id);
    const alerts = await prisma.notification.findMany({ where: { relatedEntity: `/app/requests/${r.id}`, notificationType: 'emergency_request' } });
    const to = alerts.map((a) => a.recipientId);
    expect(to).toContain(ids.relative);
    expect(to).toContain(ids.friend);
  });

  it('the partner report has counts only and hides small numbers', async () => {
    const no = await request(app).get(`${api}/partners/admin/${programId}/report`).set(auth.family);
    expect(no.status).toBe(403);
    const rep = await request(app).get(`${api}/partners/admin/${programId}/report`).set(adminAuth);
    expect(rep.body.redeemed).toBe(1);
    expect(rep.body.familiesSetUp).toEqual({ count: null, label: 'fewer than 3' });
    expect(JSON.stringify(rep.body)).not.toMatch(/Amma|partnertest\.|Partner family/);
  });
});
