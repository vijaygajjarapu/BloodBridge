/**
 * "Eligible to donate blood?" for family members without an account:
 * 18+ only, own number or the owner's number, and their name and number reach a requester
 * only with their consent and only when they match the request.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { hashPassword } from '../src/shared/password.js';
import { signAccessToken } from '../src/shared/jwt.js';
import { requestService } from '../src/modules/requests/requests.service.js';

const api = '/api/v1';
const TAG = 'famdonortest';
const ids: Record<string, string> = {};
const auth: Record<string, Record<string, string>> = {};
const PLACE = { state: 'Andhra Pradesh', district: 'Visakhapatnam', city: 'Visakhapatnam' };
const yearsAgo = (n: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().slice(0, 10);
};

async function makeUser(key: string, phone: string | null) {
  const u = await prisma.user.create({
    data: {
      email: `${TAG}.${key}@example.org`,
      phone,
      fullName: `FamDonor ${key}`,
      passwordHash: await hashPassword('FamDonor123!'),
      isEmailVerified: true,
      dateOfBirth: new Date('1985-03-03'),
      createdAt: new Date('2025-01-01'),
      donorProfile: { create: { bloodGroup: 'A+', country: 'IN', ...PLACE, sex: 'female', weightKg: 60, isAvailable: true } },
    },
  });
  ids[key] = u.id;
  auth[key] = { Authorization: `Bearer ${signAccessToken({ userId: u.id, email: u.email, role: u.role })}` };
}

const addMember = (key: string, body: Record<string, unknown>) =>
  request(app).post(`${api}/family/members`).set(auth[key]).send({ relation: 'brother', bloodGroup: 'O-', ...body });

beforeAll(async () => {
  await prisma.$connect();
  await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}.` } } });
  await makeUser('owner', '+919444000001');
  await makeUser('nophone', null);
  await makeUser('requester', '+919444000003');
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}.` } } });
  await prisma.$disconnect();
});

describe('Adding a family member who can donate', () => {
  it('the checkbox is optional: a member without it is saved as before', async () => {
    const res = await addMember('owner', { name: 'Plain Member', dateOfBirth: null });
    expect(res.status).toBe(201);
    expect(res.body.find((m: any) => m.name === 'Plain Member')).toMatchObject({ willingToDonate: false, contactConsent: false, donorPhone: null });
  });

  it('only 18 or older (date of birth needed), and not for "self"', async () => {
    expect((await addMember('owner', { name: 'No Dob', willingToDonate: true, useOwnerPhone: true })).body.fieldErrors?.dateOfBirth).toBeTruthy();
    const young = await addMember('owner', { name: 'Young One', dateOfBirth: yearsAgo(16), willingToDonate: true, useOwnerPhone: true });
    expect(young.status).toBe(400);
    expect(JSON.stringify(young.body)).toContain('18');
    const self = await addMember('owner', { name: 'Me Myself', relation: 'self', dateOfBirth: yearsAgo(30), willingToDonate: true, useOwnerPhone: true });
    expect(self.status).toBe(400);
  });

  it('needs a valid mobile, or "Use same mobile number" (which needs the owner to have one)', async () => {
    const none = await addMember('owner', { name: 'No Phone', dateOfBirth: yearsAgo(30), willingToDonate: true });
    expect(none.status).toBe(400);
    const bad = await addMember('owner', { name: 'Bad Phone', dateOfBirth: yearsAgo(30), willingToDonate: true, donorPhone: '12345' });
    expect(bad.status).toBe(400);
    const ownerHasNone = await addMember('nophone', { name: 'Shared Phone', dateOfBirth: yearsAgo(30), willingToDonate: true, useOwnerPhone: true });
    expect(ownerHasNone.status).toBe(400);

    const own = await addMember('owner', { name: 'Ravi Own', dateOfBirth: yearsAgo(30), willingToDonate: true, donorPhone: '9444000101', contactConsent: true });
    expect(own.status).toBe(201);
    const ravi = own.body.find((m: any) => m.name === 'Ravi Own');
    expect(ravi).toMatchObject({ willingToDonate: true, useOwnerPhone: false, donorPhone: '+919444000101', contactConsent: true });
    expect(ravi.contactConsentAt).toBeTruthy();

    const shared = await addMember('owner', { name: 'Sita Shared', bloodGroup: 'O+', dateOfBirth: yearsAgo(40), willingToDonate: true, useOwnerPhone: true, contactConsent: true });
    expect(shared.body.find((m: any) => m.name === 'Sita Shared')).toMatchObject({ useOwnerPhone: true, donorPhone: null, contactConsent: true });

    const noConsent = await addMember('owner', { name: 'Gopi Private', dateOfBirth: yearsAgo(35), willingToDonate: true, donorPhone: '9444000102' });
    expect(noConsent.body.find((m: any) => m.name === 'Gopi Private')).toMatchObject({ willingToDonate: true, contactConsent: false });
  });

  it('changing the number clears the consent until it is given again', async () => {
    const list = (await request(app).get(`${api}/family/members`).set(auth.owner)).body;
    const ravi = list.find((m: any) => m.name === 'Ravi Own');
    const changed = await request(app).put(`${api}/family/members/${ravi.id}`).set(auth.owner).send({ donorPhone: '9444000109' });
    expect(changed.body.find((m: any) => m.id === ravi.id)).toMatchObject({ donorPhone: '+919444000109', contactConsent: false });
    const again = await request(app).put(`${api}/family/members/${ravi.id}`).set(auth.owner).send({ contactConsent: true });
    expect(again.body.find((m: any) => m.id === ravi.id).contactConsent).toBe(true);
  });
});

describe('Showing family-member donors on a blood request', () => {
  it('the requester sees only matching members who consented, with name and number; the family is told once', async () => {
    const r = await requestService.create(ids.requester, {
      patientName: 'FamDonor Patient',
      bloodGroup: 'O-',
      unitsNeeded: 1,
      hospitalName: 'King George Hospital',
      ...PLACE,
      urgency: 'urgent',
    });
    await prisma.bloodRequest.update({ where: { id: r.id }, data: { onHold: false, verificationStatus: 'verified' } });

    const view = await request(app).get(`${api}/requests/${r.id}`).set(auth.requester);
    expect(view.status).toBe(200);
    const names = (view.body.familyMemberDonors || []).map((d: any) => d.name);
    expect(names).toContain('Ravi Own'); // O- matches O-, consented
    expect(names).not.toContain('Gopi Private'); // no consent: nothing shown
    expect(names).not.toContain('Sita Shared'); // O+ cannot give to O-
    expect(names).not.toContain('Plain Member'); // not a donor
    expect(JSON.stringify(view.body)).not.toContain('9444000102');
    const ravi = view.body.familyMemberDonors.find((d: any) => d.name === 'Ravi Own');
    expect(ravi.phone.replace(/\D/g, '')).toContain('9444000109');

    // Seen again: no second notice
    await request(app).get(`${api}/requests/${r.id}`).set(auth.requester);
    expect(await prisma.notification.count({ where: { recipientId: ids.owner, notificationType: 'family_donor_shared' } })).toBe(1);

    // A donor does not see them; a request on hold does not show them
    await prisma.bloodRequest.update({ where: { id: r.id }, data: { onHold: true } });
    const held = await request(app).get(`${api}/requests/${r.id}`).set(auth.requester);
    expect(held.body.familyMemberDonors || []).toHaveLength(0);
  });

  it('an O+ request shows the shared-number member with the owner’s number', async () => {
    const r = await requestService.create(ids.requester, {
      patientName: 'FamDonor Patient Two',
      bloodGroup: 'O+',
      unitsNeeded: 1,
      hospitalName: 'Seven Hills Hospital',
      ...PLACE,
      urgency: 'urgent',
    });
    await prisma.bloodRequest.update({ where: { id: r.id }, data: { onHold: false, verificationStatus: 'verified' } });
    const view = await request(app).get(`${api}/requests/${r.id}`).set(auth.requester);
    const sita = (view.body.familyMemberDonors || []).find((d: any) => d.name === 'Sita Shared');
    expect(sita).toBeTruthy();
    expect(sita.phone.replace(/\D/g, '')).toContain('9444000001');
  });
});

describe('Family members who can donate are part of your own Donor Circle', () => {
  it('lists them (with or without consent) and who they can give to, including you, without a subscription', async () => {
    const res = await request(app).get(`${api}/family/circle`).set(auth.owner);
    expect(res.status).toBe(200);
    const names = res.body.familyDonors.map((d: any) => d.name);
    expect(names).toEqual(expect.arrayContaining(['Ravi Own', 'Sita Shared', 'Gopi Private']));
    expect(names).not.toContain('Plain Member');
    const ravi = res.body.familyDonors.find((d: any) => d.name === 'Ravi Own');
    expect(ravi.canGiveTo).toContain('You'); // O- can give to the owner's A+
    expect(res.body.familyDonors.find((d: any) => d.name === 'Gopi Private').sharedOutsideFamily).toBe(false);
    const you = res.body.members.find((m: any) => m.memberId === 'you');
    expect(you.donors.some((d: any) => d.source === 'family' && d.name === 'Ravi Own')).toBe(true);
    expect(res.body.totalDonors).toBeGreaterThanOrEqual(3);
  });

  it("on your own request your willing family members are shown wherever the hospital is, even without the outside-sharing consent", async () => {
    const r = await requestService.create(ids.owner, {
      patientName: 'FamDonor Own Patient',
      bloodGroup: 'O-',
      unitsNeeded: 1,
      hospitalName: 'Apollo Hospital',
      state: 'Telangana',
      district: 'Hyderabad',
      city: 'Hyderabad',
      urgency: 'urgent',
    });
    await prisma.bloodRequest.update({ where: { id: r.id }, data: { onHold: false, verificationStatus: 'verified' } });
    const view = await request(app).get(`${api}/requests/${r.id}`).set(auth.owner);
    const mine = (view.body.familyMemberDonors || []).filter((d: any) => d.yourFamily).map((d: any) => d.name);
    expect(mine).toEqual(expect.arrayContaining(['Ravi Own', 'Gopi Private']));
  });
});
