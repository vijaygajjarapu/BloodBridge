import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/shared/password.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding BloodBridge database (India sample data)...');

  // 0. Remove the old US sample donors from earlier seeds (accounts people created themselves are kept)
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          'elena.rostova@example.org',
          'david.chen@example.org',
          'sarah.jenkins@example.org',
          'carlos.mendez@example.org',
          'aisha.patel@example.org',
        ],
      },
    },
  });

  // 1. Organization Settings
  await prisma.organizationSettings.upsert({
    where: { id: 'default' },
    // Helplines are left empty until real numbers are set in Admin > Settings
    update: { supportHelpline: '', emergencyUrgentLine: '' },
    create: {
      id: 'default',
      name: 'BloodBridge',
      supportHelpline: '',
      supportEmail: 'support@bloodbridge.org',
      emergencyUrgentLine: '',
      currentPolicyVersion: 'v2.4-2026',
      referralRewardPoints: 50,
      maintenanceMode: false,
    },
  });

  // 2. Administrator User (Dr. Evelyn Reed)
  const adminPasswordHash = await hashPassword('AdminPassword2026!');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@bloodbridge.org' },
    update: {
      fullName: 'Dr. Evelyn Reed',
      passwordHash: adminPasswordHash,
      role: 'admin',
      status: 'active',
      isEmailVerified: true,
      phone: '+919000000100',
      country: 'IN',
    },
    create: {
      fullName: 'Dr. Evelyn Reed',
      email: 'admin@bloodbridge.org',
      phone: '+919000000100',
      country: 'IN',
      passwordHash: adminPasswordHash,
      role: 'admin',
      status: 'active',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  // 3. Primary Donor & Referrer (Marcus Vance)
  const donorPasswordHash = await hashPassword('Password123!');
  const marcusUser = await prisma.user.upsert({
    where: { email: 'marcus.vance@example.org' },
    update: {
      fullName: 'Marcus Vance',
      passwordHash: donorPasswordHash,
      role: 'donor',
      status: 'active',
      isEmailVerified: true,
      phone: '+919000000101',
      country: 'IN',
    },
    create: {
      fullName: 'Marcus Vance',
      email: 'marcus.vance@example.org',
      phone: '+919000000101',
      country: 'IN',
      passwordHash: donorPasswordHash,
      role: 'donor',
      status: 'active',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  // Marcus's Donor Profile
  await prisma.donorProfile.upsert({
    where: { userId: marcusUser.id },
    update: { country: 'IN', state: 'Telangana', district: 'Hyderabad', city: 'Hyderabad', postalCode: '500001' },
    create: {
      userId: marcusUser.id,
      bloodGroup: 'O+',
      country: 'IN',
      state: 'Telangana',
      district: 'Hyderabad',
      city: 'Hyderabad',
      postalCode: '500001',
      isAvailable: true,
      donationWillingness: 'regular',
      totalDonations: 12,
      lastDonationDate: new Date('2026-01-15T08:00:00Z'),
    },
  });

  // Marcus's Referral Code
  await prisma.referral.upsert({
    where: { referralCode: 'SAVIOR-MV2026' },
    update: {
      referrerUserId: marcusUser.id,
      referredUserId: null,
      status: 'active',
    },
    create: {
      referrerUserId: marcusUser.id,
      referralCode: 'SAVIOR-MV2026',
      referredUserId: null,
      status: 'active',
    },
  });

  // 4. Sample Donors in Marcus's Referral Network
  // Sample data only: names and numbers are made up
  const donorsData = [
    { fullName: 'Priya Sharma', email: 'priya.sharma@example.org', phone: '+919000000201', bloodGroup: 'B+', state: 'Telangana', district: 'Ranga Reddy', city: 'Gachibowli', postalCode: '500032', totalDonations: 4, isAvailable: true, contactConsent: true },
    { fullName: 'Rahul Verma', email: 'rahul.verma@example.org', phone: '+919000000202', bloodGroup: 'O-', state: 'Telangana', district: 'Hyderabad', city: 'Secunderabad', postalCode: '500003', totalDonations: 8, isAvailable: true, contactConsent: false }, // for the privacy masking test
    { fullName: 'Ananya Iyer', email: 'ananya.iyer@example.org', phone: '+919000000203', bloodGroup: 'A+', state: 'Karnataka', district: 'Bengaluru Urban', city: 'Bengaluru', postalCode: '560001', totalDonations: 2, isAvailable: true, contactConsent: true },
    { fullName: 'Mohammed Arif', email: 'mohammed.arif@example.org', phone: '+919000000204', bloodGroup: 'AB+', state: 'Telangana', district: 'Medchal-Malkajgiri', city: 'Kukatpally', postalCode: '500072', totalDonations: 5, isAvailable: false, contactConsent: true },
    { fullName: 'Kavya Reddy', email: 'kavya.reddy@example.org', phone: '+919000000205', bloodGroup: 'A-', state: 'Andhra Pradesh', district: 'Visakhapatnam', city: 'Visakhapatnam', postalCode: '530001', totalDonations: 1, isAvailable: true, contactConsent: true },
  ];

  for (const donor of donorsData) {
    const pwdHash = await hashPassword('password123');
    const user = await prisma.user.upsert({
      where: { email: donor.email },
      update: {},
      create: {
        fullName: donor.fullName,
        email: donor.email,
        phone: donor.phone,
        country: 'IN',
        passwordHash: pwdHash,
        role: 'donor',
        status: 'active',
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    await prisma.donorProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        bloodGroup: donor.bloodGroup,
        country: 'IN',
        state: donor.state,
        district: donor.district,
        city: donor.city,
        postalCode: donor.postalCode,
        isAvailable: donor.isAvailable,
        donationWillingness: 'regular',
        totalDonations: donor.totalDonations,
        lastDonationDate: new Date('2026-02-01T08:00:00Z'),
      },
    });

    // Record consent
    for (const record of [
      {
        userId: user.id,
        purpose: 'contact_sharing',
        policyVersion: 'v2.4-2026',
        isGranted: donor.contactConsent,
      },
      {
        userId: user.id,
        purpose: 'terms_and_privacy',
        policyVersion: 'v2.4-2026',
        isGranted: true,
      },
    ]) {
      await prisma.consentRecord.create({ data: record });
    }

    // Referral linkage
    const existingRef = await prisma.referral.findFirst({
      where: { referredUserId: user.id },
    });

    if (!existingRef) {
      await prisma.referral.create({
        data: {
          referrerUserId: marcusUser.id,
          referralCode: 'SAVIOR-MV2026-' + user.id.slice(0, 4),
          referredUserId: user.id,
          status: 'completed',
          completedAt: new Date(),
        },
      });
    } else if (existingRef.referrerUserId !== marcusUser.id) {
      await prisma.referral.update({
        where: { id: existingRef.id },
        data: { referrerUserId: marcusUser.id },
      });
    }
  }

  // 5. Initial Notifications for Marcus (cleared first so re-running the seed does not duplicate them)
  await prisma.notification.deleteMany({
    where: {
      recipientId: marcusUser.id,
      title: { in: ['Elena Rostova Joined Your Network', 'Priya Sharma Joined Your Network', 'Welcome to BloodBridge'] },
    },
  });
  for (const notif of [
    {
      recipientId: marcusUser.id,
      notificationType: 'referral_success',
      title: 'Priya Sharma Joined Your Network',
      message: 'Priya Sharma registered as a B+ blood donor using your invitation link.',
      isRead: false,
    },
    {
      recipientId: marcusUser.id,
      notificationType: 'system',
      title: 'Welcome to BloodBridge',
      message: 'Thank you for stepping up to be a savior. Share your referral code to expand the donor circle.',
      isRead: true,
    },
  ]) {
    await prisma.notification.create({ data: notif });
  }

  // 6. Audit Log Entry
  await prisma.auditLog.create({
    data: {
      actorId: adminUser.id,
      action: 'SYSTEM_SEED',
      entityType: 'System',
      details: JSON.stringify({ message: 'Database initialized with verified healthcare identities.' }),
    },
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
