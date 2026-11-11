/**
 * Phone and SMS outreach: quiet hours, the requester's "include my number" choice,
 * one-tap links (answer without signing in) and masked calls (off until a provider is set up).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { hashPassword } from '../src/shared/password.js';
import { requestService } from '../src/modules/requests/requests.service.js';
import { outreachService, inQuietHours, allowedChannels } from '../src/modules/outreach/outreach.service.js';

const api = '/api/v1';
const TAG = 'outreachtest';
const PASSWORD = 'Outreach123!';
const ids: Record<string, string> = {};
const tokens: Record<string, string> = {};
const PLACE = { state: 'Andhra Pradesh', district: 'Visakhapatnam', city: 'Visakhapatnam' };

async function makeUser(key: string, phone: string, donor?: string) {
  const u = await prisma.user.create({
    data: {
      email: `${TAG}.${key}@example.org`,
      phone,
      fullName: `Outreach ${key}`,
      passwordHash: await hashPassword(PASSWORD),
      isEmailVerified: true,
      dateOfBirth: new Date('1991-03-03'),
      createdAt: new Date('2025-01-01'),
      ...(donor ? { donorProfile: { create: { bloodGroup: donor, country: 'IN', ...PLACE, sex: 'male', weightKg: 72, isAvailable: true } } } : {}),
    },
  });
  ids[key] = u.id;
  const login = await request(app).post(`${api}/auth/login`).send({ identifier: u.email, password: PASSWORD });
  tokens[key] = login.body.token;
}

const newRequest = (patientName: string, shareNumberInAlerts = false) =>
  requestService.create(ids.family, {
    patientName,
    bloodGroup: 'AB+',
    unitsNeeded: 1,
    hospitalName: 'King George Hospital',
    ...PLACE,
    urgency: 'urgent',
    shareNumberInAlerts,
  });

/** Ranks donors, opens the request for alerts, and returns the donor's one-tap token */
async function tokenFor(requestId: string) {
  await prisma.bloodRequest.update({ where: { id: requestId }, data: { onHold: false, verificationStatus: 'verified' } });
  await requestService.rankCandidates(requestId);
  const c = await prisma.requestCandidate.findUniqueOrThrow({ where: { requestId_donorUserId: { requestId, donorUserId: ids.donor } } });
  return (await outreachService.quickLinkFor(c.id))!.token;
}

beforeAll(async () => {
  await prisma.$connect();
  await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}.` } } });
  await makeUser('family', '+919222000001');
  await makeUser('donor', '+919222000002', 'AB-');
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}.` } } });
  await prisma.$disconnect();
});

describe('Quiet hours (India time)', () => {
  const ist = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 10, h, m) - 330 * 60 * 1000);

  it('handles ranges across midnight and within a day', () => {
    expect(inQuietHours('22:00', '07:00', ist(23))).toBe(true);
    expect(inQuietHours('22:00', '07:00', ist(6, 59))).toBe(true);
    expect(inQuietHours('22:00', '07:00', ist(12))).toBe(false);
    expect(inQuietHours('13:00', '15:00', ist(14))).toBe(true);
    expect(inQuietHours(null, null, ist(23))).toBe(false);
  });

  it('critical requests still get through when the donor allows it; calls are only for critical', () => {
    const prefs = { alertBySms: true, alertByCall: true, quietHoursStart: '22:00', quietHoursEnd: '07:00', quietAllowCritical: true };
    expect(allowedChannels(prefs, 'urgent', ist(23))).toMatchObject({ sms: false, call: false });
    expect(allowedChannels(prefs, 'critical', ist(23))).toMatchObject({ sms: true, call: true });
    expect(allowedChannels({ ...prefs, quietAllowCritical: false }, 'critical', ist(23))).toMatchObject({ sms: false });
    expect(allowedChannels(prefs, 'urgent', ist(12))).toMatchObject({ sms: true, call: false });
  });
});

describe('Donor choices', () => {
  it('saves SMS / call choices and quiet hours; both times are needed', async () => {
    const auth = { Authorization: `Bearer ${tokens.donor}` };
    const half = await request(app).put(`${api}/outreach/me`).set(auth).send({ quietHoursStart: '22:00' });
    expect(half.status).toBe(400);
    const ok = await request(app).put(`${api}/outreach/me`).set(auth).send({ alertByCall: true, quietHoursStart: '22:00', quietHoursEnd: '06:00' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ alertByCall: true, quietHoursStart: '22:00', quietHoursEnd: '06:00' });
    expect(ok.body.available.maskedCalls).toBe(false); // no provider in tests
  });
});

describe('One-tap link (no sign-in)', () => {
  it('shows the request, hides the family number until accepting, then shows it', async () => {
    const r = await newRequest('Outreach Patient One');
    const token = await tokenFor(r.id);

    const view = await request(app).get(`${api}/outreach/quick/${token}`);
    expect(view.status).toBe(200);
    expect(view.body).toMatchObject({ bloodGroup: 'AB+', live: true, requesterPhone: null });

    const yes = await request(app).post(`${api}/outreach/quick/${token}`).send({ action: 'accept' });
    expect(yes.status).toBe(200);
    expect(yes.body.myResponse).toBe('accepted');
    expect(yes.body.requesterPhone).toBeTruthy();
  });

  it('a made-up link does not work', async () => {
    const res = await request(app).get(`${api}/outreach/quick/not-a-real-token-123456`);
    expect(res.status).toBe(404);
  });
});

describe('"Include my number in alerts"', () => {
  it('is off by default; when on, donors see the number before accepting', async () => {
    const r = await newRequest('Outreach Patient Two', true);
    const token = await tokenFor(r.id);
    const view = await request(app).get(`${api}/outreach/quick/${token}`);
    expect(view.body.requesterPhone).toBeTruthy();

    const asDonor = await request(app).get(`${api}/requests/${r.id}`).set({ Authorization: `Bearer ${tokens.donor}` });
    expect(asDonor.body.requesterPhone).toBeTruthy();
    const asFamily = await request(app).get(`${api}/requests/${r.id}`).set({ Authorization: `Bearer ${tokens.family}` });
    expect(asFamily.body.shareNumberInAlerts).toBe(true);
  });
});

describe('Masked calls and call answers', () => {
  it('say clearly that calling through Manvi Blood is not switched on yet', async () => {
    const r = await prisma.bloodRequest.findFirstOrThrow({ where: { requesterUserId: ids.family } });
    const res = await request(app).post(`${api}/outreach/requests/${r.id}/call-family`).set({ Authorization: `Bearer ${tokens.donor}` });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('VOICE_NOT_CONFIGURED');
  });

  it('the key-press webhook refuses calls without the secret', async () => {
    const res = await request(app).post(`${api}/outreach/voice/keypress`).send({ token: 'x', digits: '1' });
    expect(res.status).toBe(403);
  });
});
