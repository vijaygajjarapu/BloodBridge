/** App language saved on the account (English, Hindi, Telugu, Tamil, Malayalam) */
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';

const api = '/api/v1';
const MARCUS = { identifier: 'marcus.vance@example.org', password: 'Password123!' };

afterAll(async () => {
  await prisma.user.update({ where: { email: MARCUS.identifier }, data: { language: 'en' } });
  await prisma.$disconnect();
});

describe('Language', () => {
  it('saves a supported language and returns it with the profile', async () => {
    const login = await request(app).post(`${api}/auth/login`).send(MARCUS);
    const auth = { Authorization: `Bearer ${login.body.token}` };
    const set = await request(app).put(`${api}/profile/language`).set(auth).send({ language: 'te' });
    expect(set.status).toBe(200);
    const me = await request(app).get(`${api}/profile`).set(auth);
    expect(me.body.language).toBe('te');

    const bad = await request(app).put(`${api}/profile/language`).set(auth).send({ language: 'xx' });
    expect(bad.status).toBe(400);
  });
});
