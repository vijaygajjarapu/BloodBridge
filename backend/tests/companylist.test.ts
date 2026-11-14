/**
 * The company's employee list decides who the company covers (like Headspace for work):
 * - HR uploads employee ID + date of birth (optional work email); the employee links it to their personal account
 * - a full list marks people missing from it as left (30 free days, as with any exit)
 * - a full list with mistakes changes nothing
 * - only 5 wrong tries a day; removed rows can't be used; one row = one account
 * - HR never gets dates of birth or health information back
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { signAccessToken } from '../src/shared/jwt.js';
import { subscriptionService } from '../src/modules/subscriptions/subscriptions.service.js';
import { parseDob, testHooks } from '../src/modules/organisations/organisations.service.js';

const api = '/api/v1';
const TAG = 'listtest';
const DAY = 24 * 60 * 60 * 1000;
const CODE = 'LISTCO01';
const ids: Record<string, string> = {};
const auth: Record<string, Record<string, string>> = {};
let orgId = '';

async function makeUser(key: string, phone: string) {
  const u = await prisma.user.create({
    data: { email: `${TAG}.${key}@example.org`, phone, fullName: `List ${key}`, isEmailVerified: true, dateOfBirth: new Date('1990-05-05') },
  });
  ids[key] = u.id;
  auth[key] = { Authorization: `Bearer ${signAccessToken({ userId: u.id, email: u.email, role: u.role })}` };
}

const link = (key: string, employeeId: string, dateOfBirth: string) =>
  request(app).post(`${api}/organisations/link`).set(auth[key]).send({ inviteCode: CODE, method: 'employee_id', employeeId, dateOfBirth });
const upload = (rows: { employeeId: string; dateOfBirth: string; workEmail?: string }[], fullList = false, as = 'hr') =>
  request(app).post(`${api}/organisations/${orgId}/eligibility`).set(auth[as]).send({ rows, fullList });

beforeAll(async () => {
  await prisma.$connect();
  await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}.` } } });
  await prisma.organization.deleteMany({ where: { name: { startsWith: 'Listtest' } } });
  for (const [i, k] of ['hr', 'a', 'b', 'c', 'guesser', 'd'].entries()) await makeUser(k, `+91966600000${i}`);
  const o = await prisma.organization.create({
    data: { name: 'Listtest Pvt Ltd', emailDomains: JSON.stringify(['listtest.in']), inviteCode: CODE, state: 'Telangana', district: 'Hyderabad', city: 'Hyderabad', verified: true, plan: 'paid' },
  });
  orgId = o.id;
  await prisma.orgMember.create({ data: { orgId, userId: ids.hr, role: 'admin', status: 'active', workEmail: 'hr@listtest.in', workEmailVerifiedAt: new Date() } });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { actorId: { in: Object.values(ids) } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: `${TAG}.` } } });
  await prisma.organization.deleteMany({ where: { name: { startsWith: 'Listtest' } } });
  await prisma.$disconnect();
});

describe('Dates of birth as HR files have them', () => {
  it('reads year-first and day-first dates, and refuses impossible ones', () => {
    expect(parseDob('1990-05-05')?.toISOString().slice(0, 10)).toBe('1990-05-05');
    expect(parseDob('05/05/1990')?.toISOString().slice(0, 10)).toBe('1990-05-05');
    expect(parseDob('31.12.1985')?.toISOString().slice(0, 10)).toBe('1985-12-31');
    expect(parseDob('31-02-1990')).toBeNull();
    expect(parseDob('2020-01-01')).toBeNull(); // a child: not an employee
    expect(parseDob('hello')).toBeNull();
  });
});

describe('Uploading the employee list', () => {
  it('only the company admin can upload or see it', async () => {
    expect((await upload([{ employeeId: 'X1', dateOfBirth: '1990-05-05' }], false, 'a')).status).toBe(403);
    expect((await request(app).get(`${api}/organisations/${orgId}/eligibility`).set(auth.a)).status).toBe(403);
  });

  it('adds rows and reports the lines that need fixing', async () => {
    const res = await upload([
      { employeeId: 'A-1', dateOfBirth: '1990-05-05', workEmail: 'a@listtest.in' },
      { employeeId: 'B-1', dateOfBirth: '05/05/1990' },
      { employeeId: 'C-1', dateOfBirth: '1990-05-05', workEmail: 'c@listtest.in' },
      { employeeId: 'D-1', dateOfBirth: '1990-05-05' },
      { employeeId: '', dateOfBirth: '1990-05-05' },
      { employeeId: 'E-1', dateOfBirth: '1990-13-05' },
      { employeeId: 'F-1', dateOfBirth: '1990-05-05', workEmail: 'not-an-email' },
      { employeeId: 'a-1', dateOfBirth: '1990-05-05' },
    ]);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ added: 4, applied: true });
    expect(res.body.problems.map((p: any) => [p.line, p.reason])).toEqual([[5, 'missing_id'], [6, 'bad_date'], [7, 'bad_email'], [8, 'duplicate']]);
  });

  it('HR sees the list and who linked, but never dates of birth', async () => {
    const res = await request(app).get(`${api}/organisations/${orgId}/eligibility`).set(auth.hr);
    expect(res.body).toMatchObject({ onList: 4, linked: 0, removed: 0 });
    expect(JSON.stringify(res.body)).not.toMatch(/1990|dateOfBirth/);
  });
});

describe('Linking and the limits', () => {
  it('employees link with their ID + date of birth; the company pays from then on', async () => {
    expect((await link('a', 'a-1', '05-05-1990')).status).toBe(200);
    expect((await link('b', 'B-1', '1990-05-05')).status).toBe(200);
    expect((await link('c', 'C-1', '1990-05-05')).status).toBe(200);
    expect((await subscriptionService.companyCoverage(ids.a))?.kind).toBe('company');
    const d = await request(app).get(`${api}/organisations/${orgId}/dashboard`).set(auth.hr);
    expect(d.body.people).toMatchObject({ onList: 4, linkedFromList: 3 });
  });

  it('5 wrong tries a day, then blocked even with the right details', async () => {
    for (let i = 0; i < 5; i++) expect((await link('guesser', 'D-1', `1990-05-0${i + 1 === 5 ? 6 : i + 1}`)).status).toBe(400);
    const blocked = await link('guesser', 'D-1', '1990-05-05');
    expect(blocked.status).toBe(429);
  });

  it('leaving by yourself keeps you on the list: you can link again', async () => {
    await request(app).post(`${api}/organisations/${orgId}/leave`).set(auth.b);
    expect((await prisma.orgEligibility.findFirstOrThrow({ where: { orgId, employeeId: 'B-1' } })).status).toBe('eligible');
    expect((await link('b', 'B-1', '1990-05-05')).status).toBe(200);
  });
});

describe('Leaving the company through the list', () => {
  it('a full list with mistakes changes nothing (so nobody is wrongly marked as left)', async () => {
    const res = await upload([{ employeeId: 'A-1', dateOfBirth: 'oops' }], true);
    expect(res.body).toMatchObject({ applied: false, removed: 0, exits: 0 });
    expect(await prisma.orgMember.count({ where: { orgId, status: 'active' } })).toBe(4);
  });

  it('a full list: people missing from it have left (30 free days); new people are added', async () => {
    const res = await upload([
      { employeeId: 'A-1', dateOfBirth: '1990-05-05', workEmail: 'a@listtest.in' },
      { employeeId: 'C-1', dateOfBirth: '1990-05-05', workEmail: 'c@listtest.in' },
      { employeeId: 'G-1', dateOfBirth: '1990-05-05', workEmail: 'd@listtest.in' },
    ], true);
    expect(res.body).toMatchObject({ applied: true, added: 1, unchanged: 2, removed: 2, exits: 1 }); // B-1 (linked) and D-1 (never linked)
    const b = await prisma.orgMember.findFirstOrThrow({ where: { orgId, userId: ids.b } });
    expect(b).toMatchObject({ status: 'left', exitSource: 'hr_upload' });
    expect(Math.round((b.coverageEndsAt!.getTime() - Date.now()) / DAY)).toBe(30);
    expect((await subscriptionService.companyCoverage(ids.b))?.kind).toBe('grace');
    // Off the list: the same details can't be used again
    expect((await link('b', 'B-1', '1990-05-05')).status).toBe(400);
  });

  it('HR "who left" also takes the person off the list', async () => {
    const res = await request(app).post(`${api}/organisations/${orgId}/exits`).set(auth.hr)
      .send({ rows: [{ key: 'C-1', exitDate: new Date().toISOString().slice(0, 10) }, { key: 'g-1', exitDate: new Date().toISOString().slice(0, 10) }] });
    expect(res.body.results.map((r: any) => r.result)).toEqual(['done', 'done']); // C-1 linked, G-1 only on the list
    const rows = await prisma.orgEligibility.findMany({ where: { orgId, employeeId: { in: ['C-1', 'G-1'] } } });
    expect(rows.every((r) => r.status === 'removed')).toBe(true);
  });

  it('a work-email code sent before HR removed them no longer works', async () => {
    await upload([{ employeeId: 'H-1', dateOfBirth: '1990-05-05', workEmail: 'h@listtest.in' }]);
    const sent = await request(app).post(`${api}/organisations/link`).set(auth.d).send({ inviteCode: CODE, method: 'work_email', workEmail: 'h@listtest.in' });
    expect(sent.body.pending).toBe(true);
    await request(app).post(`${api}/organisations/${orgId}/exits`).set(auth.hr).send({ rows: [{ key: 'H-1', exitDate: new Date().toISOString().slice(0, 10) }] });
    const v = await request(app).post(`${api}/organisations/${orgId}/verify-email`).set(auth.d).send({ code: testHooks.lastCode });
    expect(v.status).toBe(400);
  });
});
