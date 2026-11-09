import { describe, it, expect } from 'vitest';
import { checkEligibility, deferralEnds, gapDaysFor, RULES } from '../src/modules/eligibility/eligibility.rules.js';

const NOW = new Date('2026-11-08T10:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const yearsAgo = (n: number) => new Date(Date.UTC(NOW.getUTCFullYear() - n, 0, 1));
const adult = { dateOfBirth: yearsAgo(30), weightKg: 60, totalDonations: 3 };

describe('Donor eligibility rules (NBTC based)', () => {
  it('a healthy adult who never donated can donate', () => {
    const r = checkEligibility({ ...adult, sex: 'male' }, NOW);
    expect(r.eligible).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  it('men wait 90 days and women 120 days between donations', () => {
    expect(gapDaysFor('male')).toBe(90);
    expect(gapDaysFor('female')).toBe(120);
    expect(checkEligibility({ ...adult, sex: 'male', lastDonationDate: daysAgo(100) }, NOW).eligible).toBe(true);
    const woman = checkEligibility({ ...adult, sex: 'female', lastDonationDate: daysAgo(100) }, NOW);
    expect(woman.eligible).toBe(false);
    expect(woman.nextEligibleDate).not.toBeNull();
  });

  it('uses the stricter 120-day gap when sex is not given, and asks for it', () => {
    const r = checkEligibility({ ...adult, lastDonationDate: daysAgo(100) }, NOW);
    expect(r.eligible).toBe(false);
    expect(r.missing).toContain('sex');
  });

  it('enforces age 18-65, and 60 for first-time donors', () => {
    expect(checkEligibility({ ...adult, dateOfBirth: yearsAgo(17) }, NOW).eligible).toBe(false);
    expect(checkEligibility({ ...adult, dateOfBirth: yearsAgo(66) }, NOW).eligible).toBe(false);
    expect(checkEligibility({ ...adult, dateOfBirth: yearsAgo(62), totalDonations: 0 }, NOW).eligible).toBe(false);
    expect(checkEligibility({ ...adult, dateOfBirth: yearsAgo(62), totalDonations: 5 }, NOW).eligible).toBe(true);
  });

  it(`requires at least ${RULES.minWeightKg} kg`, () => {
    expect(checkEligibility({ ...adult, weightKg: 44 }, NOW).eligible).toBe(false);
    expect(checkEligibility({ ...adult, weightKg: 45 }, NOW).eligible).toBe(true);
  });

  it('a tattoo means waiting 12 months', () => {
    const until = deferralEnds('tattoo_piercing', NOW);
    expect(until.getUTCFullYear()).toBe(2027);
    const r = checkEligibility({ ...adult, deferredUntil: until, deferralReason: 'tattoo_piercing' }, NOW);
    expect(r.eligible).toBe(false);
    expect(r.nextEligibleDate?.slice(0, 10)).toBe(until.toISOString().slice(0, 10));
  });

  it('an ended waiting period no longer blocks', () => {
    expect(checkEligibility({ ...adult, deferredUntil: daysAgo(1), deferralReason: 'antibiotics' }, NOW).eligible).toBe(true);
  });

  it('a permanent reason blocks with no "next date"', () => {
    const r = checkEligibility({ ...adult, permanentlyDeferred: true }, NOW);
    expect(r.eligible).toBe(false);
    expect(r.nextEligibleDate).toBeNull();
  });
});
