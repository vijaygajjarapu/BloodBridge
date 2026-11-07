import React, { useState } from 'react';
import { appConfig } from '../../constants/config';
import { getPreferredCountryCode } from '../../constants/countries';

interface GoogleButtonProps {
  label?: string;
  /** Country picked on the form, saved on new Google accounts */
  country?: string;
  onError?: (message: string) => void;
}

/**
 * "Continue with Google": asks the backend for Google's sign-in address, then sends the browser there.
 * Google returns to /auth/google/callback, which finishes signing in.
 */
export const GoogleButton: React.FC<GoogleButtonProps> = ({ label = 'Continue with Google', country, onError }) => {
  const [loading, setLoading] = useState(false);

  const start = async () => {
    if (appConfig.isDemo) {
      onError?.('Google sign-in is not available in demo mode. Start the full app to use it.');
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({ country: country || getPreferredCountryCode() });
      const res = await fetch(`${appConfig.apiBaseUrl}/auth/google?${qs.toString()}`, { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        throw new Error(body.message || 'Google sign-in is not available right now.');
      }
      window.location.assign(body.url);
    } catch (err: unknown) {
      setLoading(false);
      onError?.((err as { message?: string })?.message || 'Google sign-in is not available right now.');
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg border border-line-border bg-white px-4 py-2.5 text-sm font-semibold text-ink-main shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
      >
        <span
          aria-hidden="true"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-line-border text-xs font-bold text-ink-secondary"
        >
          G
        </span>
        {loading ? 'Opening Google…' : label}
      </button>
      <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
        <span className="h-px flex-1 bg-line-border" />
        or
        <span className="h-px flex-1 bg-line-border" />
      </div>
    </div>
  );
};
