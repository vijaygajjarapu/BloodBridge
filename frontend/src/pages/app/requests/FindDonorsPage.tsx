import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users, HeartPulse, ShieldCheck, Siren } from 'lucide-react';
import { requestApi } from '../../../services/requestApi';
import type { DonorCounts } from '../../../types/request';
import type { BloodGroup } from '../../../types/donor';
import { BLOOD_GROUPS } from '../../../constants/bloodGroups';
import { useAuth } from '../../../hooks/useAuth';
import { getPreferredCountryCode, countryOrDefault } from '../../../constants/countries';
import { Card, CardContent } from '../../../components/ui/Card';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { ErrorBanner } from '../../../components/ui/ErrorBanner';
import { LocationFields, type LocationValue } from '../../../components/forms/LocationFields';
import { errorMessage } from '../../../utils/formErrors';

/**
 * Find Donors shows COUNTS only (no individual donor cards). To reach donors, post a request:
 * the request itself goes to them, and their numbers stay private.
 */
export const FindDonorsPage: React.FC = () => {
  const { user } = useAuth();
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('');
  const [loc, setLoc] = useState<LocationValue>({ country: countryOrDefault(user?.country || getPreferredCountryCode()).code, state: '', district: '' });
  const [errors, setErrors] = useState<{ bloodGroup?: string; state?: string }>({});
  const [result, setResult] = useState<DonorCounts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!bloodGroup) errs.bloodGroup = 'Choose the blood group needed.';
    if (!loc.state) errs.state = 'Choose a state.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await requestApi.donorCounts({ bloodGroup, country: loc.country, state: loc.state, district: loc.district || undefined }));
    } catch (err) {
      setError(errorMessage(err, 'Could not search right now. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const area = result ? (result.area.district ? `${result.area.district}, ${result.area.state}` : result.area.state) : '';

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-main tracking-tight flex items-center gap-2">
          <Search className="w-7 h-7 text-brand-600" /> Find donors
        </h1>
        <p className="text-xs sm:text-sm text-ink-secondary">
          Free for everyone. See how many donors could help in an area. For everyone’s privacy we don’t list donors. Post a request (also free) and it reaches them directly.
        </p>
      </div>

      <Card>
        <CardContent className="p-5">
          <form noValidate onSubmit={search} className="space-y-4">
            <Select
              id="find-blood-group"
              label="Patient’s blood group"
              value={bloodGroup}
              onChange={(e) => { setBloodGroup(e.target.value as BloodGroup); setErrors((x) => ({ ...x, bloodGroup: undefined })); }}
              error={errors.bloodGroup}
              options={[{ value: '', label: 'Select', disabled: true }, ...BLOOD_GROUPS.map((g) => ({ value: g.value, label: g.value }))]}
            />
            <LocationFields
              idPrefix="find"
              value={loc}
              onChange={(c) => { setLoc((l) => ({ ...l, ...c })); setErrors((x) => ({ ...x, state: undefined })); }}
              errors={{ state: errors.state }}
              showCountry={false}
              showCity={false}
              showPostalCode={false}
              required={false}
            />
            <Button type="submit" variant="primary" isLoading={loading} leftIcon={<Search className="w-4 h-4" />}>Search</Button>
          </form>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card id="donor-counts">
          <CardContent className="p-5 space-y-4">
            <p className="text-sm text-ink-secondary">Donors for a <strong className="text-ink-main">{result.bloodGroup}</strong> patient in <strong className="text-ink-main">{area}</strong>:</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-brand-50 p-4 text-center">
                <div className="text-2xl font-extrabold text-brand-700">{result.exactMatch}</div>
                <div className="text-[11px] text-ink-secondary">{result.bloodGroup} donors</div>
              </div>
              <div className="rounded-xl bg-blue-50 p-4 text-center">
                <div className="text-2xl font-extrabold text-blue-700">{result.compatible}</div>
                <div className="text-[11px] text-ink-secondary">Compatible donors</div>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4 text-center">
                <div className="text-2xl font-extrabold text-emerald-700">{result.availableNow}</div>
                <div className="text-[11px] text-ink-secondary">Can donate now</div>
              </div>
            </div>
            <p className="text-xs text-ink-muted flex items-center gap-1.5">
              <HeartPulse className="w-3.5 h-3.5" /> Compatible groups: {result.compatibleGroups.join(', ')}. “Can donate now” = available and no donation in the last 90 days.
            </p>
            <div className="rounded-xl border border-line-border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-ink-secondary flex items-start gap-1.5">
                <ShieldCheck className="w-4 h-4 text-status-success shrink-0" /> Donors’ names and numbers are never listed. Post a request and matching donors are alerted at once.
              </p>
              <Link to="/app/requests/new">
                <Button variant="primary" size="sm" leftIcon={<Siren className="w-4 h-4" />}>Request blood</Button>
              </Link>
            </div>
            {result.compatible === 0 && (
              <p className="text-xs text-ink-secondary flex items-center gap-1.5"><Users className="w-4 h-4" /> No donors registered here yet. Try the whole state (leave the district empty).</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
