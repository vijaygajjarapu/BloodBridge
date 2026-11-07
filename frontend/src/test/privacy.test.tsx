import { describe, it, expect } from 'vitest';
import { donorService, consentService } from '../services';

describe('Privacy & Contact Authorization Boundary', () => {
  it('masks contact phone number when donor has restricted contact sharing', async () => {
    // dnr_102 (David Chen) has canAccessContact = false
    const donor = await donorService.getDonorById('dnr_102');
    expect(donor.canAccessContact).toBe(false);
    expect(donor.contactNumber).toBeUndefined();
    expect(donor.contactUnavailableReason).toBeDefined();
  });

  it('provides verified contact phone number only when donor has granted explicit consent', async () => {
    // dnr_101 (Sarah Jenkins) has canAccessContact = true
    const donor = await donorService.getDonorById('dnr_101');
    expect(donor.canAccessContact).toBe(true);
    expect(donor.contactNumber).toBe('+1 (555) 018-4721');
  });

  it('records consent revocation and appends an entry to consent history', async () => {
    const updated = await consentService.updateConsent({
      contactSharingAllowed: false,
    });
    expect(updated.contactSharingAllowed).toBe(false);
    expect(updated.history.length).toBeGreaterThan(0);
    const latestHistory = updated.history[0];
    expect(latestHistory.action).toBe('withdrawn');
    expect(latestHistory.policyVersion).toBeDefined();
  });

  it('rejects access to non-existent donor ID with a typed DONOR_NOT_FOUND error', async () => {
    try {
      await donorService.getDonorById('dnr_non_existent');
      expect.fail('Should have thrown an error');
    } catch (err: unknown) {
      const error = err as { code: string; message: string };
      expect(error.code).toBe('DONOR_NOT_FOUND');
    }
  });
});
