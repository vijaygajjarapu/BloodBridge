import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/types.js';
import { emitAdminEvent } from '../../sockets/socket.server.js';
import { validateLocation, formatPhone } from '../../shared/location.js';
import { cancelRequestsOfSuspendedUser } from '../requests/fraud.service.js';

/** One donor row for the admin Donor Database (field names match the admin website) */
function toAdminDonor(d: any) {
  const consent = d.user.consentRecords?.[0];
  const referrer = d.user.receivedReferral?.referrer;
  const name = d.user.fullName || d.user.username || d.user.email;
  const phone = formatPhone(d.user.phone, d.country);
  return {
    id: d.id,
    userId: d.userId,
    name,
    fullName: name,
    email: d.user.email,
    phone,
    mobileNumber: phone,
    bloodGroup: d.bloodGroup,
    country: d.country,
    state: d.state,
    district: d.district,
    city: d.city,
    postalCode: d.postalCode,
    status: d.isAvailable ? 'active' : 'inactive',
    availability: d.isAvailable ? 'available' : 'busy',
    // Latest contact-sharing consent: granted / withdrawn / none
    consentStatus: consent ? (consent.isGranted ? 'granted' : 'withdrawn') : 'pending',
    // Who invited this donor (their referral link), if anyone
    referredBy: referrer ? referrer.fullName || referrer.username || referrer.email : undefined,
    accountStatus: d.user.status,
    emailVerified: d.user.isEmailVerified,
    donationWillingness: d.donationWillingness,
    totalDonations: d.totalDonations,
    lastDonationDate: d.lastDonationDate ? d.lastDonationDate.toISOString() : null,
    registeredAt: d.createdAt.toISOString(),
  };
}

export class AdminService {
  async getOverviewMetrics(country?: string) {
    // Optional country filter: 'IN', 'US', ... or empty / 'ALL' for every country
    const c = country && country !== 'ALL' ? country.toUpperCase() : undefined;
    const userWhere: any = c ? { country: c } : {};
    const donorWhere: any = c ? { country: c } : {};
    const [
      totalUsers,
      totalDonors,
      activeReferrals,
      consentsGranted,
      consentsWithdrawn,
      bloodGroupCounts,
      donorsList,
      referralRegistrations,
      emergencyReadyCount,
      completedReferralDates,
    ] = await Promise.all([
      prisma.user.count({ where: userWhere }),
      prisma.donorProfile.count({ where: donorWhere }),
      prisma.referral.count({ where: { status: 'active', ...(c && { referrer: { country: c } }) } }),
      prisma.consentRecord.count({ where: { isGranted: true, ...(c && { user: { country: c } }) } }),
      prisma.consentRecord.count({ where: { isGranted: false, ...(c && { user: { country: c } }) } }),
      prisma.donorProfile.groupBy({
        by: ['bloodGroup'],
        where: donorWhere,
        _count: { _all: true },
      }),
      prisma.donorProfile.findMany({
        where: donorWhere,
        select: { createdAt: true },
      }),
      prisma.referral.count({ where: { referredUserId: { not: null }, ...(c && { referred: { country: c } }) } }),
      prisma.donorProfile.count({ where: { ...donorWhere, isAvailable: true } }),
      prisma.referral.findMany({
        where: { referredUserId: { not: null }, ...(c && { referred: { country: c } }) },
        select: { completedAt: true, createdAt: true },
      }),
    ]);

    const bloodGroupDistribution = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'].map((group) => {
      const match = bloodGroupCounts.find((bg) => bg.bloodGroup === group);
      return {
        group,
        count: match ? match._count._all : 0,
      };
    });

    // Real counts per month for the last 6 months (no made-up curve)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const registrationTrends = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const inMonth = (d: Date) => d >= start && d < end;
      registrationTrends.push({
        month: monthNames[start.getMonth()],
        registrations: donorsList.filter((d) => inMonth(d.createdAt)).length,
        referrals: completedReferralDates.filter((r) => inMonth(r.completedAt || r.createdAt)).length,
      });
    }

    const consentTotal = consentsGranted + consentsWithdrawn;
    const consentGrantedRate = consentTotal ? Math.round((consentsGranted / consentTotal) * 1000) / 10 : 0;

    return {
      totalUsers,
      totalDonors,
      verifiedContacts: totalDonors,
      referralRegistrations,
      activeReferralCodes: activeReferrals,
      consentGrantedRate,
      emergencyReadyCount,
      activeReferrals,
      consentsGranted,
      consentsWithdrawn,
      registrationTrends,
      bloodGroupDistribution,
    };
  }

  async listUsers(params: { search?: string; status?: string; country?: string; page?: number; pageSize?: number }) {
    const { search, status, country, page = 1, pageSize = 10 } = params;

    const where: any = {};
    if (country && country !== 'ALL') {
      where.country = country.toUpperCase();
    }
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search.replace(/\D/g, '') || search } },
      ];
    }

    const total = await prisma.user.count({ where });
    const users = await prisma.user.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: { donorProfile: true },
    });

    const items = users.map((u) => ({
      id: u.id,
      name: u.fullName,
      email: u.email,
      phone: formatPhone(u.phone, u.country),
      country: u.country,
      role: u.role,
      status: u.status,
      verified: u.isEmailVerified,
      createdAt: u.createdAt.toISOString(),
    }));

    return {
      data: items,
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async updateUserStatus(userId: string, status: string, adminId?: string) {
    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { status },
      });

      // If suspended, immediately revoke all active refresh tokens for the user
      if (status === 'suspended') {
        await tx.refreshToken.updateMany({
          where: { userId, isRevoked: false },
          data: { isRevoked: true },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: adminId || null,
          action: status === 'suspended' ? 'SUSPEND_USER' : 'REACTIVATE_USER',
          entityType: 'User',
          entityId: userId,
          details: JSON.stringify({ newStatus: status }),
        },
      });

      return user;
    });

    // Fraud policy: a suspended account's live requests are cancelled and donors are told not to go
    if (status === 'suspended') {
      await cancelRequestsOfSuspendedUser(userId).catch(() => undefined);
    }

    emitAdminEvent('admin:dashboard:updated', { userId, status });

    return {
      id: updated.id,
      name: updated.fullName,
      email: updated.email,
      phone: updated.phone,
      role: updated.role,
      status: updated.status,
      verified: updated.isEmailVerified,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async listDonors(params: any) {
    const { search, bloodGroup, status, country, state, district, page = 1, pageSize = 10 } = params;

    const where: any = {};
    if (country && country !== 'ALL') where.country = String(country).toUpperCase();
    if (bloodGroup && bloodGroup !== 'ALL') where.bloodGroup = bloodGroup;
    // Exact matches: states and districts come from the country's fixed lists
    if (state) where.state = state;
    if (district) where.district = district;
    if (status && status !== 'ALL') {
      where.isAvailable = status === 'active';
    }
    if (search) {
      where.OR = [
        { city: { contains: search } },
        { district: { contains: search } },
        { postalCode: { startsWith: search } },
        { user: { fullName: { contains: search } } },
      ];
    }

    const total = await prisma.donorProfile.count({ where });
    const donors = await prisma.donorProfile.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          include: {
            consentRecords: { where: { purpose: 'contact_sharing' }, orderBy: { grantedAt: 'desc' }, take: 1 },
            receivedReferral: { include: { referrer: { select: { fullName: true, username: true, email: true } } } },
          },
        },
      },
    });

    const items = donors.map((d) => toAdminDonor(d));

    return {
      data: items,
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async updateDonorRecord(donorId: string, updates: any, adminId?: string) {
    const current = await prisma.donorProfile.findUnique({ where: { id: donorId } });
    if (!current) {
      throw new AppError('Donor profile not found', 404, 'NOT_FOUND');
    }
    const locationTouched = ['country', 'state', 'district', 'city', 'postalCode'].some((k) => updates[k] !== undefined);
    const location = locationTouched
      ? validateLocation({
          country: updates.country ?? current.country,
          state: updates.state ?? current.state,
          district: updates.district ?? current.district,
          city: updates.city ?? current.city,
          postalCode: updates.postalCode ?? current.postalCode,
        })
      : null;

    const updated = await prisma.donorProfile.update({
      where: { id: donorId },
      data: {
        ...(updates.bloodGroup && { bloodGroup: updates.bloodGroup }),
        ...(location && {
          country: location.country,
          state: location.state,
          district: location.district,
          city: location.city,
          postalCode: location.postalCode,
        }),
        ...(updates.isAvailable !== undefined && { isAvailable: updates.isAvailable }),
        ...(updates.status !== undefined && { isAvailable: updates.status === 'active' }),
      },
    });
    // Name corrections live on the account
    if (typeof updates.name === 'string' && updates.name.trim().length >= 2) {
      await prisma.user.update({ where: { id: current.userId }, data: { fullName: updates.name.trim() } });
    }
    const full = await prisma.donorProfile.findUnique({
      where: { id: updated.id },
      include: {
        user: {
          include: {
            consentRecords: { where: { purpose: 'contact_sharing' }, orderBy: { grantedAt: 'desc' }, take: 1 },
            receivedReferral: { include: { referrer: { select: { fullName: true, username: true, email: true } } } },
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: adminId || null,
        action: 'ADMIN_UPDATE_DONOR',
        entityType: 'DonorProfile',
        entityId: donorId,
        details: JSON.stringify(updates),
      },
    });

    emitAdminEvent('admin:record:updated', { type: 'donor', donorId });

    return toAdminDonor(full!);
  }

  async listReferrals(params: { page?: number; pageSize?: number; search?: string; country?: string }) {
    const { page = 1, pageSize = 10, search, country } = params;

    const where: any = {};
    if (country && country !== 'ALL') {
      where.referrer = { country: country.toUpperCase() };
    }
    if (search) {
      where.OR = [
        { referralCode: { contains: search } },
        { referrer: { fullName: { contains: search } } },
      ];
    }

    const total = await prisma.referral.count({ where });
    const referrals = await prisma.referral.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        referrer: { select: { fullName: true, email: true, country: true } },
        referred: { select: { fullName: true, email: true } },
      },
    });

    const items = referrals.map((r) => ({
      id: r.id,
      code: r.referralCode,
      referrerName: r.referrer.fullName,
      referrerEmail: r.referrer.email,
      country: r.referrer.country,
      referredName: r.referred ? r.referred.fullName : undefined,
      status: r.status,
      isActive: r.status === 'active',
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt ? r.completedAt.toISOString() : undefined,
    }));

    return {
      data: items,
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async toggleReferralCode(referralId: string, isActive: boolean, adminId?: string) {
    const updated = await prisma.referral.update({
      where: { id: referralId },
      data: { status: isActive ? 'active' : 'revoked' },
      include: {
        referrer: true,
        referred: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: adminId || null,
        action: 'TOGGLE_REFERRAL_CODE',
        entityType: 'Referral',
        entityId: referralId,
        details: JSON.stringify({ isActive, code: updated.referralCode }),
      },
    });

    return {
      id: updated.id,
      code: updated.referralCode,
      referrerName: updated.referrer.fullName,
      referrerEmail: updated.referrer.email,
      referredName: updated.referred ? updated.referred.fullName : undefined,
      status: updated.status,
      isActive: updated.status === 'active',
      createdAt: updated.createdAt.toISOString(),
      completedAt: updated.completedAt ? updated.completedAt.toISOString() : undefined,
    };
  }

  async listAuditLogs(params: { entityType?: string; page?: number; pageSize?: number }) {
    const { entityType, page = 1, pageSize = 10 } = params;

    const where: any = {};
    if (entityType && entityType !== 'ALL') {
      where.entityType = entityType;
    }

    const total = await prisma.auditLog.count({ where });
    const logs = await prisma.auditLog.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { fullName: true, email: true, role: true } } },
    });

    const items = logs.map((l) => ({
      id: l.id,
      timestamp: l.createdAt.toISOString(),
      actorId: l.actorId || 'system',
      actorName: l.actor ? l.actor.fullName : 'System Automation',
      actorRole: l.actor ? l.actor.role : 'system',
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId || undefined,
      details: l.details ? JSON.stringify(l.details) : undefined,
    }));

    return {
      data: items,
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async getSettings() {
    let settings = await prisma.organizationSettings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await prisma.organizationSettings.create({
        data: { id: 'default' },
      });
    }

    return {
      name: settings.name,
      supportHelpline: settings.supportHelpline,
      supportEmail: settings.supportEmail,
      emergencyUrgentLine: settings.emergencyUrgentLine,
      currentPolicyVersion: settings.currentPolicyVersion,
      referralRewardPoints: settings.referralRewardPoints,
      maintenanceMode: settings.maintenanceMode,
    };
  }

  async updateSettings(updates: any, adminId?: string) {
    const updated = await prisma.organizationSettings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        ...updates,
      },
      update: updates,
    });

    await prisma.auditLog.create({
      data: {
        actorId: adminId || null,
        action: 'UPDATE_SETTINGS',
        entityType: 'OrganizationSettings',
        entityId: 'default',
        details: updates,
      },
    });

    return this.getSettings();
  }
}

export const adminService = new AdminService();
