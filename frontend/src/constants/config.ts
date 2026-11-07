import type { AppMode } from '../types/api';
import { getDefaultCountry } from './countries';

const envMode = import.meta.env.VITE_APP_MODE;
const isTest = import.meta.env.MODE === 'test';
const validatedMode: AppMode = isTest ? 'demo' : (envMode === 'api' ? 'api' : 'demo');

export const appConfig = {
  name: 'BloodBridge',
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
};
