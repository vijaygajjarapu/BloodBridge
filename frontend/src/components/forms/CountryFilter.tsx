import React from 'react';
import { Globe2 } from 'lucide-react';
import { getEnabledCountries } from '../../constants/countries';

interface CountryFilterProps {
  value: string;
  onChange: (country: string) => void;
  className?: string;
}

/** Admin filter: "All countries" or one country. Lists only enabled countries. */
export const CountryFilter: React.FC<CountryFilterProps> = ({ value, onChange, className = '' }) => (
  <label className={`inline-flex items-center gap-2 text-xs font-semibold text-ink-secondary ${className}`}>
    <Globe2 className="w-4 h-4 text-brand-500" aria-hidden="true" />
    <span className="sr-only">Country</span>
    <select
      aria-label="Filter by country"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-line-border bg-white px-3 py-2 text-sm text-ink-main min-h-[40px] focus:outline-none focus:ring-2 focus:ring-brand-500"
    >
      <option value="ALL">All countries</option>
      {getEnabledCountries().map((c) => (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      ))}
    </select>
  </label>
);
