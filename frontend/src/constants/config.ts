import type { AppMode } from '../types/api';
import { getDefaultCountry } from './countries';

const envMode = import.meta.env.VITE_APP_MODE;
const isTest = import.meta.env.MODE === 'test';
const validatedMode: AppMode = isTest ? 'demo' : (envMode === 'api' ? 'api' : 'demo');

export const appConfig = {
  name: 'BloodNation',
  tagline: 'Be a Donor. Be a Savior.',
  mode: validatedMode,
  isDemo: validatedMode === 'demo',
  isApi: validatedMode === 'api',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  version: '1.0.0-prod',
  defaultPageSize: 10,
  requestTimeoutMs: 15000,
  // Signed-in users are signed out after this many minutes with no clicks or typing (server value wins)
  sessionIdleMinutes: Number(import.meta.env.VITE_SESSION_IDLE_MINUTES) || 5,
  // Helplines come from the country settings (shared/countries.ts); empty means "not set yet" and is hidden
  supportHelpline: getDefaultCountry().supportHelpline,
  emergencyUrgentLine: getDefaultCountry().emergencyLine,
  defaultCountry: getDefaultCountry().code,
  supportEmail: 'support@bloodbridge.org',
  currentPolicyVersion: 'v2.4-2026',
  storeName: 'BloodNation: Your Donor Circle',
  // Legal entity behind the brand. Rule 26, Companies (Incorporation) Rules 2014: a company website shows its
  // name, registered office, CIN, phone, email and a grievance contact on the home page. Fill the VITE_COMPANY_*
  // values in frontend/.env once the company is registered; empty values are simply not shown.
  company: {
    legalName: import.meta.env.VITE_COMPANY_LEGAL_NAME || 'Manjusha Health Tech Pvt Ltd',
    cin: import.meta.env.VITE_COMPANY_CIN || '',
    registeredOffice: import.meta.env.VITE_COMPANY_REGISTERED_OFFICE || '',
    phone: import.meta.env.VITE_COMPANY_PHONE || '',
    email: import.meta.env.VITE_COMPANY_EMAIL || '',
    grievanceOfficer: import.meta.env.VITE_COMPANY_GRIEVANCE_OFFICER || '',
  },
};
