/**
 * Country configuration shared by the backend and the frontend.
 * One app, one database: every account and donor profile carries a country code,
 * and everything location-specific (regions, phone rules, postal codes, labels,
 * legal text, date format) is read from here.
 *
 * To add a country: add its config below with enabled: true and its regions.
 */
import type { CountryConfig, CountryRegion } from './types.js';
import { INDIA_REGIONS } from './india.js';

export type { CountryConfig, CountryRegion } from './types.js';

export const DEFAULT_COUNTRY_CODE = 'IN';

export const COUNTRIES: CountryConfig[] = [
  {
    code: 'IN',
    name: 'India',
    enabled: true,
    dialCode: '+91',
    // 10-digit mobile number starting with 6, 7, 8 or 9
    phonePattern: '^[6-9]\\d{9}$',
    phoneExample: '98765 43210',
    phoneHint: '10-digit mobile number',
    postalCodeLabel: 'PIN code',
    // 6 digits, first digit 1-9
    postalCodePattern: '^[1-9]\\d{5}$',
    postalCodeExample: '500001',
    regionLabel: 'State / Union Territory',
    districtLabel: 'District',
    cityLabel: 'City / Town / Village',
    locale: 'en-IN',
    privacyLaw: 'Digital Personal Data Protection Act, 2023',
    supportHelpline: '',
    emergencyLine: '',
    nationalEmergencyNumber: '112',
    regions: INDIA_REGIONS,
  },
];

export const OTHER_DISTRICT = 'Other';

export function getCountry(code?: string | null): CountryConfig | undefined {
  const c = (code || '').trim().toUpperCase();
  return COUNTRIES.find((country) => country.code === c);
}

export function getEnabledCountries(): CountryConfig[] {
  return COUNTRIES.filter((c) => c.enabled);
}

export function getDefaultCountry(): CountryConfig {
  return getCountry(DEFAULT_COUNTRY_CODE) as CountryConfig;
}

export function findRegion(country: CountryConfig, regionName?: string | null): CountryRegion | undefined {
  const r = (regionName || '').trim().toLowerCase();
  return country.regions.find((region) => region.name.toLowerCase() === r);
}

/**
 * Accepts what a person types ("98765 43210", "+91 98765-43210", "09876543210")
 * and returns the stored form "+919876543210", or null when it is not a valid number.
 */
export function normalizePhone(countryCode: string | undefined | null, raw: string | undefined | null): string | null {
  const country = getCountry(countryCode) || getDefaultCountry();
  let digits = (raw || '').replace(/\D/g, '');
  const dialDigits = country.dialCode.replace(/\D/g, '');
  if (digits.startsWith('00' + dialDigits)) digits = digits.slice(2 + dialDigits.length);
  else if (digits.length > 10 && digits.startsWith(dialDigits)) digits = digits.slice(dialDigits.length);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!new RegExp(country.phonePattern).test(digits)) return null;
  return `${country.dialCode}${digits}`;
}

export function isValidPostalCode(countryCode: string | undefined | null, raw: string | undefined | null): boolean {
  const country = getCountry(countryCode) || getDefaultCountry();
  return new RegExp(country.postalCodePattern).test((raw || '').trim());
}

/** "+919876543210" -> "+91 98765 43210" */
export function formatPhone(phone: string | undefined | null, countryCode?: string | null): string {
  if (!phone) return '';
  const country = getCountry(countryCode) || getDefaultCountry();
  const digits = phone.replace(/\D/g, '');
  const dialDigits = country.dialCode.replace(/\D/g, '');
  const national = digits.startsWith(dialDigits) && digits.length > 10 ? digits.slice(dialDigits.length) : digits;
  if (country.code === 'IN' && national.length === 10) {
    return `${country.dialCode} ${national.slice(0, 5)} ${national.slice(5)}`;
  }
  return phone;
}

/** "+919876543210" -> "+91 ••••• •3210" */
export function maskPhone(phone: string | undefined | null, countryCode?: string | null): string {
  if (!phone) return 'Protected';
  const country = getCountry(countryCode) || getDefaultCountry();
  const digits = phone.replace(/\D/g, '');
  const last4 = digits.slice(-4);
  if (country.code === 'IN') return `${country.dialCode} ••••• •${last4}`;
  return `${country.dialCode} •••• ${last4}`;
}

/** Date in the country's usual format, e.g. 06/11/2026 for India */
export function formatDate(value: string | number | Date | undefined | null, countryCode?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const country = getCountry(countryCode) || getDefaultCountry();
  return d.toLocaleDateString(country.locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}
