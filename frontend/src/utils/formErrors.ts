import type { ApiError } from '../types/api';

/** Backend field names that mean the same form field */
const FIELD_ALIASES: Record<string, string> = {
  mobileNumber: 'phone',
  phoneNumber: 'phone',
  fullName: 'fullName',
  name: 'name',
};

function asApiError(err: unknown): Partial<ApiError> {
  return (err && typeof err === 'object' ? err : {}) as Partial<ApiError>;
}

/** Field-level messages from a server error, keyed by form field name */
export function getFieldErrors(err: unknown, knownFields?: readonly string[]): Record<string, string> {
  const raw = asApiError(err).fieldErrors || {};
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(raw)) {
    const field = FIELD_ALIASES[key] || key;
    if (knownFields && !knownFields.includes(field)) continue;
    if (!out[field]) out[field] = message;
  }
  return out;
}

/**
 * Shows server errors under the matching fields of a react-hook-form form.
 * Returns true when at least one field got a message (so a generic banner is not needed).
 */
export function applyFieldErrors<F extends string>(
  err: unknown,
  setError: (name: F, error: { type: string; message: string }, options?: { shouldFocus: boolean }) => void,
  knownFields: readonly F[],
): boolean {
  const fieldErrors = getFieldErrors(err, knownFields as readonly string[]);
  const entries = Object.entries(fieldErrors);
  entries.forEach(([field, message], i) => {
    setError(field as F, { type: 'server', message }, { shouldFocus: i === 0 });
  });
  return entries.length > 0;
}

/** Plain-language message for the top of a form */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = asApiError(err);
  if (e.code === 'NETWORK_ERROR' || e.message === 'Failed to fetch') {
    return 'We could not reach BloodNation. Please check your internet connection and try again.';
  }
  if (e.code === 'REQUEST_TIMEOUT') return 'This is taking too long. Please try again.';
  return e.message || fallback;
}

/** Heading for an error banner, matching what went wrong */
export function errorTitle(err: unknown): string {
  const e = asApiError(err);
  if (e.status === 409 || e.code === 'CONFLICT') return 'Already registered';
  if (e.status === 400 || e.code === 'VALIDATION_FAILED') return 'Please check your details';
  if (e.status === 401 || e.code === 'UNAUTHORIZED') return 'Sign-in failed';
  if (e.status === 404 || e.code === 'NOT_FOUND') return 'Not found';
  if (e.status === 403 || e.code === 'FORBIDDEN') return 'Access blocked';
  if (e.status === 429 || e.code === 'RATE_LIMIT_EXCEEDED' || e.code === 'MAX_ATTEMPTS_EXCEEDED') return 'Please wait a moment';
  if (e.code === 'NETWORK_ERROR') return 'Connection problem';
  return 'Something went wrong';
}
