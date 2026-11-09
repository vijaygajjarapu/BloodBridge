/**
 * One-time repair for two old bugs (run with "launch\8 - Fix Referral Links.cmd"):
 *  1. The sign-up form pre-filled the demo code SAVIOR-MV2026, so normal sign-ups were credited to the demo account.
 *  2. Signing up with a code overwrote the inviter's own code row, so a link only remembered the latest person.
 *
 * What it changes:
 *  - Demo code (SAVIOR-MV2026): the overwritten link is cleared (that person is no longer "invited by Marcus").
 *  - Anyone else's code: the link is kept, but moved to its own row (the correct format), and the code row is reset.
 * What it does NOT change: people who joined through an invite link page (/join/...). They are only listed.
 * Safe to run more than once.
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();
const DEMO_CODE = 'SAVIOR-MV2026';

async function main() {
  // A person's own code row is "active"; correct invite rows are "completed". An active row with a person in it was overwritten.
  const broken = await prisma.referral.findMany({
    where: { status: 'active', referredUserId: { not: null } },
    include: { referrer: { select: { fullName: true } }, referred: { select: { fullName: true, email: true } } },
  });

  if (!broken.length) console.log('No overwritten code rows found.');

  for (const row of broken) {
    const who = `${row.referred?.fullName || 'unknown'} <${row.referred?.email || '-'}>`;
    await prisma.$transaction(async (tx) => {
      await tx.referral.update({ where: { id: row.id }, data: { referredUserId: null, completedAt: null } });
      if (row.referralCode === DEMO_CODE) return;
      const already = await tx.referral.findFirst({ where: { referredUserId: row.referredUserId! } });
      if (already) return;
      await tx.referral.create({
        data: {
          referrerUserId: row.referrerUserId,
          referralCode: `${row.referralCode}-${randomBytes(2).toString('hex').toUpperCase()}`,
          referredUserId: row.referredUserId!,
          status: 'completed',
          completedAt: row.completedAt || new Date(),
        },
      });
    });
    if (row.referralCode === DEMO_CODE) console.log(`CLEARED  ${who} is no longer "invited by" the demo account`);
    else console.log(`KEPT     ${who} stays invited by ${row.referrer?.fullName} (stored correctly now)`);
  }

  // Report (no change): non-sample people linked to the demo account through the invite-link page
  const demoOwner = await prisma.referral.findUnique({ where: { referralCode: DEMO_CODE } });
  if (demoOwner) {
    const linked = await prisma.referral.findMany({
      where: { referrerUserId: demoOwner.referrerUserId, referredUserId: { not: null }, status: 'completed' },
      include: { referred: { select: { fullName: true, email: true } } },
    });
    const real = linked.filter((r) => !(r.referred?.email || '').endsWith('@example.org'));
    if (real.length) {
      console.log('\nNot changed (they joined through the demo invite link page):');
      for (const r of real) console.log(`  - ${r.referred?.fullName} <${r.referred?.email}>`);
      console.log('Tell Claude if these should be unlinked too.');
    }
  }
  console.log('\nDone.');
}

main()
  .catch((err) => {
    console.error('FAILED:', err?.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
