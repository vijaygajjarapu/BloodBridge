import { prisma } from '../../config/database.js';
import { parseAdultDateOfBirth } from '../../shared/age.js';
import { AppError } from '../../shared/types.js';
import { hashPassword, generateRandomToken } from '../../shared/password.js';
import { emitToUser, emitAdminEvent } from '../../sockets/socket.server.js';
import { maskPhone, formatPhone, validateLocation, requirePhone } from '../../shared/location.js';
import { authService } from '../auth/auth.service.js';
import { logger } from '../../shared/logger.js';
import type { DonorRegistrationPayload, UpdateDonorPayload, DonorListQueryParams } from './donors.schemas.js';

export function maskPhoneNumber(phone?: string | null, countryCode?: string | null): string {
  return maskPhone(phone, countryCode);
}

export class DonorService {
  async listMyDonors(userId: string, params: DonorListQueryParams) {
    const { search, bloodGroup, status, country, state, district, page = 1, pageSize = 10, sortBy = 'createdAt', sortOrder = 'desc' } = params;

    // Retrieve referral codes owned by this user
    const myReferrals = await prisma.referral.findMany({
      where: { referrerUserId: userId, referredUserId: { not: null } },
      select: { referredUserId: true },
    });

    const referredUserIds = myReferrals.map((r) => r.referredUserId!).filter(Boolean);

    // Build filter query
    const where: any = {
      userId: { in: referredUserIds },
    };

    if (bloodGroup && bloodGroup !== 'ALL') {
      where.bloodGroup = bloodGroup;
    }

    if (country && country !== 'ALL') {
      where.country = country.toUpperCase();
    }

    // Exact matches: states and districts come from the country's fixed lists
    if (state) {
      where.state = state;
    }

    if (district) {
      where.district = district;
    }

    if (status && status !== 'ALL') {
      if (status === 'active') {
        where.isAvailable = true;
      } else if (status === 'inactive') {
        where.isAvailable = false;
      }
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
    const skip = (page - 1) * pageSize;

    let orderBy: any = { createdAt: sortOrder };
    if (sortBy === 'name' || sortBy === 'fullName') {
      orderBy = { user: { fullName: sortOrder } };
    } else if (sortBy === 'bloodGroup') {
      orderBy = { bloodGroup: sortOrder };
    } else if (sortBy === 'totalDonations') {
      orderBy = { totalDonations: sortOrder };
    } else if (sortBy === 'city') {
      orderBy = { city: sortOrder };
    } else if (sortBy === 'lastDonationDate' || sortBy === 'lastDonation') {
      orderBy = { lastDonationDate: sortOrder };
    } else {
      orderBy = { createdAt: sortOrder };
    }

    const profiles = await prisma.donorProfile.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    const items = profiles.map((p) => ({
      id: p.id,
      name: p.user.fullName,
      fullName: p.user.fullName,
      bloodGroup: p.bloodGroup,
      location: {
        country: p.country,
        city: p.city,
        state: p.state,
        district: p.district,
        postalCode: p.postalCode,
      },
      country: p.country,
      city: p.city,
      state: p.state,
      district: p.district,
      postalCode: p.postalCode,
      status: (p.user.status === 'active' ? 'active' : 'unavailable') as any,
      willingness: (p.donationWillingness || 'regular') as any,
      availability: p.isAvailable ? 'available' : 'busy',
      isEligibleNow: p.isAvailable,
      lastDonatedAt: p.lastDonationDate ? p.lastDonationDate.toISOString() : undefined,
      lastDonation: p.lastDonationDate ? p.lastDonationDate.toISOString().split('T')[0] : 'Never',
      totalDonations: p.totalDonations,
      registeredAt: p.createdAt.toISOString(),
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

  async getDonorById(id: string, requestingUserId?: string, requestingUserRole?: string) {
    const profile = await prisma.donorProfile.findFirst({
      where: {
        OR: [{ id }, { userId: id }],
      },
      include: {
        user: {
          include: {
            consentRecords: true,
            receivedReferral: true,
          },
        },
      },
    });

    if (!profile) {
      throw new AppError('Donor profile not found', 404, 'NOT_FOUND');
    }

    // Determine authorization to view unmasked contact
    const isOwner = requestingUserId === profile.userId;
    const isAdmin = requestingUserRole === 'admin';
    const isReferrer = profile.user.receivedReferral?.referrerUserId === requestingUserId;

    // Check contact sharing consent
    const contactConsent = profile.user.consentRecords.find((c) => c.purpose === 'contact_sharing' && c.isGranted);

    // canAccessContact = true if admin, owner, or (referrer/coordinator with consent)
    const canAccessContact = isOwner || isAdmin || (isReferrer && !!contactConsent);

    const mobileNumber = canAccessContact
      ? formatPhone(profile.user.phone, profile.country) || 'Not provided'
      : maskPhoneNumber(profile.user.phone, profile.country);

    const contactUnavailableReason = canAccessContact
      ? null
      : 'Direct contact details require verified coordinator authorization or explicit donor contact consent.';

    const incomingRef = profile.user.receivedReferral;

    return {
      id: profile.id,
      userId: profile.userId,
      name: profile.user.fullName,
      fullName: profile.user.fullName,
      email: canAccessContact ? profile.user.email : '••••••@•••••.org',
      mobileNumber,
      contactNumber: mobileNumber,
      bloodGroup: profile.bloodGroup,
      location: {
        country: profile.country,
        city: profile.city,
        state: profile.state,
        district: profile.district,
        postalCode: profile.postalCode,
      },
      country: profile.country,
      city: profile.city,
      state: profile.state,
      district: profile.district,
      postalCode: profile.postalCode,
      status: (profile.user.status === 'active' ? 'active' : 'unavailable') as any,
      willingness: (profile.donationWillingness || 'regular') as any,
      donationWillingness: profile.donationWillingness,
      isAvailable: profile.isAvailable,
      isEligibleNow: profile.isAvailable,
      emergencyAvailability: profile.isAvailable,
      lastDonationDate: profile.lastDonationDate?.toISOString() || null,
      lastDonatedAt: profile.lastDonationDate ? profile.lastDonationDate.toISOString() : undefined,
      totalDonations: profile.totalDonations,
      totalDonationsCount: profile.totalDonations,
      canAccessContact,
      contactUnavailableReason,
      contactSharingConsentGranted: Boolean(contactConsent),
      registeredAt: profile.createdAt.toISOString(),
      referredByCode: incomingRef ? incomingRef.referralCode : undefined,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  async registerDonor(input: DonorRegistrationPayload) {
    const location = validateLocation(
      { country: input.country, state: input.state, district: input.district, city: input.city, postalCode: input.postalCode },
      { requireCity: true },
    );
    const phone = requirePhone(location.country, input.phone || input.mobileNumber, 'mobileNumber');
    const email = (input.email || '').toLowerCase().trim();
    if (!email) {
      throw new AppError('Email address is required.', 400, 'VALIDATION_FAILED', { email: 'Email address is required.' });
    }

    const willingness = input.willingness || input.donationWillingness || 'regular';
    const contactConsent = input.contactConsent ?? input.contactSharingConsent ?? true;
    const termsAccepted = input.termsAccepted ?? true;

    // 1. Verify referral code exists
    const normalizedReferralCode = input.referralCode.trim().toUpperCase();
    const referral = await prisma.referral.findUnique({
      where: { referralCode: normalizedReferralCode },
      include: { referrer: true },
    });

    if (!referral) {
      throw new AppError('Invalid or expired referral code.', 404, 'NOT_FOUND');
    }

    if (referral.status !== 'active') {
      throw new AppError('This referral code has been deactivated.', 400, 'REFERRAL_EXPIRED');
    }

    // Check existing account: tell the person exactly which detail is already in use
    const [phoneOwner, emailOwner] = await Promise.all([
      prisma.user.findFirst({ where: { phone } }),
      prisma.user.findUnique({ where: { email } }),
    ]);

    // Started registering before but never entered the email code: let them finish by signing in
    const unfinished = [phoneOwner, emailOwner].find((u) => u && !u.isEmailVerified);
    if (unfinished && (!phoneOwner || !emailOwner || phoneOwner.id === emailOwner.id)) {
      throw new AppError(
        'You already started registering with these details. Please sign in with your email and password to finish verifying your email.',
        409,
        'CONFLICT',
        {
          ...(phoneOwner ? { phone: 'Already used in an unfinished registration. Please sign in to finish.' } : {}),
          ...(emailOwner ? { email: 'Already used in an unfinished registration. Please sign in to finish.' } : {}),
        },
      );
    }

    if (phoneOwner || emailOwner) {
      const fieldErrors: Record<string, string> = {};
      if (phoneOwner) fieldErrors.phone = 'This mobile number is already registered. Please sign in, or use a different number.';
      if (emailOwner) fieldErrors.email = 'This email address is already registered. Please sign in, or use a different email.';
      const message = phoneOwner && emailOwner
        ? 'This mobile number and email address are already registered with BloodBridge.'
        : phoneOwner
          ? 'This mobile number is already registered with BloodBridge.'
          : 'This email address is already registered with BloodBridge.';
      throw new AppError(message, 409, 'CONFLICT', fieldErrors);
    }

    // Adults only
    const dateOfBirth = parseAdultDateOfBirth(input.dateOfBirth);

    // The donor chooses their own password; the account stays unverified until they enter the emailed code
    const passwordHash = await hashPassword(input.password);

    const userReferralCode = 'SAVIOR-' + generateRandomToken(4).toUpperCase();

    const created = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          fullName: input.fullName,
          dateOfBirth,
          email,
          phone,
          country: location.country,
          passwordHash,
          role: 'donor',
          status: 'active',
          isEmailVerified: false,
        },
      });

      // Create donor profile
      const donorProfile = await tx.donorProfile.create({
        data: {
          userId: user.id,
          bloodGroup: input.bloodGroup,
          country: location.country,
          state: location.state,
          district: location.district,
          city: location.city,
          postalCode: location.postalCode,
          donationWillingness: willingness,
          isAvailable: true,
          totalDonations: 0,
        },
      });

      // Create user's own shareable referral code
      await tx.referral.create({
        data: {
          referrerUserId: user.id,
          referralCode: userReferralCode,
          status: 'active',
        },
      });

      // Link incoming referral attribution (keep master referral code active)
      await tx.referral.create({
        data: {
          referrerUserId: referral.referrerUserId,
          referralCode: `${referral.referralCode}-${generateRandomToken(4).toUpperCase()}`,
          referredUserId: user.id,
          status: 'completed',
          completedAt: new Date(),
        },
      });

      // Consent records
      await tx.consentRecord.createMany({
        data: [
          {
            userId: user.id,
            purpose: 'contact_sharing',
            policyVersion: 'v2.4-2026',
            isGranted: contactConsent,
          },
          {
            userId: user.id,
            purpose: 'terms_and_privacy',
            policyVersion: 'v2.4-2026',
            isGranted: termsAccepted,
          },
        ],
      });

      // Notify the referrer
      await tx.notification.create({
        data: {
          recipientId: referral.referrerUserId,
          notificationType: 'referral_success',
          title: 'New Donor Enrolled in Your Network!',
          message: `${input.fullName} (${input.bloodGroup}, ${location.city}, ${location.district}) registered using your invitation code.`,
          relatedEntity: donorProfile.id,
        },
      });

      return { user, donorProfile };
    });

    // Real-time events
    emitToUser(referral.referrerUserId, 'donor:list:updated', {
      message: `${input.fullName} has joined your donor network.`,
    });
    emitToUser(referral.referrerUserId, 'referral:completed', {
      referralCode: input.referralCode,
      referredUserName: input.fullName,
    });
    emitAdminEvent('admin:dashboard:updated', { reason: 'New donor enrolled' });

    // Sign-up must be confirmed: send the 6-digit code to their email
    let codeSent = true;
    try {
      await authService.sendEmailOtp(email, 'registration', created.user.id, input.fullName);
    } catch (err: any) {
      codeSent = false;
      logger.error(`Could not send the registration code to ${email}: ${err?.message}`);
    }

    return {
      success: true,
      requiresVerification: true,
      codeSent,
      email,
      donorId: created.donorProfile.id,
      fullName: created.user.fullName,
      bloodGroup: created.donorProfile.bloodGroup,
      message: codeSent
        ? `Almost done! We sent a 6-digit code to ${email}. Enter it to activate your account.`
        : 'Your account was created, but we could not send the code. Tap "Resend code" to try again.',
      assignedReferralCode: userReferralCode,
      referralCodeCreated: userReferralCode,
    };
  }

  async updateDonor(id: string, updates: UpdateDonorPayload, requestingUserId: string) {
    const profile = await prisma.donorProfile.findFirst({
      where: { OR: [{ id }, { userId: id }] },
      include: { user: true },
    });

    if (!profile) {
      throw new AppError('Donor profile not found', 404, 'NOT_FOUND');
    }

    if (profile.userId !== requestingUserId) {
      const user = await prisma.user.findUnique({ where: { id: requestingUserId } });
      if (user?.role !== 'admin') {
        throw new AppError('You do not have permission to update this profile.', 403, 'FORBIDDEN');
      }
    }

    // Any location change is checked against the country's regions as a whole
    const locationTouched = ['country', 'state', 'district', 'city', 'postalCode'].some((k) => (updates as any)[k] !== undefined);
    const location = locationTouched
      ? validateLocation({
          country: updates.country ?? profile.country,
          state: updates.state ?? profile.state,
          district: updates.district ?? profile.district,
          city: updates.city ?? profile.city,
          postalCode: updates.postalCode ?? profile.postalCode,
        })
      : null;

    const updated = await prisma.$transaction(async (tx) => {
      if (location && location.country !== profile.user.country) {
        await tx.user.update({ where: { id: profile.userId }, data: { country: location.country } });
      }
      if (updates.fullName) {
        await tx.user.update({
          where: { id: profile.userId },
          data: { fullName: updates.fullName },
        });
      }

      return tx.donorProfile.update({
        where: { id: profile.id },
        data: {
          ...(location && {
            country: location.country,
            state: location.state,
            district: location.district,
            city: location.city,
            postalCode: location.postalCode,
          }),
          ...(updates.bloodGroup && { bloodGroup: updates.bloodGroup }),
          ...(updates.donationWillingness && { donationWillingness: updates.donationWillingness }),
          ...(updates.isAvailable !== undefined && { isAvailable: updates.isAvailable }),
        },
        include: { user: true },
      });
    });

    emitToUser(profile.userId, 'donor:profile:updated', { donorId: updated.id });

    return this.getDonorById(updated.id, requestingUserId);
  }

  async reportIncorrectInfo(donorId: string, reason: string, reporterUserId?: string) {
    await prisma.supportTicket.create({
      data: {
        userId: reporterUserId || null,
        name: 'Donor Report',
        email: 'report@bloodbridge.internal',
        subject: `Discrepancy report for donor ID ${donorId}`,
        message: reason,
        category: 'medical',
        status: 'open',
      },
    });

    emitAdminEvent('admin:record:updated', { type: 'donor_report', donorId });

    return {
      success: true,
      message: 'Report logged successfully. Our operations team will review the information.',
    };
  }
}

export const donorService = new DonorService();
