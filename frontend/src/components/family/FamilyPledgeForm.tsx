import React, { useState } from 'react';
import { familyApi } from '../../services/familyApi';
import type { FamilyInvitePublic } from '../../types/family';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { ErrorBanner } from '../ui/ErrorBanner';
import { errorMessage, errorTitle, getFieldErrors } from '../../utils/formErrors';

/** Remembers a family invite opened before signing up, so the pledge can be finished on the dashboard */
export const PENDING_FAMILY_INVITE_KEY = 'bloodbridge_pending_family_invite';

export function savePendingFamilyInvite(code: string) {
  try {
    localStorage.setItem(PENDING_FAMILY_INVITE_KEY, code);
  } catch {
    /* storage unavailable */
  }
}

export function getPendingFamilyInvite(): string | null {
  try {
    return localStorage.getItem(PENDING_FAMILY_INVITE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingFamilyInvite() {
  try {
    localStorage.removeItem(PENDING_FAMILY_INVITE_KEY);
  } catch {
    /* storage unavailable */
  }
}

interface Props {
  code: string;
  info: FamilyInvitePublic;
  onDone: (pledgedGroups: string[]) => void;
}

/** Choose the blood groups you can give + agree to share contact details. Used on the invite page and the dashboard. */
export const FamilyPledgeForm: React.FC<Props> = ({ code, info, onDone }) => {
  const [selected, setSelected] = useState<string[]>(() =>
    info.myPledgedGroups.length
      ? info.myPledgedGroups
      : info.myBloodGroup && info.bloodGroups.includes(info.myBloodGroup)
        ? [info.myBloodGroup]
        : [],
  );
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<{ title?: string; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const toggle = (g: string) => {
    setSelected((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
    setErrors((e) => ({ ...e, bloodGroups: '' }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!selected.length) errs.bloodGroups = 'Choose at least one blood group you can donate.';
    if (!consent) errs.shareContact = 'Please agree so the family can reach you in an emergency.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await familyApi.pledge(code, selected, consent);
      clearPendingFamilyInvite();
      onDone(res.pledgedGroups);
    } catch (err) {
      setErrors(getFieldErrors(err));
      setSubmitError({ title: errorTitle(err), message: errorMessage(err, 'Could not save your pledge. Please try again.') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <fieldset>
        <legend className="text-sm font-semibold text-ink-main mb-2">Which blood group can you donate?</legend>
        {info.myBloodGroup && (
          <p className="text-xs text-ink-secondary mb-2">Your profile says your blood group is {info.myBloodGroup}.</p>
        )}
        <div className="grid grid-cols-4 gap-2">
          {info.bloodGroups.map((g) => {
            const on = selected.includes(g);
            return (
              <button
                key={g}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(g)}
                className={`py-2 rounded-lg border text-sm font-bold min-h-[44px] ${
                  on ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-ink-main border-line-border hover:border-brand-300'
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>
        {errors.bloodGroups && (
          <p className="mt-1.5 text-xs text-status-error font-medium" role="alert">
            {errors.bloodGroups}
          </p>
        )}
      </fieldset>

      <Checkbox
        label={`I agree to share my name and mobile number with ${info.inviterFirstName}’s family so they can contact me in an emergency.`}
        description="You can withdraw at any time from My Family."
        checked={consent}
        onChange={(e) => {
          setConsent(e.target.checked);
          setErrors((er) => ({ ...er, shareContact: '' }));
        }}
        error={errors.shareContact}
      />

      {submitError && <ErrorBanner title={submitError.title} message={submitError.message} />}

      <Button type="submit" variant="primary" size="lg" isLoading={submitting} className="w-full justify-center">
        {info.myPledgedGroups.length ? 'Update my pledge' : 'Pledge to donate'}
      </Button>
    </form>
  );
};
