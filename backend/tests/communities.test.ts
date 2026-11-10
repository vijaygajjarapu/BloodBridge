/**
 * Communities v1: tags, privacy-safe counts, "Still at X?" and how communities feed smart matching.
 * Creates its own accounts (so it does not depend on the order of the other test files) and removes them afterwards.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { communityService, communityKey, safeCount } from '../src/modules/communities/communities.service.js';
import { requestService } from '../src/modules/requests/requests.service.js';

const TAG = 'commtest';
const ids: Record<string, string> = {};

async function makeUser(key: string, phone: string, donor?: { bloodGroup: string; state: string; district: string; city: string }) {
  const u = await prisma.user.create({
    data: {
      email: `${TAG}.${key}@example.org`,
      phone,
      fullName: `Community ${key}`,
      isEmailVerified: true,
      dateOfBirth: new Date('1990-05-05'),
      createdAt: new Date('2025-01-01'),
      ...(donor
        ? { donorProfile: { create: { ...donor, country: 'IN', sex: 'male', weightKg: 70, isAvailable: true } } }
        : {}),
    },
  });
  ids[key] = u.id;
  return u.id;
}

const VIZAG = { state: 'Andhra Pradesh', district: 'Visakhapatnam', city: 'Visakhapatnam' };

beforeAll(async () => {
  await prisma.$connect();
  await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}.` } } });
  await makeUser('requester', '+919111000001');
  await makeUser('neighbour', '+919111000002', { bloodGroup: 'O+', ...VIZAG });
  await makeUser('fellow', '+919111000003', { bloodGroup: 'B+', state: 'Telangana', district: 'Hyderabad', city: 'Hyderabad' });
  await makeUser('mutedfellow', '+919111000004', { bloodGroup: 'B-', state: 'Telangana', district: 'Hyderabad', city: 'Hyderabad' });
  await makeUser('wronggroup', '+919111000005', { bloodGroup: 'A+', state: 'Telangana', district: 'Hyderabad', city: 'Hyderabad' });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}.` } } });
  await prisma.community.deleteMany({ where: { name: { contains: 'Commtest' } } });
  await prisma.$disconnect();
});

describe('Community basics', () => {
  it('names that differ only in spacing or "Apartments" are the same community', () => {
    expect(communityKey('Green Meadows  Apartments')).toBe(communityKey('green-meadows'));
  });

  it('small counts are hidden', () => {
    expect(safeCount(2)).toEqual({ count: null, label: 'fewer than 3' });
    expect(safeCount(0).label).toBe('0');
    expect(safeCount(7)).toEqual({ count: 7, label: '7' });
  });

  it('needs sign-in to see communities near a hospital', async () => {
    const res = await request(app).get('/api/v1/communities/near?state=Telangana&district=Hyderabad');
    expect(res.status).toBe(401);
  });

  it('adding the same community twice joins the existing one', async () => {
    const a = await communityService.create(ids.requester, { name: 'Commtest Lake View Society', type: 'gated', ...VIZAG });
    const b = await communityService.create(ids.neighbour, { name: 'commtest   lake view', type: 'gated', ...VIZAG });
    expect(b.id).toBe(a.id);
    ids.lakeView = a.id;
    const mine = await communityService.mine(ids.neighbour);
    expect(mine.map((m) => m.id)).toContain(a.id);
  });

  it('nearby counts show "fewer than 3" and never names', async () => {
    const rows = await communityService.near({ ...VIZAG, country: 'IN', donorGroups: ['O+', 'O-', 'B+', 'B-'], excludeUserId: ids.requester });
    const row = rows.find((r) => r.id === ids.lakeView);
    expect(row).toBeTruthy();
    expect(row!.ready).toEqual({ count: null, label: 'fewer than 3' });
    expect(JSON.stringify(rows)).not.toMatch(/commtest\.neighbour|Community neighbour/);
  });

  it('a person can be in at most 5 communities', async () => {
    for (let i = 1; i <= 4; i++) {
      await communityService.create(ids.wronggroup, { name: `Commtest Club Number ${i}`, type: 'club', ...VIZAG });
    }
    await communityService.create(ids.wronggroup, { name: 'Commtest Club Number Five', type: 'club', ...VIZAG });
    await expect(communityService.create(ids.wronggroup, { name: 'Commtest Club Number Six', type: 'club', ...VIZAG })).rejects.toThrow(/up to 5/);
    for (const m of await communityService.mine(ids.wronggroup)) await communityService.leave(ids.wronggroup, m.id);
  });
});

describe('Communities in smart matching', () => {
  it('fellow members who opted in are alerted wherever the hospital is; muted ones and wrong groups are not', async () => {
    // The requester's own college community, with members living in Hyderabad
    const college = await communityService.create(ids.requester, { name: 'Commtest Engineering College', type: 'college', state: 'Telangana', district: 'Hyderabad', city: 'Hyderabad' });
    for (const k of ['fellow', 'mutedfellow', 'wronggroup']) {
      await communityService.join(ids[k], college.id);
      await communityService.updatePrefs(ids[k], college.id, { alertFromMembers: true });
    }
    await communityService.updatePrefs(ids.mutedfellow, college.id, { muted: true });

    const created = await requestService.create(ids.requester, {
      patientName: 'Community Test Patient',
      bloodGroup: 'B+',
      unitsNeeded: 1,
      hospitalName: 'King George Hospital',
      state: VIZAG.state,
      district: VIZAG.district,
      city: VIZAG.city,
      urgency: 'urgent',
      alertCommunityIds: [ids.lakeView, 'not-a-real-id'],
    });
    await requestService.rankCandidates(created.id);

    const stored = await prisma.bloodRequest.findUniqueOrThrow({ where: { id: created.id } });
    expect(JSON.parse(stored.alertCommunityIds || '[]')).toEqual([ids.lakeView]);

    const candidates = await prisma.requestCandidate.findMany({ where: { requestId: created.id } });
    const of = (k: string) => candidates.find((c) => c.donorUserId === ids[k]);
    expect(of('fellow')?.source).toBe('community'); // lives in another district, still reached
    expect(of('neighbour')?.source).toBe('community'); // chosen nearby community
    expect(of('mutedfellow')).toBeUndefined();
    expect(of('wronggroup')).toBeUndefined(); // A+ cannot give to B+
  });
});

describe('"Still at X?"', () => {
  it('asks after 6 months and pauses alerts 30 days after asking with no answer', async () => {
    const m = await prisma.communityMember.findUniqueOrThrow({ where: { communityId_userId: { communityId: ids.lakeView, userId: ids.neighbour } } });
    await prisma.communityMember.update({ where: { id: m.id }, data: { confirmedAt: new Date(Date.now() - 200 * 86400000) } });

    await communityService.processReconfirmations();
    const asked = await prisma.communityMember.findUniqueOrThrow({ where: { id: m.id } });
    expect(asked.reconfirmAskedAt).toBeTruthy();
    expect(await prisma.notification.count({ where: { recipientId: ids.neighbour, notificationType: 'community_reconfirm' } })).toBe(1);

    await communityService.processReconfirmations(new Date(Date.now() + 31 * 86400000));
    expect((await prisma.communityMember.findUniqueOrThrow({ where: { id: m.id } })).status).toBe('stale');
    expect(await communityService.donorIdsForRequest(ids.requester, [ids.lakeView])).not.toContain(ids.neighbour);

    const after = await communityService.confirm(ids.neighbour, ids.lakeView, true);
    expect(after.find((x) => x.id === ids.lakeView)?.membership.status).toBe('active');
  });

  it('"I\'ve moved" keeps the membership but stops nearby alerts', async () => {
    await communityService.confirm(ids.neighbour, ids.lakeView, false);
    expect(await communityService.donorIdsForRequest(ids.requester, [ids.lakeView])).not.toContain(ids.neighbour);
  });
});
