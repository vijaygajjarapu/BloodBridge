/** Donor self-check (GET /eligibility/me) */
export type Sex = 'male' | 'female' | 'other';

export interface Eligibility {
  hasDonorProfile: boolean;
  eligible: boolean;
  reasons: string[];
  nextEligibleDate: string | null;
  missing: ('dateOfBirth' | 'sex' | 'weight')[];
  details: {
    sex: Sex | null;
    weightKg: number | null;
    lastDonationDate: string | null;
    deferralReason: string | null;
    deferredUntil: string | null;
  };
  rules: {
    minAge: number;
    maxAge: number;
    maxAgeFirstTime: number;
    minWeightKg: number;
    gapDaysMale: number;
    gapDaysFemale: number;
    gapDaysUnknown: number;
  };
  deferralOptions: { key: string; label: string }[];
  note: string;
}
