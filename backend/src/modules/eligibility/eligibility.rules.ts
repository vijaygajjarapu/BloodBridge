/**
 * Donor eligibility rules, based on India's NBTC "Guidelines for Blood Donor Selection and Blood Donor
 * Referral" (2017) and the Drugs & Cosmetics Rules. Where sources differ, the stricter value is used.
 * All numbers live here so a doctor / blood bank officer can review and change them in one place.
 *
 * The app can only check what the donor tells it. The blood bank always does the final check
 * (haemoglobin, blood pressure, pulse, temperature, health questions) before collecting blood.
 */

export const RULES = {
  minAge: 18,
  maxAge: 65,
  /** First-time donors above this age are not accepted */
  maxAgeFirstTime: 60,
  minWeightKg: 45,
  /** Days between whole-blood donations */
  gapDaysMale: 90,
  gapDaysFemale: 120,
  /** Used when sex is not given (the stricter value) */
  gapDaysUnknown: 120,
} as const;

export type DeferralKey =
  | 'tattoo_piercing'
  | 'pregnancy_delivery'
  | 'miscarriage_abortion'
  | 'breastfeeding'
  | 'major_surgery'
  | 'minor_surgery'
  | 'dental_surgery'
  | 'blood_transfusion'
  | 'typhoid'
  | 'malaria'
  | 'dengue_chikungunya'
  | 'fever_infection'
  | 'antibiotics'
  | 'rabies_vaccine'
  | 'hepatitis_contact'
  | 'permanent';

/** Self-declared reasons to wait, and how long to wait after the date given */
export const DEFERRALS: Record<DeferralKey, { label: string; days?: number; months?: number; ongoing?: boolean; permanent?: boolean }> = {
  tattoo_piercing: { label: 'Tattoo, piercing or acupuncture', months: 12 },
  pregnancy_delivery: { label: 'Pregnancy / gave birth', months: 12 },
  miscarriage_abortion: { label: 'Miscarriage or abortion', months: 6 },
  breastfeeding: { label: 'Currently breastfeeding', ongoing: true },
  major_surgery: { label: 'Major surgery', months: 12 },
  minor_surgery: { label: 'Minor surgery', months: 6 },
  dental_surgery: { label: 'Tooth extraction or dental surgery', months: 6 },
  blood_transfusion: { label: 'Received a blood transfusion', months: 12 },
  typhoid: { label: 'Typhoid (from recovery)', months: 12 },
  malaria: { label: 'Malaria (from recovery)', months: 3 },
  dengue_chikungunya: { label: 'Dengue or chikungunya (from recovery)', months: 6 },
  fever_infection: { label: 'Fever, cold or infection (from recovery)', days: 14 },
  antibiotics: { label: 'Antibiotics (from last dose)', days: 14 },
  rabies_vaccine: { label: 'Rabies vaccine', months: 12 },
  hepatitis_contact: { label: 'Close contact with someone with hepatitis', months: 12 },
  permanent: { label: 'A condition my doctor says rules out donating (for example HIV, hepatitis B or C)', permanent: true },
};

const DAY = 24 * 60 * 60 * 1000;
/** Far-future date used for "until I clear it" deferrals */
export const ONGOING_UNTIL = new Date('9999-12-31T00:00:00.000Z');

export function deferralEnds(key: DeferralKey, from: Date): Date {
  const d = DEFERRALS[key];
  if (d.permanent || d.ongoing) return ONGOING_UNTIL;
  const end = new Date(from);
  if (d.months) end.setMonth(end.getMonth() + d.months);
  if (d.days) end.setTime(end.getTime() + d.days * DAY);
  return end;
}

export function gapDaysFor(sex?: string | null) {
  if (sex === 'male') return RULES.gapDaysMale;
  if (sex === 'female') return RULES.gapDaysFemale;
  return RULES.gapDaysUnknown;
}

export function ageOn(dateOfBirth: Date, now: Date) {
  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const m = now.getMonth() - dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dateOfBirth.getDate())) age--;
  return age;
}

export interface EligibilityInput {
  dateOfBirth?: Date | null;
  sex?: string | null;
  weightKg?: number | null;
  lastDonationDate?: Date | null;
  totalDonations?: number | null;
  deferredUntil?: Date | null;
  deferralReason?: string | null;
  permanentlyDeferred?: boolean | null;
  /** Donor paused alerts (travel, exams, unwell...) until this time */
  pausedUntil?: Date | null;
}

export interface EligibilityResult {
  eligible: boolean;
  /** Why not (empty when eligible) */
  reasons: string[];
  /** When the donor can give again, if waiting is the only problem */
  nextEligibleDate: string | null;
  /** Details the donor has not given yet (they don't block matching) */
  missing: ('dateOfBirth' | 'sex' | 'weight')[];
}

export function checkEligibility(p: EligibilityInput, now = new Date()): EligibilityResult {
  const reasons: string[] = [];
  const missing: EligibilityResult['missing'] = [];
  let next: Date | null = null;
  let permanentBlock = false;
  const later = (d: Date) => { if (!next || d > next) next = d; };

  if (p.permanentlyDeferred) {
    reasons.push('You told us a condition rules out donating. Talk to a blood bank doctor if this has changed.');
    permanentBlock = true;
  }

  if (p.dateOfBirth) {
    const age = ageOn(p.dateOfBirth, now);
    if (age < RULES.minAge) {
      reasons.push(`Donors must be at least ${RULES.minAge} years old.`);
      const turns = new Date(p.dateOfBirth);
      turns.setFullYear(turns.getFullYear() + RULES.minAge);
      later(turns);
    } else if (age > RULES.maxAge) {
      reasons.push(`Donors must be ${RULES.maxAge} or younger.`);
      permanentBlock = true;
    } else if (!p.totalDonations && age > RULES.maxAgeFirstTime) {
      reasons.push(`First-time donors must be ${RULES.maxAgeFirstTime} or younger.`);
      permanentBlock = true;
    }
  } else missing.push('dateOfBirth');

  if (p.weightKg != null) {
    if (p.weightKg < RULES.minWeightKg) {
      reasons.push(`Donors must weigh at least ${RULES.minWeightKg} kg.`);
      permanentBlock = true;
    }
  } else missing.push('weight');

  if (!p.sex) missing.push('sex');

  if (p.lastDonationDate) {
    const gap = gapDaysFor(p.sex);
    const canFrom = new Date(p.lastDonationDate.getTime() + gap * DAY);
    if (canFrom > now) {
      reasons.push(`It has been less than ${gap} days since your last donation.`);
      later(canFrom);
    }
  }

  if (p.deferredUntil && p.deferredUntil > now) {
    const label = p.deferralReason && p.deferralReason in DEFERRALS ? DEFERRALS[p.deferralReason as DeferralKey].label : 'A health reason you added';
    if (p.deferredUntil >= ONGOING_UNTIL) {
      reasons.push(`${label}. Remove it from your profile when it no longer applies.`);
      if (p.deferralReason === 'permanent') permanentBlock = true;
    } else {
      reasons.push(`${label}: please wait until ${p.deferredUntil.toDateString()}.`);
      later(p.deferredUntil);
    }
  }

  const eligible = reasons.length === 0;
  const nextDate = next as Date | null;
  return {
    eligible,
    reasons,
    nextEligibleDate: !eligible && !permanentBlock && nextDate && nextDate < ONGOING_UNTIL ? nextDate.toISOString() : null,
    missing,
  };
}

/** Has the donor paused alerts right now? */
export function isPaused(p: { pausedUntil?: Date | null }, now = new Date()) {
  return Boolean(p.pausedUntil && p.pausedUntil > now);
}

/** Short form for matching: may this donor be alerted right now? (able to donate and not paused) */
export function canBeAlerted(p: EligibilityInput, now = new Date()) {
  return !isPaused(p, now) && checkEligibility(p, now).eligible;
}

/** The date a donor can give again after a donation */
export function canDonateAgainOn(lastDonationDate: Date, sex?: string | null) {
  return new Date(lastDonationDate.getTime() + gapDaysFor(sex) * DAY);
}

/** Pause choices in days (null = until I turn it back on) */
export const PAUSE_DAYS = [3, 7, 14, 30] as const;
