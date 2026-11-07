import React, { useMemo, useState } from 'react';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import {
  countryOrDefault,
  findRegion,
  getEnabledCountries,
  OTHER_DISTRICT,
  setPreferredCountryCode,
} from '../../constants/countries';

export interface LocationValue {
  country: string;
  state: string;
  district: string;
  city?: string;
  postalCode?: string;
}

export interface LocationErrors {
  country?: string;
  state?: string;
  district?: string;
  city?: string;
  postalCode?: string;
}

interface LocationFieldsProps {
  value: LocationValue;
  /** Called with only the fields that changed */
  onChange: (changes: Partial<LocationValue>) => void;
  errors?: LocationErrors;
  showCountry?: boolean;
  showCity?: boolean;
  showPostalCode?: boolean;
  required?: boolean;
  /** Override the PIN code label / hint, and whether it is required (defaults to `required`) */
  postalCodeLabel?: string;
  postalCodeHelper?: string;
  postalCodeRequired?: boolean;
  idPrefix?: string;
}

/**
 * Country → State / UT → District (with "Other") → City → PIN code.
 * Labels, lists and rules come from the chosen country's settings.
 */
export const LocationFields: React.FC<LocationFieldsProps> = ({
  value,
  onChange,
  errors = {},
  showCountry = true,
  showCity = true,
  showPostalCode = true,
  required = true,
  idPrefix = 'loc',
  postalCodeLabel,
  postalCodeHelper,
  postalCodeRequired,
}) => {
  const countries = getEnabledCountries();
  const country = countryOrDefault(value.country);
  const region = findRegion(country, value.state);

  const districtInList = Boolean(region && region.districts.includes(value.district));
  // "Other" mode when the saved district is not in the list (typed by hand)
  const [otherMode, setOtherMode] = useState<boolean>(Boolean(value.district) && !districtInList);
  const showOtherInput = otherMode || (Boolean(value.district) && Boolean(region) && !districtInList);

  const stateOptions = useMemo(
    () => [
      { value: '', label: `Select ${country.regionLabel.toLowerCase()}`, disabled: true },
      ...country.regions.map((r) => ({ value: r.name, label: r.name })),
    ],
    [country],
  );

  const districtOptions = useMemo(
    () => [
      { value: '', label: region ? `Select ${country.districtLabel.toLowerCase()}` : `Choose a ${country.regionLabel.toLowerCase()} first`, disabled: true },
      ...(region ? region.districts.map((d) => ({ value: d, label: d })) : []),
      ...(region ? [{ value: OTHER_DISTRICT, label: `Other (type ${country.districtLabel.toLowerCase()} name)` }] : []),
    ],
    [region, country],
  );

  const handleCountry = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPreferredCountryCode(e.target.value);
    setOtherMode(false);
    onChange({ country: e.target.value, state: '', district: '', postalCode: '' });
  };

  const handleState = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setOtherMode(false);
    onChange({ state: e.target.value, district: '' });
  };

  const handleDistrict = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === OTHER_DISTRICT) {
      setOtherMode(true);
      onChange({ district: '' });
    } else {
      setOtherMode(false);
      onChange({ district: e.target.value });
    }
  };

  const districtSelectValue = showOtherInput ? OTHER_DISTRICT : value.district || '';

  return (
    <div className="space-y-3">
      {showCountry && (
        <Select
          id={`${idPrefix}-country`}
          label="Country"
          required={required}
          value={country.code}
          onChange={handleCountry}
          options={countries.map((c) => ({ value: c.code, label: c.name }))}
          error={errors.country}
          helperText={countries.length === 1 ? `${country.name} only for now. More countries coming soon.` : undefined}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select
          id={`${idPrefix}-state`}
          label={country.regionLabel}
          required={required}
          value={value.state || ''}
          onChange={handleState}
          options={stateOptions}
          error={errors.state}
        />

        <Select
          id={`${idPrefix}-district`}
          label={country.districtLabel}
          required={required}
          value={districtSelectValue}
          onChange={handleDistrict}
          options={districtOptions}
          disabled={!region}
          error={showOtherInput ? undefined : errors.district}
        />
      </div>

      {showOtherInput && (
        <Input
          id={`${idPrefix}-district-other`}
          label={`${country.districtLabel} name`}
          required={required}
          placeholder={`Type your ${country.districtLabel.toLowerCase()}`}
          value={value.district}
          onChange={(e) => onChange({ district: e.target.value })}
          error={errors.district}
        />
      )}

      {(showCity || showPostalCode) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {showCity && (
            <Input
              id={`${idPrefix}-city`}
              label={country.cityLabel}
              required={required}
              placeholder="e.g. Kukatpally"
              value={value.city || ''}
              onChange={(e) => onChange({ city: e.target.value })}
              error={errors.city}
            />
          )}
          {showPostalCode && (
            <Input
              id={`${idPrefix}-postal`}
              label={postalCodeLabel || country.postalCodeLabel}
              required={postalCodeRequired ?? required}
              helperText={postalCodeHelper}
              inputMode="numeric"
              maxLength={6}
              placeholder={`e.g. ${country.postalCodeExample}`}
              value={value.postalCode || ''}
              onChange={(e) => onChange({ postalCode: e.target.value.replace(/\D/g, '') })}
              error={errors.postalCode}
            />
          )}
        </div>
      )}
    </div>
  );
};

/** Mobile number field with the country's dialling code shown in front */
export const PhoneField = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { countryCode?: string; label?: string; error?: string; helperText?: string }
>(({ countryCode, label = 'Mobile Number', error, helperText, ...props }, ref) => {
  const country = countryOrDefault(countryCode);
  return (
    <Input
      ref={ref}
      label={label}
      type="tel"
      inputMode="tel"
      placeholder={country.phoneExample}
      leftIcon={<span className="text-sm font-semibold text-ink-secondary">{country.dialCode}</span>}
      helperText={helperText || country.phoneHint}
      error={error}
      {...props}
    />
  );
});
PhoneField.displayName = 'PhoneField';
