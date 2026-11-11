import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/types.js';
import { generateRandomToken } from '../../shared/password.js';
import { formatPhone } from '../../shared/location.js';
import { subscriptionService } from '../subscriptions/subscriptions.service.js';
import { gapDaysFor } from '../eligibility/eligibility.rules.js';

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export const RELATIONS = ['self', 'spouse', 'son', 'daughter', 'father', 'mother', 'brother', 'sister', 'grandparent', 'other'] as const;

const BLOOD_ORDER = [...BLOOD_GROUPS];

function firstName(name?: string | null): string {
  return (name || '').trim().split(/\s+/)[0] || 'A BloodNation member';
}

function availabilityOf(profile?: { isAvailable: boolean; lastDonationDate: Date | null; sex?: string | null; pausedUntil?: Date | null } | null): 'available' | 'recently_donated' | 'unavailable' | null {
  if (!profile) return null;
  if (!profile.isAvailable || (profile.pausedUntil && profile.pausedUntil > new Date())) return 'unavailable';
  // Men 90 days, women (and not given) 120 days between donations
  if (profile.lastDonationDate && Date.now() - profile.lastDonationDate.getTime() < gapDaysFor(profile.sex) * 24 * 60 * 60 * 1000) return 'recently_donated';
  return 'available';
}

function sortGroups(groups: string[]): string[] {
  return [...new Set(groups)].sort((a, b) => BLOOD_ORDER.indexOf(a as any) - BLOOD_ORDER.indexOf(b as any));
}

export class FamilyService {
  // ---------- Family members (owner) ----------

  async listMembers(ownerUserId: string) {
    const members = await prisma.familyMember.findMany({
      where: { ownerUserId },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => ({
      id: m.id,
      name: m.name,
      relation: m.relation,
      bloodGroup: m.bloodGroup,
      dateOfBirth: m.dateOfBirth ? m.dateOfBirth.toISOString().slice(0, 10) : null,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async addMember(ownerUserId: string, input: { name: string; relation: string; bloodGroup: string; dateOfBirth?: string | null }) {
    const count = await prisma.familyMember.count({ where: { ownerUserId } });
    if (count >= 25) {
      throw new AppError('You can add up to 25 family members.', 400, 'LIMIT_REACHED');
    }
    await prisma.familyMember.create({
      data: {
        ownerUserId,
        name: input.name.trim(),
        relation: input.relation,
        bloodGroup: input.bloodGroup,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      },
    });
    return this.listMembers(ownerUserId);
  }

  async updateMember(
    ownerUserId: string,
    memberId: string,
    input: { name?: string; relation?: string; bloodGroup?: string; dateOfBirth?: string | null },
  ) {
    const member = await prisma.familyMember.findUnique({ where: { id: memberId } });
    if (!member || member.ownerUserId !== ownerUserId) {
      throw new AppError('Family member not found.', 404, 'NOT_FOUND');
    }
    await prisma.familyMember.update({
      where: { id: memberId },
      data: {
        ...(input.name && { name: input.name.trim() }),
        ...(input.relation && { relation: input.relation }),
        ...(input.bloodGroup && { bloodGroup: input.bloodGroup }),
        ...(input.dateOfBirth !== undefined && { dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null }),
      },
    });
    return this.listMembers(ownerUserId);
  }

  async removeMember(ownerUserId: string, memberId: string) {
    const member = await prisma.familyMember.findUnique({ where: { id: memberId } });
    if (!member || member.ownerUserId !== ownerUserId) {
      throw new AppError('Family member not found.', 404, 'NOT_FOUND');
    }
    await prisma.familyMember.delete({ where: { id: memberId } });
    return this.listMembers(ownerUserId);
  }

  /** The blood groups this family may need (unique, nothing else) */
  async neededGroups(ownerUserId: string): Promise<string[]> {
    const members = await prisma.familyMember.findMany({ where: { ownerUserId }, select: { bloodGroup: true } });
    return sortGroups(members.map((m) => m.bloodGroup));
  }

  // ---------- Invites ----------

  /** The owner's shareable invite (created on first use; one active link per family) */
  async getOrCreateInvite(ownerUserId: string) {
    const groups = await this.neededGroups(ownerUserId);
    if (!groups.length) {
      throw new AppError('Add at least one family member before inviting donors.', 400, 'NO_FAMILY_MEMBERS');
    }
    let invite = await prisma.familyInvite.findFirst({ where: { ownerUserId, isActive: true } });
    if (!invite) {
      invite = await prisma.familyInvite.create({
        data: { ownerUserId, code: 'FAM-' + generateRandomToken(5).toUpperCase() },
      });
    }
    return { code: invite.code, bloodGroups: groups };
  }

  /** Public view of an invite: ONLY the inviter's first name and the blood groups needed */
  async getInvitePublic(code: string, viewerUserId?: string) {
    const invite = await prisma.familyInvite.findUnique({
      where: { code: code.trim().toUpperCase() },
      include: { owner: { select: { id: true, fullName: true, username: true } } },
    });
    if (!invite || !invite.isActive) {
      throw new AppError('This invitation link is not valid any more. Please ask for a new one.', 404, 'NOT_FOUND');
    }
    const bloodGroups = await this.neededGroups(invite.ownerUserId);

    let myPledgedGroups: string[] = [];
    let myBloodGroup: string | null = null;
    if (viewerUserId) {
      const [pledges, profile] = await Promise.all([
        prisma.bloodPledge.findMany({
          where: { ownerUserId: invite.ownerUserId, donorUserId: viewerUserId, status: 'active' },
          select: { bloodGroup: true },
        }),
        prisma.donorProfile.findUnique({ where: { userId: viewerUserId }, select: { bloodGroup: true } }),
      ]);
      myPledgedGroups = pledges.map((p) => p.bloodGroup);
      myBloodGroup = profile?.bloodGroup || null;
    }

    return {
      code: invite.code,
      inviterFirstName: firstName(invite.owner.fullName || invite.owner.username),
      bloodGroups,
      isOwnInvite: viewerUserId === invite.ownerUserId,
      myPledgedGroups,
      myBloodGroup,
    };
  }

  // ---------- Pledges (donor) ----------

  async pledge(donorUserId: string, code: string, input: { bloodGroups: string[]; shareContact: boolean }) {
    const invite = await prisma.familyInvite.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!invite || !invite.isActive) {
      throw new AppError('This invitation link is not valid any more.', 404, 'NOT_FOUND');
    }
    if (invite.ownerUserId === donorUserId) {
      throw new AppError('This is your own family invitation. Share it with friends and relatives instead.', 400, 'OWN_INVITE');
    }
    if (!input.shareContact) {
      throw new AppError('Please agree to share your name and mobile number with this family.', 400, 'VALIDATION_FAILED', {
        shareContact: 'Required so the family can reach you in an emergency.',
      });
    }
    // The family ended this relationship and chose "don't let them pledge again"
    const blocked = await prisma.bloodPledge.findFirst({
      where: { ownerUserId: invite.ownerUserId, donorUserId, status: 'blocked' },
    });
    if (blocked) {
      throw new AppError('This family invitation is no longer available to you.', 403, 'FORBIDDEN');
    }
    const donor = await prisma.user.findUnique({ where: { id: donorUserId } });
    if (!donor?.phone) {
      throw new AppError('Please add your mobile number to your profile first, so the family can reach you.', 400, 'PHONE_REQUIRED');
    }

    const needed = await this.neededGroups(invite.ownerUserId);
    const chosen = sortGroups(input.bloodGroups).filter((g) => needed.includes(g));
    if (!chosen.length) {
      throw new AppError('Please choose at least one blood group you can donate.', 400, 'VALIDATION_FAILED', {
        bloodGroups: 'Choose at least one blood group.',
      });
    }

    await prisma.$transaction(async (tx) => {
      // Groups no longer ticked are withdrawn; ticked ones are (re)activated
      await tx.bloodPledge.updateMany({
        where: { ownerUserId: invite.ownerUserId, donorUserId, bloodGroup: { notIn: chosen } },
        data: { status: 'withdrawn' },
      });
      for (const bloodGroup of chosen) {
        await tx.bloodPledge.upsert({
          where: { ownerUserId_donorUserId_bloodGroup: { ownerUserId: invite.ownerUserId, donorUserId, bloodGroup } },
          create: { ownerUserId: invite.ownerUserId, donorUserId, bloodGroup, inviteId: invite.id, shareContact: true },
          update: { status: 'active', shareContact: true, inviteId: invite.id },
        });
      }
      await tx.notification.create({
        data: {
          recipientId: invite.ownerUserId,
          notificationType: 'family_pledge',
          title: 'A donor joined your Donor Circle',
          message: `${firstName(donor.fullName || donor.username)} pledged to donate ${chosen.join(', ')} if your family needs blood.`,
        },
      });
    });

    return { success: true, pledgedGroups: chosen };
  }

  /** Families this person has pledged to (first name of the family + groups) */
  async myPledges(donorUserId: string) {
    const pledges = await prisma.bloodPledge.findMany({
      where: { donorUserId, status: 'active' },
      include: { owner: { select: { fullName: true, username: true } }, invite: { select: { code: true } } },
      orderBy: { createdAt: 'desc' },
    });
    type Entry = {
      familyOf: string;
      inviteCode: string | null;
      bloodGroups: string[];
      since: string;
      permissions: { shareContact: boolean; allowRequestAlerts: boolean; shareAvailability: boolean };
    };
    const byFamily = new Map<string, Entry>();
    for (const p of pledges) {
      const entry: Entry = byFamily.get(p.ownerUserId) || {
        familyOf: firstName(p.owner.fullName || p.owner.username),
        inviteCode: p.invite?.code || null,
        bloodGroups: [],
        since: p.createdAt.toISOString(),
        permissions: { shareContact: p.shareContact, allowRequestAlerts: p.allowRequestAlerts, shareAvailability: p.shareAvailability },
      };
      entry.bloodGroups.push(p.bloodGroup);
      byFamily.set(p.ownerUserId, entry);
    }
    return [...byFamily.entries()].map(([ownerUserId, v]) => ({ ownerUserId, ...v, bloodGroups: sortGroups(v.bloodGroups) }));
  }

  async withdrawFromFamily(donorUserId: string, ownerUserId: string) {
    await prisma.bloodPledge.updateMany({
      where: { donorUserId, ownerUserId, status: 'active' },
      data: { status: 'withdrawn' },
    });
    return this.myPledges(donorUserId);
  }

  // ---------- Donor Circle (owner dashboard) ----------

  /**
   * Each family member with the donors who pledged that member's blood group.
   * A donor appears under every member with the same group.
   * Without an active subscription, only counts are returned (no names or numbers leave the server).
   */
  /**
   * Donors who joined through this person's referral link (verified email + contact-sharing consent)
   * are automatically counted for the family, for their own blood group.
   * A pledge row is created once; if the donor withdraws it, it is never re-added.
   */
  async syncReferredDonors(ownerUserId: string) {
    const referrals = await prisma.referral.findMany({
      where: { referrerUserId: ownerUserId, referredUserId: { not: null } },
      select: { referredUserId: true },
    });
    const donorIds = [...new Set(referrals.map((r) => r.referredUserId!).filter((id) => id && id !== ownerUserId))];
    if (!donorIds.length) return;

    const [donors, existing] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: donorIds }, status: 'active', isEmailVerified: true, donorProfile: { isNot: null } },
        select: {
          id: true,
          donorProfile: { select: { bloodGroup: true } },
          consentRecords: {
            where: { purpose: 'contact_sharing' },
            orderBy: { grantedAt: 'desc' },
            take: 1,
            select: { isGranted: true },
          },
        },
      }),
      prisma.bloodPledge.findMany({
        where: { ownerUserId, donorUserId: { in: donorIds } },
        select: { donorUserId: true, bloodGroup: true },
      }),
    ]);

    const have = new Set(existing.map((p) => `${p.donorUserId}|${p.bloodGroup}`));
    for (const d of donors) {
      const group = d.donorProfile?.bloodGroup;
      const consented = d.consentRecords[0]?.isGranted === true;
      if (!group || !consented || have.has(`${d.id}|${group}`)) continue;
      try {
        await prisma.bloodPledge.create({
          data: { ownerUserId, donorUserId: d.id, bloodGroup: group, shareContact: true, status: 'active' },
        });
      } catch {
        // created at the same moment by another request (unique owner+donor+group): ignore
      }
    }
  }

  /** Donor: change what this family may see / send (permissions per relationship) */
  async updatePermissions(
    donorUserId: string,
    ownerUserId: string,
    input: { shareContact?: boolean; allowRequestAlerts?: boolean; shareAvailability?: boolean },
  ) {
    const data: Record<string, boolean> = {};
    for (const k of ['shareContact', 'allowRequestAlerts', 'shareAvailability'] as const) {
      if (typeof input[k] === 'boolean') data[k] = input[k] as boolean;
    }
    const res = await prisma.bloodPledge.updateMany({ where: { donorUserId, ownerUserId, status: 'active' }, data });
    if (res.count === 0) throw new AppError('You have no active pledge for this family.', 404, 'NOT_FOUND');
    return { success: true, permissions: data };
  }

  /**
   * Family owner ends the relationship with a donor: everything shared stops at once.
   * Optional "block": the donor can't pledge to this family again (and isn't re-added from referrals).
   */
  async endRelationship(ownerUserId: string, donorUserId: string, input: { block?: boolean }) {
    const res = await prisma.bloodPledge.updateMany({
      where: { ownerUserId, donorUserId, status: { in: ['active', 'withdrawn', 'ended'] } },
      data: { status: input.block ? 'blocked' : 'ended', shareContact: false, allowRequestAlerts: false, shareAvailability: false },
    });
    if (res.count === 0) throw new AppError('This donor is not in your circle.', 404, 'NOT_FOUND');
    await prisma.auditLog.create({
      data: {
        actorId: ownerUserId,
        action: input.block ? 'FAMILY_DONOR_BLOCKED' : 'FAMILY_DONOR_REMOVED',
        entityType: 'BloodPledge',
        entityId: donorUserId,
        details: JSON.stringify({ block: Boolean(input.block) }),
      },
    });
    return { success: true, blocked: Boolean(input.block) };
  }

  async circle(ownerUserId: string) {
    await this.syncReferredDonors(ownerUserId);
    const [members, pledges, subscribed] = await Promise.all([
      prisma.familyMember.findMany({ where: { ownerUserId }, orderBy: { createdAt: 'asc' } }),
      prisma.bloodPledge.findMany({
        where: { ownerUserId, status: 'active' },
        include: {
          donor: {
            select: {
              id: true, fullName: true, username: true, phone: true, country: true, status: true,
              donorProfile: { select: { isAvailable: true, lastDonationDate: true, sex: true, pausedUntil: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      subscriptionService.isActive(ownerUserId),
    ]);

    const activePledges = pledges.filter((p) => p.donor.status === 'active');

    const result = members.map((m) => {
      const matched = activePledges.filter((p) => p.bloodGroup === m.bloodGroup);
      return {
        memberId: m.id,
        name: m.name,
        relation: m.relation,
        bloodGroup: m.bloodGroup,
        donorCount: matched.length,
        donors: subscribed
          ? matched.map((p) => ({
              pledgeId: p.id,
              donorUserId: p.donorUserId,
              name: p.donor.fullName || p.donor.username || 'Donor',
              // Permission: only the inviter sees the number, and only if the donor allows calls
              phone: p.shareContact ? formatPhone(p.donor.phone, p.donor.country) : null,
              canCall: p.shareContact,
              // Permission: availability only if the donor shares it
              availability: p.shareAvailability ? availabilityOf(p.donor.donorProfile) : null,
              getsRequestAlerts: p.allowRequestAlerts,
              pledgedAt: p.createdAt.toISOString(),
            }))
          : [],
      };
    });

    return {
      locked: !subscribed,
      totalDonors: new Set(activePledges.map((p) => p.donorUserId)).size,
      members: result,
    };
  }
}

export const familyService = new FamilyService();
