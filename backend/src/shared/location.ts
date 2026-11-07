import { AppError } from './types.js';
import {
  getCountry,
  findRegion,
  normalizePhone,
  isValidPostalCode,
  maskPhone,
  formatPhone,
  DEFAULT_COUNTRY_CODE,
  getEnabledCountries,
  type CountryConfig,
} from '../../../shared/countries.js';

export { maskPhone, formatPhone, DEFAULT_COUNTRY_CODE };

/** Returns the enabled country for a code (defaults to India) or throws a 400. */
export function requireCountry(code?: string | null): CountryConfig {
  const country = getCountry(code || DEFAULT_COUNTRY_CODE);
  if (!country || !country.enabled) {
    throw new AppError('This country is not supported yet.', 400, 'VALIDATION_FAILED', {
      country: 'Please choose a supported country.',
    });
  }
  return country;
}

/** Normalises a phone number for the country ("+919876543210") or throws a 400. */
export function requirePhone(countryCode: string | undefined | null, raw: string | undefined | null, field = 'phone'): string {
  const country = requireCountry(countryCode);
  const phone = normalizePhone(country.code, raw);
  if (!phone) {
    throw new AppError(`Please enter a valid ${country.phoneHint} (e.g. ${country.dialCode} ${country.phoneExample}).`, 400, 'VALIDATION_FAILED', {
      [field]: `Enter a valid ${country.phoneHint}.`,
    });
  }
  return phone;
}

export interface LocationInput {
  country?: string | null;
  state?: string | null;
  district?: string | null;
  city?: string | null;
  postalCode?: string | null;
}

export interface CleanLocation {
  country: string;
  state: string;
  district: string;
  city: string;
  postalCode: string | null;
}

/**
 * Checks a location against the country's regions.
 * - state must be one of the country's states / union territories
 * - district: a listed district (canonical spelling is stored) or a typed name when the person chose "Other"
 * - postal code optional unless `requirePostalCode`, but must be valid when given
 */
export function validateLocation(input: LocationInput, opts: { requireCity?: boolean; requirePostalCode?: boolean } = {}): CleanLocation {
  const country = requireCountry(input.country);
  const errors: Record<string, string> = {};

  const region = findRegion(country, input.state);
  if (!region) errors.state = `Please choose a valid ${country.regionLabel.toLowerCase()}.`;

  const rawDistrict = (input.district || '').trim();
  let district = rawDistrict;
  if (!rawDistrict) {
    errors.district = `Please choose your ${country.districtLabel.toLowerCase()}.`;
  } else if (region) {
    const listed = region.districts.find((d) => d.toLowerCase() === rawDistrict.toLowerCase());
    if (listed) district = listed;
    else if (rawDistrict.length > 80) errors.district = `${country.districtLabel} name is too long.`;
  }

  const city = (input.city || '').trim();
  if (opts.requireCity && city.length < 2) errors.city = `Please enter your ${country.cityLabel.toLowerCase()}.`;

  const postalCode = (input.postalCode || '').trim();
  if (postalCode) {
    if (!isValidPostalCode(country.code, postalCode)) errors.postalCode = `Please enter a valid ${country.postalCodeLabel}.`;
  } else if (opts.requirePostalCode) {
    errors.postalCode = `Please enter your ${country.postalCodeLabel}.`;
  }

  if (Object.keys(errors).length) {
    throw new AppError(Object.values(errors)[0], 400, 'VALIDATION_FAILED', errors);
  }

  return {
    country: country.code,
    state: region!.name,
    district,
    city,
    postalCode: postalCode || null,
  };
}

/** Every stored form a typed mobile number could match, one per enabled country */
export function findPhoneCandidates(raw: string): string[] {
  const out = new Set<string>();
  for (const country of getEnabledCountries()) {
    const phone = normalizePhone(country.code, raw);
    if (phone) out.add(phone);
  }
  return [...out];
}
