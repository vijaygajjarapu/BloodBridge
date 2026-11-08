import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, HeartPulse, Info, Loader2, XCircle } from 'lucide-react';
import { eligibilityApi } from '../../services/eligibilityApi';
import type { Eligibility, Sex } from '../../types/eligibility';
import { appConfig } from '../../constants/config';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { errorMessage } from '../../utils/formErrors';

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const today = () => new Date().toISOString().slice(0, 10);
const field = 'w-full rounded-lg border border-line-border bg-white px-3 py-2 text-sm text-ink-main focus:outline-none focus:ring-2 focus:ring-brand-200';

/** "Can I donate now?" self-check, based on India's NBTC donor selection guidelines */
export const EligibilityCard: React.FC = () => {
  const [data, setData] = useState<Eligibility | null>(null);
  const [loading, setLoading] = useState(!appConfig.isDemo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sex, setSex] = useState<Sex | ''>('');
  const [weight, setWeight] = useState('');
  const [reason, setReason] = useState('');
  const [reasonDate, setReasonDate] = useState(today());

  const apply = (e: Eligibility) => {
    setData(e);
    setSex(e.details.sex || '');
    setWeight(e.details.weightKg != null ? String(e.details.weightKg) : '');
  };

  useEffect(() => {
    if (appConfig.isDemo) return;
    eligibilityApi
      .mine()
      .then(apply)
      .catch((e) => setError(errorMessage(e, 'Could not load your eligibility.')))
      .finally(() => setLoading(false));
  }, []);

  const run = async (fn: () => Promise<Eligibility>) => {
    setSaving(true);
    setError(null);
    try {
      apply(await fn());
    } catch (e) {
      setError(errorMessage(e, 'Could not save. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  if (appConfig.isDemo) return null;

  return (
    <Card className="shadow-sm border-line-border" id="eligibility-card">
      <CardContent className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-5 h-5 text-brand-500" />
          <h2 className="font-bold text-base text-ink-main">Can I donate now?</h2>
        </div>

        {loading && (
          <p className="text-sm text-ink-secondary flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Checking…
          </p>
        )}
        {error && <p className="text-sm text-status-error" role="alert">{error}</p>}

        {data && !data.hasDonorProfile && (
          <p className="text-sm text-ink-secondary">Add your blood group to your profile to use the donor self-check.</p>
        )}

        {data && data.hasDonorProfile && (
          <>
            {data.eligible ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex gap-3 text-sm text-emerald-900" id="eligibility-status">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-bold">Yes, you can donate.</p>
                  <p className="text-xs mt-0.5">Matching blood requests near you will be sent to you.</p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex gap-3 text-sm text-amber-900" id="eligibility-status">
                {data.nextEligibleDate ? <Clock className="w-5 h-5 shrink-0 text-amber-600" /> : <XCircle className="w-5 h-5 shrink-0 text-amber-600" />}
                <div className="space-y-1">
                  <p className="font-bold">
                    {data.nextEligibleDate ? `Not yet. You can donate again from ${fmt(data.nextEligibleDate)}.` : 'Not right now.'}
                  </p>
                  <ul className="list-disc pl-4 text-xs space-y-0.5">
                    {data.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <p className="text-xs">You won’t get blood request alerts until then.</p>
                </div>
              </div>
            )}

            {data.missing.length > 0 && (
              <p className="text-xs text-ink-secondary flex gap-1.5">
                <Info className="w-4 h-4 shrink-0" />
                Add {data.missing.map((m) => (m === 'dateOfBirth' ? 'your date of birth (Edit Profile)' : m === 'sex' ? 'your sex' : 'your weight')).join(', ')} for a more accurate check.
              </p>
            )}

            <div className="grid sm:grid-cols-3 gap-3 items-end">
              <label className="text-xs font-semibold text-ink-secondary space-y-1">
                <span>Sex</span>
                <select className={field} value={sex} onChange={(e) => setSex(e.target.value as Sex | '')} id="eligibility-sex">
                  <option value="">Choose…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other / prefer not to say</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-ink-secondary space-y-1">
                <span>Weight (kg)</span>
                <input
                  className={field}
                  type="number"
                  inputMode="numeric"
                  min={20}
                  max={250}
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  id="eligibility-weight"
                />
              </label>
              <Button
                variant="outline"
                isLoading={saving}
                onClick={() =>
                  run(() => eligibilityApi.saveDetails({ sex: sex || null, weightKg: weight ? Math.round(Number(weight)) : null }))
                }
              >
                Save
              </Button>
            </div>
            <p className="text-[11px] text-ink-muted">
              Men can donate every {data.rules.gapDaysMale} days, women every {data.rules.gapDaysFemale} days. Donors must be{' '}
              {data.rules.minAge}–{data.rules.maxAge} years old (first-time donors up to {data.rules.maxAgeFirstTime}) and weigh at least{' '}
              {data.rules.minWeightKg} kg.
            </p>

            <div className="border-t border-line-border pt-4 space-y-3">
              <p className="text-sm font-semibold text-ink-main">Something that means I should wait</p>
              {data.details.deferralReason && data.details.deferredUntil ? (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-secondary">
                  <span>
                    Added: <strong className="text-ink-main">{data.deferralOptions.find((o) => o.key === data.details.deferralReason)?.label}</strong>
                    {new Date(data.details.deferredUntil).getFullYear() < 9999 && <> (until {fmt(data.details.deferredUntil)})</>}
                  </span>
                  <Button size="sm" variant="ghost" isLoading={saving} onClick={() => run(() => eligibilityApi.clearDeferral())}>
                    Remove
                  </Button>
                </div>
              ) : null}
              <div className="grid sm:grid-cols-3 gap-3 items-end">
                <label className="text-xs font-semibold text-ink-secondary space-y-1 sm:col-span-1">
                  <span>Reason</span>
                  <select className={field} value={reason} onChange={(e) => setReason(e.target.value)} id="eligibility-reason">
                    <option value="">Choose…</option>
                    {data.deferralOptions.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-ink-secondary space-y-1">
                  <span>When</span>
                  <input className={field} type="date" max={today()} value={reasonDate} onChange={(e) => setReasonDate(e.target.value)} />
                </label>
                <Button
                  variant="outline"
                  disabled={!reason}
                  isLoading={saving}
                  onClick={() =>
                    run(async () => {
                      const r = await eligibilityApi.addDeferral(reason, reasonDate || undefined);
                      setReason('');
                      return r;
                    })
                  }
                >
                  Add
                </Button>
              </div>
            </div>

            <p className="text-[11px] text-ink-muted">{data.note} Rules follow India’s NBTC donor selection guidelines.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
};
