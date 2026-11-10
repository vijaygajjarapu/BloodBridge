/**
 * After a donation the donor is kept off alerts for the gap (90 days men / 120 days women),
 * the donor confirms donations the family recorded, can add donations made elsewhere,
 * and can pause alerts (switches back on by itself).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { hashPassword } from '../src/shared/password.js';
import { requestService } from '../src/modules/requests/requests.service.js';
import { canBeAlerted } from '../src/modules/eligibility/eligibility.rules.js';
import { runDonorReminders } from '../src/modules/eligibility/eligibility.jobs.js';

const api = '/api/v1';
const TAG = 'donationtest';
const PASSWORD = 'Donation123!';
const ids: Record<string, string> = {};
const auth: Record<string, Record<string, string>> = {};
const PLACE = { state: 'Andhra Pradesh', district: 'Visakhapatnam', city: 'Visakhapatnam' };
const DAY = 24 * 60 * 60 * 1000;

async function makeUser(key: string, phone: string, donor?: string) {
  const u = await prisma.user.create({
    data: {
      email: `${TAG}.${key}@example.org`,
      phone,
      fullName: `Donation ${key}`,
      passwordHash: await hashPassword(PASSWORD),
      isEmailVerified: true,
      dateOfBirth: new Date('1990-06-06'),
      createdAt: new Date('2025-01-01'),
      ...(donor ? { donorProfile: { create: { bloodGroup: donor, country: 'IN', ...PLACE, sex: 'male', weightKg: 70, isAvailable: true } } } : {}),
    },
  });
  ids[key] = u.id;
  const login = await request(app).post(`${api}/auth/login`).send({ identifier: u.email, password: PASSWORD });
  auth[key] = { Authorization: `Bearer ${login.body.token}` };
}

beforeAll(async () => {
  await prisma.$connect();
  await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}.` } } });
  await makeUser('family', '+919333000001');
  await makeUser('donor', '+919333000002', 'O-');
  await makeUser('selfdonor', '+919333000003', 'O+');
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}.` } } });
  await prisma.$disconnect();
});

describe('Pause my alerts', () => {
  it('a paused donor is not alerted, even if able to donate', () => {
    const base = { weightKg: 70, sex: 'male', dateOfBirth: new Date('1990-01-01') };
    expect(canBeAlerted(base)).toBe(true);
    expect(canBeAlerted({ ...base, pausedUntil: new Date(Date.now() + DAY) })).toBe(false);
    expect(canBeAlerted({ ...base, pausedUntil: new Date(Date.now() - DAY) })).toBe(true);
  });

  it('pauses for a set time or until turned back on, and only listed spans are allowed', async () => {
    const week = await request(app).post(`${api}/eligibility/me/pause`).set(auth.donor).send({ days: 7, reason: 'Travelling' });
    expect(week.status).toBe(200);
    expect(week.body.pause).toMatchObject({ active: true, untilTurnedOn: false, reason: 'Travelling' });

    const forever = await request(app).post(`${api}/eligibility/me/pause`).set(auth.donor).send({ days: null });
    expect(forever.body.pause).toMatchObject({ active: true, untilTurnedOn: true, until: null });

    const bad = await request(app).post(`${api}/eligibility/me/pause`).set(auth.donor).send({ days: 5 });
    expect(bad.status).toBe(400);

    const back = await request(app).delete(`${api}/eligibility/me/pause`).set(auth.donor);
    expect(back.body.pause.active).toBe(false);
  });

  it('a finished pause is cleared by the hourly job, with a notice', async () => {
    await prisma.donorProfile.update({ where: { userId: ids.donor }, data: { pausedUntil: new Date(Date.now() - 60_000) } });
    await runDonorReminders();
    const p = await prisma.donorProfile.findUniqueOrThrow({ where: { userId: ids.donor } });
    expect(p.pausedUntil).toBeNull();
    expect(await prisma.notification.count({ where: { recipientId: ids.donor, title: { contains: 'back on the donor list' } } })).toBe(1);
  });
});

describe('"I donated" somewhere else', () => {
  it('records it, pauses alerts for the gap, and refuses duplicates and future dates', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app).post(`${api}/eligibility/me/donations`).set(auth.selfdonor).send({ date: today, place: 'Red Cross camp' });
    expect(res.status).toBe(200);
    expect(res.body.eligible).toBe(false);
    expect(res.body.nextEligibleDate).toBeTruthy();
    expect(res.body.donations[0]).toMatchObject({ source: 'self', status: 'confirmed', place: 'Red Cross camp' });

    const dup = await request(app).post(`${api}/eligibility/me/donations`).set(auth.selfdonor).send({ date: today });
    expect(dup.status).toBe(400);
    const future = await request(app).post(`${api}/eligibility/me/donations`).set(auth.selfdonor).send({ date: new Date(Date.now() + 3 * DAY).toISOString().slice(0, 10) });
    expect(future.status).toBe(400);
  });

  it('says "You can donate again" once, when the gap is over', async () => {
    const last = new Date(Date.now() - 100 * DAY);
    await prisma.donorProfile.update({ where: { userId: ids.selfdonor }, data: { lastDonationDate: last } });
    await runDonorReminders();
    await runDonorReminders();
    expect(await prisma.notification.count({ where: { recipientId: ids.selfdonor, title: 'You can donate again' } })).toBe(1);
  });
});

describe('Donation recorded by the family', () => {
  it('takes the donor off alerts at once; the donor can confirm or undo it', async () => {
    const r = await requestService.create(ids.family, {
      patientName: 'Donation Test Patient',
      bloodGroup: 'O-',
      unitsNeeded: 2,
      hospitalName: 'King George Hospital',
      ...PLACE,
      urgency: 'urgent',
    });
    await prisma.bloodRequest.update({ where: { id: r.id }, data: { onHold: false, verificationStatus: 'verified' } });
    await requestService.respond(ids.donor, r.id, { action: 'accept' });
    const resp = await prisma.requestResponse.findFirstOrThrow({ where: { requestId: r.id, donorUserId: ids.donor } });
    await requestService.markDonated(ids.family, r.id, resp.id);

    const after = await request(app).get(`${api}/eligibility/me`).set(auth.donor);
    expect(after.body.eligible).toBe(false); // in the gap now
    const pending = after.body.donations.find((d: { status: string }) => d.status === 'pending_donor');
    expect(pending).toBeTruthy();

    // "No, I did not": undone
    const no = await request(app).post(`${api}/eligibility/me/donations/${pending.id}/confirm`).set(auth.donor).send({ donated: false });
    expect(no.status).toBe(200);
    expect(no.body.details.lastDonationDate).toBeNull();
    expect(no.body.eligible).toBe(true);
    const again = await request(app).post(`${api}/eligibility/me/donations/${pending.id}/confirm`).set(auth.donor).send({ donated: true });
    expect(again.status).toBe(400);
  });
});
