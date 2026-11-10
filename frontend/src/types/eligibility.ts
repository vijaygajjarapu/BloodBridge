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
  /** On call: contacted first for emergencies until this time (null = not on call) */
  onCall?: { until: string | null; options: number[] };
  /** Blood group confirmed by our team from a blood bank card / lab report */
  bloodGroupVerified?: { at: string; source: string | null } | null;
  /** "Pause my alerts" */
  pause?: { until: string | null; untilTurnedOn: boolean; active: boolean; reason: string | null; options: number[] };
  /** Recent donations; status pending_donor = the family recorded it and the donor should confirm */
  donations?: { id: string; donatedOn: string; source: 'request' | 'self'; place: string | null; status: 'pending_donor' | 'confirmed' }[];
  note: string;
}
