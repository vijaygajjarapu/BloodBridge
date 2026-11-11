/** BloodNation is for adults only (18+). Matches backend/src/shared/age.ts */
export const MIN_ACCOUNT_AGE = 18;
export const UNDER_AGE_MESSAGE = 'BloodNation is only for people aged 18 or older. You can join on your 18th birthday.';

/** Age in whole years, or null when the date isn't valid */
export function ageFromDob(value: string | undefined | null): number | null {
  if (!value) return null;
  const birth = new Date(value);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export const isAdultDob = (value: string | undefined | null) => {
  const age = ageFromDob(value);
  return age !== null && age >= MIN_ACCOUNT_AGE;
};

/** Latest date of birth allowed in date pickers (exactly 18 years ago today) */
export function maxAdultDob() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - MIN_ACCOUNT_AGE);
  return d.toISOString().slice(0, 10);
}
