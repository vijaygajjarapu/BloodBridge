/**
 * End-to-end checks of the main flows against a fresh test database (see vitest.config.ts).
 * Uses the sample accounts from prisma/seed.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';

const api = '/api/v1';
const MARCUS = { identifier: 'marcus.vance@example.org', password: 'Password123!' };
const PRIYA = { identifier: 'priya.sharma@example.org', password: 'password123' }; // B+, Telangana / Ranga Reddy

let marcus = '';
let priya = '';
let priyaId = '';
let marcusId = '';
let firstRequestId = '';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const newRequest = (patientName: string) => ({
  patientName,
  bloodGroup: 'B+',
  unitsNeeded: 1,
  hospitalName: 'Continental Hospitals',
  hospitalArea: 'Gachibowli',
  state: 'Telangana',
  district: 'Ranga Reddy',
  city: 'Gachibowli',
  urgency: 'urgent',
});
const wasAlerted = async (userId: string, requestId: string) =>
  (await prisma.notification.count({
    where: { recipientId: userId, relatedEntity: `/app/requests/${requestId}`, notificationType: 'emergency_request' },
  })) > 0;

beforeAll(async () => {
  await prisma.$connect();
  // Sample accounts are created "today" by the seed; make the requester look established so fraud checks don't hold requests
  await prisma.user.update({ where: { email: MARCUS.identifier }, data: { createdAt: new Date('2025-01-01') } });
  marcusId = (await prisma.user.findUniqueOrThrow({ where: { email: MARCUS.identifier } })).id;
  priyaId = (await prisma.user.findUniqueOrThrow({ where: { email: PRIYA.identifier } })).id;
  await prisma.donorProfile.update({ where: { userId: priyaId }, data: { sex: 'female', weightKg: 58, lastDonationDate: new Date('2026-01-01') } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Sign-in', () => {
  it('signs in with the right password', async () => {
    const m = await request(app).post(`${api}/auth/login`).send(MARCUS);
    expect(m.status).toBe(200);
    expect(m.body.token).toBeTruthy();
    marcus = m.body.token;
    const p = await request(app).post(`${api}/auth/login`).send(PRIYA);
    expect(p.status).toBe(200);
    priya = p.body.token;
  });

  it('rejects a wrong password', async () => {
    const res = await request(app).post(`${api}/auth/login`).send({ ...MARCUS, password: 'wrong-password-1' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.token).toBeUndefined();
  });
});

describe('Free features (no subscription)', () => {
  it('Find Donors counts work without a subscription', async () => {
    const res = await request(app)
      .get(`${api}/requests/donor-counts`)
      .query({ bloodGroup: 'B+', state: 'Telangana', district: 'Ranga Reddy' })
      .set(auth(marcus));
    expect(res.status).toBe(200);
    expect(res.body.availableNow).toBeGreaterThanOrEqual(1);
  });

  it('posting a request is free and alerts a matching nearby donor', async () => {
    const res = await request(app).post(`${api}/requests`).set(auth(marcus)).send(newRequest('Core Test One (test)'));
    expect(res.status).toBe(201);
    firstRequestId = res.body.id;
    expect(await wasAlerted(priyaId, firstRequestId)).toBe(true);
  });
});

describe('Phone privacy and donor eligibility', () => {
  it("a donor doesn't see the family's number before accepting", async () => {
    const res = await request(app).get(`${api}/requests/${firstRequestId}`).set(auth(priya));
    expect(res.status).toBe(200);
    expect(res.body.requesterPhone ?? null).toBeNull();
  });

  it('adding a tattoo makes the donor wait 12 months', async () => {
    const res = await request(app).post(`${api}/eligibility/me/deferral`).set(auth(priya)).send({ reason: 'tattoo_piercing' });
    expect(res.status).toBe(200);
    expect(res.body.eligible).toBe(false);
    expect(res.body.nextEligibleDate).toBeTruthy();
  });

  it("a donor who can't donate yet can't accept", async () => {
    const res = await request(app).post(`${api}/requests/${firstRequestId}/respond`).set(auth(priya)).send({ action: 'accept' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NOT_ELIGIBLE');
  });

  it("a donor who can't donate yet is not alerted for new requests", async () => {
    const res = await request(app).post(`${api}/requests`).set(auth(marcus)).send(newRequest('Core Test Two (test)'));
    expect(res.status).toBe(201);
    expect(await wasAlerted(priyaId, res.body.id)).toBe(false);
  });

  it('after removing the reason, the donor can accept and then sees the number', async () => {
    const clear = await request(app).delete(`${api}/eligibility/me/deferral`).set(auth(priya));
    expect(clear.status).toBe(200);
    expect(clear.body.eligible).toBe(true);
    const res = await request(app).post(`${api}/requests/${firstRequestId}/respond`).set(auth(priya)).send({ action: 'accept' });
    expect(res.status).toBe(200);
    expect(res.body.requesterPhone).toBeTruthy();
  });
});

describe('Family Circle subscription', () => {
  it('sharing a family invite needs a subscription', async () => {
    const res = await request(app).post(`${api}/family/invite`).set(auth(marcus));
    expect(res.status).toBe(402);
    expect(res.body.code).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('works once subscribed', async () => {
    const endsAt = new Date();
    endsAt.setFullYear(endsAt.getFullYear() + 1);
    await prisma.subscription.create({
      data: { userId: marcusId, amountPaise: 20000, status: 'active', provider: 'dev_simulated', startsAt: new Date(), endsAt },
    });
    const member = await request(app).post(`${api}/family/members`).set(auth(marcus)).send({ name: 'Core Test Mother', relation: 'mother', bloodGroup: 'B+' });
    expect(member.status).toBe(201);
    const res = await request(app).post(`${api}/family/invite`).set(auth(marcus));
    expect(res.status).toBeLessThan(300);
  });
});

describe('Referral links', () => {
  it('every person who signs up with a code is counted (not just the latest)', async () => {
    const before = await request(app).get(`${api}/referrals/stats`).set(auth(marcus));
    expect(before.status).toBe(200);
    const start = before.body.successfulRegistrations;

    for (const n of [1, 2]) {
      const res = await request(app)
        .post(`${api}/auth/signup`)
        .send({
          username: `coretest_${n}`,
          dateOfBirth: '1995-05-05',
          email: `coretest${n}@example.test`,
          password: 'Password123',
          confirmPassword: 'Password123',
          phone: `98111000${n}${n}`,
          country: 'IN',
          referralCode: 'SAVIOR-MV2026',
          termsAccepted: true,
        });
      expect(res.status).toBeLessThan(300);
    }

    const after = await request(app).get(`${api}/referrals/stats`).set(auth(marcus));
    expect(after.body.successfulRegistrations).toBe(start + 2);
  });

  it("an account's own code is never the demo code", async () => {
    const res = await request(app).get(`${api}/auth/me`).set(auth(priya));
    expect(res.status).toBe(200);
    expect(res.body.user?.referralCode ?? res.body.referralCode).not.toBe('SAVIOR-MV2026');
  });
});
