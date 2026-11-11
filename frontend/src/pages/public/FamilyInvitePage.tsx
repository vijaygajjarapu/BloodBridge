import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { HeartHandshake, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';
import { familyApi } from '../../services/familyApi';
import type { FamilyInvitePublic } from '../../types/family';
import { useAuth } from '../../hooks/useAuth';
import { appConfig } from '../../constants/config';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BloodGroupBadge } from '../../components/ui/Badge';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { errorMessage } from '../../utils/formErrors';
import { FamilyPledgeForm, savePendingFamilyInvite } from '../../components/family/FamilyPledgeForm';

/**
 * Public page for a family invite link. Shows ONLY the inviter's first name and the blood groups needed.
 * Signed-in people choose which of those groups they can donate and pledge (free).
 */
export const FamilyInvitePage: React.FC = () => {
  const { code = '' } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [info, setInfo] = useState<FamilyInvitePublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [done, setDone] = useState<string[] | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (appConfig.isDemo) {
      setLoadError('Family invites work with the live backend, not in demo mode.');
      setLoading(false);
      return;
    }
    familyApi
      .getInvitePublic(code)
      .then((data) => {
        setInfo(data);
      })
      .catch((e) => setLoadError(errorMessage(e, 'This invitation link is not valid.')))
      .finally(() => setLoading(false));
  }, [code, isAuthenticated, authLoading]);

  // Remember the invite: after sign-up (or sign-in) the dashboard asks them to finish the pledge
  const goToAuth = (tab: 'signup' | 'signin') => {
    savePendingFamilyInvite(code);
    navigate(`/auth/login?tab=${tab}`, { state: { from: { pathname: '/app/dashboard' } } });
  };

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <Card className="shadow-lg border-line-border">
        <div className="p-6 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-t-xl">
          <HeartHandshake className="w-8 h-8 mb-2" />
          <h1 className="text-xl font-bold">Help a family stay safe</h1>
          <p className="text-sm text-white/90">Pledge to donate blood if they ever need it. It’s free.</p>
        </div>

        <CardContent className="p-6 space-y-5">
          {(loading || authLoading) && (
            <div className="flex items-center gap-2 text-sm text-ink-secondary">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading invitation…
            </div>
          )}

          {loadError && <ErrorBanner title="Invitation not available" message={loadError} />}

          {info && !done && (
            <>
              <p className="text-sm text-ink-main">
                <strong>{info.inviterFirstName}</strong>’s family may need blood in an emergency. These are the blood groups they
                may need:
              </p>
              <div className="flex flex-wrap gap-2">
                {info.bloodGroups.map((g) => (
                  <BloodGroupBadge key={g} group={g} />
                ))}
              </div>
              <p className="text-xs text-ink-secondary flex items-start gap-1.5">
                <ShieldCheck className="w-4 h-4 text-status-success flex-shrink-0" />
                For their privacy, family members’ names and details are not shown.
              </p>

              {info.isOwnInvite ? (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                  This is your own family’s invite. Share it with friends and relatives.{' '}
                  <Link to="/app/family" className="font-semibold underline">
                    Go to My Family
                  </Link>
                </div>
              ) : !isAuthenticated ? (
                <div className="space-y-3 rounded-xl border border-line-border p-4">
                  <p className="text-sm text-ink-main font-medium">Join Manvi Blood (free) to pledge.</p>
                  <ol className="text-xs text-ink-secondary list-decimal pl-4 space-y-1">
                    <li>Create your account and confirm the 6-digit code we email you.</li>
                    <li>Your dashboard opens with this family’s request: tick the blood groups you can give.</li>
                  </ol>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" id="family-invite-signup" onClick={() => goToAuth('signup')}>
                      Create free account
                    </Button>
                    <Button variant="outline" id="family-invite-signin" onClick={() => goToAuth('signin')}>
                      I already have an account
                    </Button>
                  </div>
                </div>
              ) : (
                <FamilyPledgeForm code={code} info={info} onDone={setDone} />
              )}
            </>
          )}

          {done && info && (
            <div className="text-center space-y-3 py-4">
              <CheckCircle2 className="w-12 h-12 text-status-success mx-auto" />
              <h2 className="text-lg font-bold text-ink-main">Thank you!</h2>
              <p className="text-sm text-ink-secondary">
                You pledged to donate {done.join(', ')} if {info.inviterFirstName}’s family needs blood.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/app/family">
                  <Button variant="primary">Protect my own family too</Button>
                </Link>
                <Link to="/app/dashboard">
                  <Button variant="outline">Go to dashboard</Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
