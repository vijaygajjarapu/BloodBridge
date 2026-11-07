/**
 * Country settings shared with the backend (see /shared/countries.ts at the repository root).
 * Everything location-specific in the UI reads from here.
 */
export {
  COUNTRIES,
  DEFAULT_COUNTRY_CODE,
  OTHER_DISTRICT,
  getCountry,
  getEnabledCountries,
  getDefaultCountry,
  findRegion,
  normalizePhone,
  isValidPostalCode,
  formatPhone,
  maskPhone,
  formatDate,
} from '../../../shared/countries';
export type { CountryConfig, CountryRegion } from '../../../shared/countries';

import { getCountry, getDefaultCountry, DEFAULT_COUNTRY_CODE } from '../../../shared/countries';

const STORAGE_KEY = 'bloodbridge_country';

/** The country the visitor last picked (remembered in this browser), else the default (India). */
export function getPreferredCountryCode(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const country = getCountry(saved);
    if (country && country.enabled) return country.code;
  } catch {
    /* storage not available */
  }
  return DEFAULT_COUNTRY_CODE;
}

export function setPreferredCountryCode(code: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* storage not available */
  }
}

/** Country settings for a code, falling back to the default country */
export function countryOrDefault(code?: string | null) {
  return getCountry(code) || getDefaultCountry();
}
