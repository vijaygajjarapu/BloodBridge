import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartHandshake, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { familyApi } from '../../services/familyApi';
import type { FamilyInvitePublic } from '../../types/family';
import { appConfig } from '../../constants/config';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { BloodGroupBadge } from '../ui/Badge';
import { FamilyPledgeForm, getPendingFamilyInvite, clearPendingFamilyInvite } from './FamilyPledgeForm';

/**
 * Shown on the dashboard after someone opened a family invite link and then signed up / signed in:
 * they tick the blood groups they can give and agree to share their contact details.
 */
export const PendingFamilyPledgeCard: React.FC = () => {
  const [code] = useState<string | null>(() => getPendingFamilyInvite());
  const [info, setInfo] = useState<FamilyInvitePublic | null>(null);
  const [done, setDone] = useState<string[] | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!code || appConfig.isDemo) return;
    familyApi
      .getInvitePublic(code)
      .then((data) => {
        if (data.isOwnInvite) {
          clearPendingFamilyInvite();
          return;
        }
        setInfo(data);
      })
      .catch(() => clearPendingFamilyInvite()); // link no longer valid
  }, [code]);

  if (!code || !info || hidden) return null;

  const dismiss = () => {
    clearPendingFamilyInvite();
    setHidden(true);
  };

  return (
    <Card className="border-brand-200 shadow-md" id="pending-family-pledge">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink-main">
                {done ? 'Thank you for your pledge!' : `Help ${info.inviterFirstName}’s family stay safe`}
              </h2>
              {!done && (
                <p className="text-xs text-ink-secondary">
                  You opened {info.inviterFirstName}’s family invite. Pick the blood groups you can give if they ever need blood.
                </p>
              )}
            </div>
          </div>
          {!done && (
            <button type="button" onClick={dismiss} aria-label="Not now" className="text-ink-muted hover:text-ink-main p-2 -m-2">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {done ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-ink-secondary flex items-center gap-2 flex-1">
              <CheckCircle2 className="w-5 h-5 text-status-success shrink-0" />
              You pledged {done.join(', ')} for {info.inviterFirstName}’s family. You can withdraw any time from My Family.
            </p>
            <div className="flex gap-2">
              <Link to="/app/family">
                <Button variant="primary" size="sm">Protect my own family too</Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={() => setHidden(true)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-secondary">Blood groups needed:</span>
              {info.bloodGroups.map((g) => (
                <BloodGroupBadge key={g} group={g} />
              ))}
            </div>
            <p className="text-xs text-ink-secondary flex items-start gap-1.5">
              <ShieldCheck className="w-4 h-4 text-status-success flex-shrink-0" />
              For their privacy, family members’ names and details are not shown.
            </p>
            <FamilyPledgeForm code={code} info={info} onDone={setDone} />
          </>
        )}
      </CardContent>
    </Card>
  );
};
