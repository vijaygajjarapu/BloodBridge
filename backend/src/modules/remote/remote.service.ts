/**
 * "Donate here, save a life there" (replacement donations).
 *
 * A donor who can't reach the hospital donates at a partner blood bank in their own city. That donation is recorded
 * against the request as a replacement credit, which the family shows at the hospital's blood bank.
 *
 * Important: a credit only works where the blood banks have agreed to honour it (same blood bank chain, or a
 * partnership). That is a business agreement, not something the app can promise; the screens say so.
 * Blood is never sold. Replacement donations can be any blood group: they restock the bank, which then issues the
 * patient's group.
 */
import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/types.js';
import { checkEligibility, canDonateAgainOn } from '../eligibility/eligibility.rules.js';

const LIVE = ['submitted', 'open', 'donors_notified', 'donor_found', 'in_progress', 'partially_fulfilled'];

export class RemoteDonationService {
  /** Partner blood banks, nearest first: same district, then same state */
  async banks(q: { country?: string; state?: string; district?: string }) {
    const rows = await prisma.partnerBloodBank.findMany({
      where: { active: true, country: q.country || 'IN', ...(q.state ? { state: q.state } : {}) },
      orderBy: [{ district: 'asc' }, { name: 'asc' }],
      take: 100,
    });
    return rows
      .map((b) => ({ id: b.id, name: b.name, address: b.address, city: b.city, district: b.district, state: b.state, phone: b.phone, sameDistrict: b.district === q.district }))
      .sort((a, b) => Number(b.sameDistrict) - Number(a.sameDistrict));
  }

  /** What the request page shows: credits so far and my own pledge */
  async summary(requestId: string, userId?: string) {
    const rows = await prisma.remoteDonation.findMany({
      where: { requestId, status: { not: 'cancelled' } },
      include: { bloodBank: { select: { name: true, city: true } } },
    });
    const mine = userId ? rows.find((r) => r.donorUserId === userId) : undefined;
    return {
      pledged: rows.filter((r) => r.status === 'pledged').length,
      donated: rows.filter((r) => r.status === 'donated').length,
      confirmed: rows.filter((r) => r.status === 'confirmed').length,
      mine: mine
        ? { id: mine.id, status: mine.status, bloodBank: `${mine.bloodBank.name}, ${mine.bloodBank.city}`, donationRef: mine.donationRef }
        : null,
    };
  }

  /** Family view: confirmed credits with the bank and slip number to show at the hospital */
  async creditsForRequester(userId: string, requestId: string) {
    const r = await prisma.bloodRequest.findUnique({ where: { id: requestId } });
    if (!r || r.requesterUserId !== userId) throw new AppError('Request not found.', 404, 'NOT_FOUND');
    const rows = await prisma.remoteDonation.findMany({
      where: { requestId, status: { in: ['donated', 'confirmed'] } },
      include: { bloodBank: { select: { name: true, city: true } } },
      orderBy: { donatedAt: 'desc' },
    });
    return rows.map((x) => ({
      id: x.id,
      status: x.status,
      bloodBank: `${x.bloodBank.name}, ${x.bloodBank.city}`,
      donationRef: x.status === 'confirmed' ? x.donationRef : null,
      donatedAt: x.donatedAt,
    }));
  }

  /** "I'll donate at a partner blood bank in my city" */
  async pledge(userId: string, requestId: string, bloodBankId: string) {
    const r = await prisma.bloodRequest.findUnique({ where: { id: requestId } });
    if (!r || !LIVE.includes(r.status) || r.onHold) throw new AppError('This request is not looking for donors.', 400, 'REQUEST_CLOSED');
    if (r.requesterUserId === userId) throw new AppError('You posted this request.', 400, 'VALIDATION_FAILED');
    const bank = await prisma.partnerBloodBank.findUnique({ where: { id: bloodBankId } });
    if (!bank || !bank.active) throw new AppError('Choose a partner blood bank.', 400, 'VALIDATION_FAILED');
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { donorProfile: true } });
    const p = user?.donorProfile;
    if (!p) throw new AppError('Add your blood group to your profile first.', 400, 'NO_DONOR_PROFILE');
    const check = checkEligibility({ ...p, dateOfBirth: user!.dateOfBirth });
    if (!check.eligible) throw new AppError(`You can't donate right now. ${check.reasons[0] || ''}`.trim(), 400, 'NOT_ELIGIBLE');
    const existing = await prisma.remoteDonation.findUnique({ where: { requestId_donorUserId: { requestId, donorUserId: userId } } });
    if (existing && existing.status !== 'cancelled') return this.summary(requestId, userId);
    if (existing) {
      await prisma.remoteDonation.update({ where: { id: existing.id }, data: { status: 'pledged', bloodBankId, pledgedAt: new Date(), donatedAt: null, donationRef: null } });
    } else {
      await prisma.remoteDonation.create({ data: { requestId, donorUserId: userId, bloodBankId } });
    }
    await prisma.notification.create({
      data: {
        recipientId: r.requesterUserId,
        notificationType: 'request_update',
        title: 'Someone will donate for you in another city',
        message: `A donor will give blood at ${bank.name}, ${bank.city} as a replacement for your ${r.bloodGroup} request. We will tell you when it is confirmed.`,
        relatedEntity: `/app/requests/${r.id}`,
      },
    });
    return this.summary(requestId, userId);
  }

  /** "I donated" with the slip / donor card number from the blood bank. Starts the donor's rest period. */
  async markDonated(userId: string, requestId: string, donationRef: string) {
    const x = await prisma.remoteDonation.findUnique({ where: { requestId_donorUserId: { requestId, donorUserId: userId } } });
    if (!x || x.status !== 'pledged') throw new AppError('No pledge to update.', 400, 'VALIDATION_FAILED');
    const p = await prisma.donorProfile.findUnique({ where: { userId } });
    const now = new Date();
    await prisma.$transaction([
      prisma.remoteDonation.update({ where: { id: x.id }, data: { status: 'donated', donatedAt: now, donationRef: donationRef.trim() } }),
      prisma.donationRecord.create({
        data: {
          userId,
          donatedOn: now,
          source: 'remote',
          requestId,
          place: (await prisma.partnerBloodBank.findUnique({ where: { id: x.bloodBankId } }))?.name ?? null,
          status: 'confirmed',
          confirmedAt: now,
          previousLastDonationDate: p?.lastDonationDate ?? null,
        },
      }),
      prisma.donorProfile.update({
        where: { userId },
        data: { lastDonationDate: now, totalDonations: { increment: 1 }, onCallUntil: null },
      }),
    ]);
    return this.summary(requestId, userId);
  }

  async cancel(userId: string, requestId: string) {
    await prisma.remoteDonation.updateMany({ where: { requestId, donorUserId: userId, status: 'pledged' }, data: { status: 'cancelled' } });
    return this.summary(requestId, userId);
  }

  // ---------- BloodNation staff (until blood banks get their own portal) ----------

  async adminQueue() {
    const rows = await prisma.remoteDonation.findMany({
      where: { status: 'donated' },
      include: { bloodBank: true, donor: { select: { fullName: true, phone: true } } },
      orderBy: { donatedAt: 'asc' },
      take: 200,
    });
    return rows.map((x) => ({
      id: x.id,
      requestId: x.requestId,
      donor: x.donor.fullName,
      donorPhone: x.donor.phone,
      bloodBank: `${x.bloodBank.name}, ${x.bloodBank.city}`,
      bloodBankPhone: x.bloodBank.phone,
      donationRef: x.donationRef,
      donatedAt: x.donatedAt,
    }));
  }

  /** Staff checked with the blood bank: confirm (credit is valid) or reject (no such donation) */
  async adminConfirm(adminId: string, id: string, ok: boolean) {
    const x = await prisma.remoteDonation.findUnique({ where: { id }, include: { bloodBank: true } });
    if (!x || x.status !== 'donated') throw new AppError('Nothing to confirm.', 400, 'VALIDATION_FAILED');
    const r = await prisma.bloodRequest.findUnique({ where: { id: x.requestId } });
    await prisma.remoteDonation.update({
      where: { id },
      data: ok ? { status: 'confirmed', confirmedAt: new Date(), confirmedById: adminId } : { status: 'cancelled', confirmedById: adminId },
    });
    if (ok && r) {
      await prisma.notification.create({
        data: {
          recipientId: r.requesterUserId,
          notificationType: 'request_update',
          title: 'Replacement donation confirmed',
          message: `${x.bloodBank.name}, ${x.bloodBank.city} confirmed a replacement donation for your request (slip ${x.donationRef}). Show it at the hospital's blood bank.`,
          relatedEntity: `/app/requests/${r.id}`,
        },
      });
    }
    await prisma.auditLog
      .create({ data: { actorId: adminId, action: ok ? 'REMOTE_DONATION_CONFIRMED' : 'REMOTE_DONATION_REJECTED', entityType: 'RemoteDonation', entityId: id, details: '{}' } })
      .catch(() => undefined);
    return { ok: true };
  }

  async adminListBanks() {
    return prisma.partnerBloodBank.findMany({ orderBy: [{ state: 'asc' }, { city: 'asc' }], take: 500 });
  }

  async adminSaveBank(input: { id?: string; name: string; licenceNo?: string; address?: string; city: string; district: string; state: string; phone?: string; active?: boolean }) {
    const data = {
      name: input.name.trim(),
      licenceNo: input.licenceNo?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city.trim(),
      district: input.district.trim(),
      state: input.state.trim(),
      phone: input.phone?.trim() || null,
      active: input.active ?? true,
    };
    return input.id ? prisma.partnerBloodBank.update({ where: { id: input.id }, data }) : prisma.partnerBloodBank.create({ data });
  }

  /** When a remote donor could give again, for the "thank you" message */
  nextDonationDate(last: Date, sex?: string | null) {
    return canDonateAgainOn(last, sex);
  }

  /** Remote donations are only offered to people far from the hospital (another district) */
  isFar(donor: { district?: string | null; state?: string | null }, r: { district: string; state: string }) {
    return !(donor.district === r.district && donor.state === r.state);
  }

  /** Ask colleagues in other cities to donate as a replacement (requester's choice) */
  async askColleaguesElsewhere(r: { id: string; requesterUserId: string; bloodGroup: string; hospitalName: string; city: string; district: string; state: string }, colleagueIds: string[]) {
    if (!colleagueIds.length) return 0;
    const people = await prisma.donorProfile.findMany({
      where: { userId: { in: colleagueIds }, isAvailable: true, reachCorporate: true },
      select: { userId: true, district: true, state: true, city: true },
    });
    const far = people.filter((p) => this.isFar(p, r));
    if (!far.length) return 0;
    // Only where a partner blood bank exists in their state
    const states = [...new Set(far.map((p) => p.state))];
    const banks = await prisma.partnerBloodBank.findMany({ where: { active: true, state: { in: states } }, select: { state: true } });
    const withBank = new Set(banks.map((b) => b.state));
    const targets = far.filter((p) => withBank.has(p.state));
    const already = await prisma.notification.findMany({
      where: { recipientId: { in: targets.map((t) => t.userId) }, relatedEntity: `/app/requests/${r.id}`, notificationType: 'remote_ask' },
      select: { recipientId: true },
    });
    const done = new Set(already.map((a) => a.recipientId));
    const send = targets.filter((t) => !done.has(t.userId));
    if (send.length) {
      await prisma.notification.createMany({
        data: send.map((t) => ({
          recipientId: t.userId,
          notificationType: 'remote_ask',
          title: `Donate in ${t.city}, save a colleague’s family in ${r.city}`,
          message: `A colleague’s family needs ${r.bloodGroup} at ${r.hospitalName}, ${r.city}. You can donate at a partner blood bank in your city as a replacement, any blood group. Donating is always free.`,
          relatedEntity: `/app/requests/${r.id}`,
        })),
      });
    }
    return send.length;
  }
}

export const remoteDonationService = new RemoteDonationService();

