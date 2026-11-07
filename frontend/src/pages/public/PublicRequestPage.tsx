import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Hospital, MapPin, Clock, Droplet, ShieldCheck, PauseCircle, HeartHandshake } from 'lucide-react';
import { requestApi } from '../../services/requestApi';
import type { PublicRequest } from '../../types/request';
import { COMPONENT_LABELS } from '../../types/request';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BloodGroupBadge } from '../../components/ui/Badge';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { RequestStatusBadge, UrgencyBadge } from '../../components/requests/RequestBits';
import { NeverPayNotice } from '../../components/requests/SafetyBits';
import { formatDate } from '../../constants/countries';
import { errorMessage } from '../../utils/formErrors';

/**
 * Public, information-only page for a shared request link.
 * No names, no numbers. Responding needs a signed-in donor whose blood group matches.
 */
export const PublicRequestPage: React.FC = () => {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [r, setR] = useState<PublicRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    requestApi.getPublic(code).then(setR).catch((err) => setError(errorMessage(err, 'This request link is not valid.')));
  }, [code, isAuthenticated]);

  const goSignIn = (tab: 'signin' | 'signup') =>
    navigate(`/auth/login?tab=${tab}`, { state: { from: { pathname: `/r/${code}` } } });

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-4">
      <h1 className="text-2xl font-extrabold text-ink-main">Blood needed</h1>
      {error && <ErrorBanner message={error} />}
      {r && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <BloodGroupBadge group={r.bloodGroup} />
                <div>
                  <p className="text-base font-bold text-ink-main">{r.unitsNeeded} unit{r.unitsNeeded > 1 ? 's' : ''} · {COMPONENT_LABELS[r.component]}</p>
                  <p className="text-xs text-ink-secondary">Posted {formatDate(r.createdAt)}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <UrgencyBadge urgency={r.urgency} />
                <RequestStatusBadge status={r.status} />
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <p className="flex items-start gap-2"><Hospital className="w-4 h-4 text-brand-600 mt-0.5" /> {r.hospitalName}{r.hospitalArea ? `, ${r.hospitalArea}` : ''}{r.hospitalPinCode ? ` · PIN ${r.hospitalPinCode}` : ''}</p>
              <p className="flex items-start gap-2"><MapPin className="w-4 h-4 text-brand-600 mt-0.5" /> {r.city}, {r.district}, {r.state}</p>
              {r.neededBy && <p className="flex items-start gap-2"><Clock className="w-4 h-4 text-brand-600 mt-0.5" /> Needed by {formatDate(r.neededBy)}</p>}
              <p className="flex items-start gap-2"><Droplet className="w-4 h-4 text-brand-600 mt-0.5" /> Donors who can help: {r.compatibleDonorGroups.join(', ')}</p>
            </div>
            <NeverPayNotice compact />
            <p className="text-xs text-ink-secondary flex items-start gap-1.5">
              <ShieldCheck className="w-4 h-4 text-status-success shrink-0" /> For privacy, the patient’s and family’s details are shared only with donors who accept.
            </p>

            {r.paused ? (
              <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-3 flex gap-2"><PauseCircle className="w-4 h-4 shrink-0" /> This request is paused while it’s being reviewed.</p>
            ) : !r.isLive ? (
              <p className="text-sm text-ink-secondary bg-gray-50 rounded-lg p-3">This request is no longer active. Thank you for checking.</p>
            ) : !r.viewer.signedIn ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-ink-main">Can you donate? Sign in or join BloodBridge (free) to respond.</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => goSignIn('signup')}>Join to respond</Button>
                  <Button variant="outline" onClick={() => goSignIn('signin')}>I have an account</Button>
                </div>
              </div>
            ) : r.viewer.isRequester ? (
              <Link to={`/app/requests/${r.viewer.requestId}`}><Button variant="primary">Open my request</Button></Link>
            ) : r.viewer.canRespond ? (
              <Link to={`/app/requests/${r.viewer.requestId}`}>
                <Button variant="primary" leftIcon={<HeartHandshake className="w-4 h-4" />}>Respond as a donor</Button>
              </Link>
            ) : (
              <p className="text-sm text-ink-secondary bg-gray-50 rounded-lg p-3">{r.viewer.cannotRespondReason}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
