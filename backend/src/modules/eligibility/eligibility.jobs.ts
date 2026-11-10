/**
 * Hourly donor reminders:
 * - a pause that has ended is cleared, with "You're back on the donor list"
 * - "You can donate again from today" once the gap after a donation is over (sent once per donation)
 */
import { prisma } from '../../config/database.js';
import { ONGOING_UNTIL, canDonateAgainOn } from './eligibility.rules.js';

const DAY = 24 * 60 * 60 * 1000;

export async function runDonorReminders(now = new Date()) {
  // 1. Pauses that ended
  const ended = await prisma.donorProfile.findMany({
    where: { pausedUntil: { lte: now } },
    select: { id: true, userId: true },
    take: 1000,
  });
  for (const p of ended) {
    await prisma.donorProfile.update({ where: { id: p.id }, data: { pausedUntil: null, pauseReason: null } });
    await prisma.notification.create({
      data: {
        recipientId: p.userId,
        notificationType: 'donor_status',
        title: 'You’re back on the donor list',
        message: 'Your pause has ended, so you can get emergency alerts again. You can pause again any time from your profile.',
        relatedEntity: '/app/profile#donations',
      },
    });
  }

  // 2. "You can donate again": donations 90 days to 13 months ago that we have not told the donor about yet
  const candidates = await prisma.donorProfile.findMany({
    where: {
      permanentlyDeferred: false,
      lastDonationDate: { lte: new Date(now.getTime() - 90 * DAY), gte: new Date(now.getTime() - 400 * DAY) },
    },
    select: { id: true, userId: true, sex: true, lastDonationDate: true, canDonateAgainNotifiedFor: true, pausedUntil: true },
    take: 2000,
  });
  let told = 0;
  for (const p of candidates) {
    const last = p.lastDonationDate!;
    if (p.canDonateAgainNotifiedFor && p.canDonateAgainNotifiedFor.getTime() === last.getTime()) continue;
    if (canDonateAgainOn(last, p.sex) > now) continue;
    await prisma.donorProfile.update({ where: { id: p.id }, data: { canDonateAgainNotifiedFor: last } });
    // Still paused "until I turn it back on": remind gently that alerts are off
    const stillPaused = p.pausedUntil && p.pausedUntil >= ONGOING_UNTIL;
    await prisma.notification.create({
      data: {
        recipientId: p.userId,
        notificationType: 'donor_status',
        title: 'You can donate again',
        message: stillPaused
          ? 'It has been long enough since your last donation. Your alerts are still paused; turn them on from your profile when you are ready.'
          : 'It has been long enough since your last donation, so you will get emergency alerts again. Thank you for being a donor!',
        relatedEntity: '/app/profile#donations',
      },
    });
    told++;
  }
  return { pausesEnded: ended.length, canDonateAgain: told };
}
