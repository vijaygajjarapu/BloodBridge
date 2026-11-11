import { AppError } from './types.js';

/** BloodNation is for adults only: no accounts for people under 18 (India's DPDP Act treats under-18s as children) */
export const MIN_ACCOUNT_AGE = 18;
export const UNDER_AGE_MESSAGE = 'BloodNation is only for people aged 18 or older. You can join on your 18th birthday.';

export function ageOn(dateOfBirth: Date, now = new Date()) {
  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const m = now.getMonth() - dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dateOfBirth.getDate())) age--;
  return age;
}

/** Parses a date of birth and checks it's a real past date of someone 18 or older */
export function parseAdultDateOfBirth(raw: unknown): Date {
  const d = typeof raw === 'string' || raw instanceof Date ? new Date(raw) : new Date(NaN);
  if (isNaN(d.getTime()) || d >= new Date() || d.getFullYear() < 1900) {
    throw new AppError('Please enter a valid date of birth.', 400, 'VALIDATION_FAILED', { dateOfBirth: 'Please enter a valid date of birth.' });
  }
  if (ageOn(d) < MIN_ACCOUNT_AGE) {
    throw new AppError(UNDER_AGE_MESSAGE, 400, 'UNDER_AGE', { dateOfBirth: 'You must be 18 or older to join.' });
  }
  return d;
}
