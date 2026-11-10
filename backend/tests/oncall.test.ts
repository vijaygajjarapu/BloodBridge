/** On-call donors and verified blood groups (both move a donor up the list for nearby requests) */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { adminService } from '../src/modules/admin/admin.service.js';
import { scoreDonor } from '../src/modules/requests/matching.js';

const api = '/api/v1';
const MARCUS = { identifier: 'marcus.vance@example.org', password: 'Password123!' };
let auth: Record<string, string> = {};
let profileId = '';
let original: { bloodGroup: string; lastDonationDate: Date | null } = { bloodGroup: 'O+', lastDonationDate: null };

beforeAll(async () => {
  const m = await prisma.user.findUniqueOrThrow({ where: { email: MARCUS.identifier }, include: { donorProfile: true } });
  profileId = m.donorProfile!.id;
  original = { bloodGroup: m.donorProfile!.bloodGroup, lastDonationDate: m.donorProfile!.lastDonationDate };
  // Make sure Marcus can donate right now for these checks
  await prisma.donorProfile.update({
    where: { id: profileId },
    data: { lastDonationDate: new Date('2025-01-01'), deferredUntil: null, deferralReason: null, permanentlyDeferred: false, isAvailable: true },
  });
  const login = await request(app).post(`${api}/auth/login`).send(MARCUS);
  auth = { Authorization: `Bearer ${login.body.token}` };
});

afterAll(async () => {
  await prisma.donorProfile.update({
    where: { id: profileId },
    data: {
      bloodGroup: original.bloodGroup,
      lastDonationDate: original.lastDonationDate,
      onCallUntil: null,
      bloodGroupVerifiedAt: null,
      bloodGroupVerifiedBy: null,
      bloodGroupVerifySource: null,
    },
  });
  await prisma.$disconnect();
});

describe('On call', () => {
  it('a donor who can donate can go on call for a set time and stop again', async () => {
    const on = await request(app).post(`${api}/eligibility/me/on-call`).set(auth).send({ hours: 24 });
    expect(on.status).toBe(200);
    const until = new Date(on.body.onCall.until).getTime();
    expect(until).toBeGreaterThan(Date.now() + 23 * 3600_000);
    expect(until).toBeLessThan(Date.now() + 25 * 3600_000);

    const off = await request(app).delete(`${api}/eligibility/me/on-call`).set(auth);
    expect(off.body.onCall.until).toBeNull();
  });

  it('only the listed time spans are allowed', async () => {
    const res = await request(app).post(`${api}/eligibility/me/on-call`).set(auth).send({ hours: 5 });
    expect(res.status).toBe(400);
  });

  it('a donor who must wait cannot go on call, and adding a reason to wait ends on-call', async () => {
    await request(app).post(`${api}/eligibility/me/on-call`).set(auth).send({ hours: 12 });
    const wait = await request(app).post(`${api}/eligibility/me/deferral`).set(auth).send({ reason: 'tattoo_piercing' });
    expect(wait.body.onCall.until).toBeNull();
    const again = await request(app).post(`${api}/eligibility/me/on-call`).set(auth).send({ hours: 12 });
    expect(again.status).toBe(400);
    await request(app).delete(`${api}/eligibility/me/deferral`).set(auth);
  });
});

describe('Verified blood group', () => {
  it('our team can mark a blood group verified; the donor sees it', async () => {
    const d = await adminService.updateDonorRecord(profileId, { bloodGroupVerified: true, bloodGroupVerifySource: 'lab report' });
    expect(d.bloodGroupVerified).toBe(true);
    const me = await request(app).get(`${api}/eligibility/me`).set(auth);
    expect(me.body.bloodGroupVerified.source).toBe('lab report');
  });

  it('changing the blood group removes the verified badge', async () => {
    const other = original.bloodGroup === 'O+' ? 'A+' : 'O+';
    const d = await adminService.updateDonorRecord(profileId, { bloodGroup: other });
    expect(d.bloodGroupVerified).toBe(false);
    await adminService.updateDonorRecord(profileId, { bloodGroup: original.bloodGroup });
  });
});

describe('Ranking', () => {
  it('on-call and verified donors are contacted before an otherwise equal donor', () => {
    const base = { samePin: false, sameCity: true, isFamily: false, knowsRequester: false, alertsReceived: 0, accepted: 0, totalDonations: 1, lastActiveAt: null };
    const plain = scoreDonor(base).score;
    expect(scoreDonor({ ...base, onCall: true }).score).toBeGreaterThan(plain);
    expect(scoreDonor({ ...base, verified: true }).score).toBeGreaterThan(plain);
  });
});
