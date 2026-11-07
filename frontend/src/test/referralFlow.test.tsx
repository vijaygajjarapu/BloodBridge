import { describe, it, expect } from 'vitest';
import { referralService, donorService } from '../services';
import { donorRegistrationSchema } from '../schemas/donorSchemas';
import type { DonorRegistrationInput } from '../types/donor';

describe('Referral & Donor Registration Flow', () => {
  it('validates a valid referral code and returns authorized referrer name', async () => {
    const result = await referralService.validateReferralCode('SAVIOR-MV2026');
    expect(result.isValid).toBe(true);
    expect(result.canDiscloseReferrer).toBe(true);
    expect(result.referrerName).toBe('Marcus Vance');
  });

  it('rejects an expired referral code with explicit expiration reason', async () => {
    const result = await referralService.validateReferralCode('EXPIRED');
    expect(result.isValid).toBe(false);
    expect(result.isExpired).toBe(true);
    expect(result.message).toContain('expired');
  });

  it('rejects an invalid or revoked referral code', async () => {
    const result = await referralService.validateReferralCode('INVALID');
    expect(result.isValid).toBe(false);
  });

  it('enforces non-preselected contact-sharing consent in donor schema validation', () => {
    const invalidData = {
      fullName: 'Amara Okafor',
      phone: '+1 (555) 012-9843',
      bloodGroup: 'B+',
      state: 'California',
      district: 'Orange County',
      city: 'Irvine',
      willingness: 'regular',
      contactSharingConsent: false, // User didn't check consent
      privacyAcknowledged: true,
      termsAccepted: true,
      referralCode: 'SAVIOR-MV2026',
    };

    const parseResult = donorRegistrationSchema.safeParse(invalidData);
    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      const consentIssue = parseResult.error.issues.find(
        (i) => i.path[0] === 'contactSharingConsent'
      );
      expect(consentIssue).toBeDefined();
      expect(consentIssue?.message).toContain('Explicit contact-sharing consent is required');
    }
  });

  it('registers a sample donor and confirms donor appears in referral donor list', async () => {
    const registrationInput: DonorRegistrationInput = {
      fullName: 'Test Savior Alex',
      phone: '+1 (555) 019-9999',
      bloodGroup: 'AB+',
      state: 'California',
      district: 'Los Angeles County',
      city: 'Glendale',
      willingness: 'regular',
      contactSharingConsent: true,
      privacyAcknowledged: true,
      termsAccepted: true,
      referralCode: 'SAVIOR-MV2026',
    };

    const registrationResult = await donorService.registerDonor(registrationInput);
    expect(registrationResult.success).toBe(true);
    expect(registrationResult.donorId).toBeDefined();
    expect(registrationResult.referralCodeCreated).toBeDefined();

    // Verify donor appears in listMyDonors
    const listResult = await donorService.listMyDonors({ search: 'Test Savior Alex' });
    expect(listResult.data.some((d) => d.name === 'Test Savior Alex')).toBe(true);
    const donor = listResult.data.find((d) => d.name === 'Test Savior Alex');
    expect(donor?.bloodGroup).toBe('AB+');
  });
});
