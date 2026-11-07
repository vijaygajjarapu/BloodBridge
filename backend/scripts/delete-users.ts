/**
 * Deletes test accounts so their email / mobile number can be used again.
 * Reads one email or mobile number per line from launch\delete-users.txt (lines starting with # are ignored).
 * Admin accounts are never deleted. Run with "launch\5 - Delete Test Users.cmd".
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const listFile = resolve(process.cwd(), '..', 'launch', 'delete-users.txt');

function phoneCandidates(raw: string): string[] {
  const digits = raw.replace(/\D/g, '');
  const ten = digits.length >= 10 ? digits.slice(-10) : digits;
  return ten.length === 10 ? [`+91${ten}`, ten, `91${ten}`, `0${ten}`] : [];
}

async function main() {
  if (!existsSync(listFile)) {
    console.log(`No list found at ${listFile}`);
    return;
  }
  const entries = readFileSync(listFile, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  if (!entries.length) {
    console.log('The list is empty. Add one email or mobile number per line to launch\\delete-users.txt');
    return;
  }

  for (const entry of entries) {
    const isEmail = entry.includes('@');
    const where = isEmail
      ? { email: entry.toLowerCase() }
      : { OR: phoneCandidates(entry).map((phone) => ({ phone })) };
    if (!isEmail && phoneCandidates(entry).length === 0) {
      console.log(`SKIPPED  ${entry}: not a valid email or 10-digit mobile number`);
      continue;
    }

    const users = await prisma.user.findMany({ where });
    if (!users.length) {
      console.log(`NOT FOUND ${entry}`);
    }
    for (const user of users) {
      if (user.role === 'admin') {
        console.log(`SKIPPED  ${entry}: ${user.email} is an admin account`);
        continue;
      }
      await prisma.$transaction([
        prisma.emailOtpChallenge.deleteMany({ where: { OR: [{ userId: user.id }, { email: user.email }] } }),
        prisma.user.delete({ where: { id: user.id } }), // family, pledges, profile, referrals, etc. are removed with it
      ]);
      console.log(`DELETED  ${entry}: ${user.fullName || user.username || '(no name)'} <${user.email}> ${user.phone || ''}`);
    }
    if (isEmail) {
      await prisma.emailOtpChallenge.deleteMany({ where: { email: entry.toLowerCase() } });
    }
  }
}

main()
  .catch((err) => {
    console.error('FAILED:', err?.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
