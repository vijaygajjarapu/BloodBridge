import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Siren, Plus, Inbox, Search } from 'lucide-react';
import { requestApi } from '../../../services/requestApi';
import type { BloodRequest } from '../../../types/request';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { ErrorBanner } from '../../../components/ui/ErrorBanner';
import { RequestSummaryCard } from '../../../components/requests/RequestBits';
import { errorMessage } from '../../../utils/formErrors';

type Tab = 'near' | 'mine';

/** Blood requests: requests near me that I can help with, and requests I posted */
export const RequestsPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'mine' ? 'mine' : 'near';
  const [near, setNear] = useState<{ hasProfile: boolean; myBloodGroup?: string; items: BloodRequest[] } | null>(null);
  const [mine, setMine] = useState<BloodRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    const load = tab === 'near' ? requestApi.forMe().then(setNear) : requestApi.mine().then(setMine);
    load.catch((err) => setError(errorMessage(err, 'Could not load requests. Please try again.')));
  }, [tab]);

  const tabButton = (key: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setParams(key === 'mine' ? { tab: 'mine' } : {})}
      className={`px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px] ${
        tab === key ? 'bg-brand-600 text-white' : 'bg-white text-ink-secondary border border-line-border hover:border-brand-300'
      }`}
    >
      {label}
    </button>
  );

  const empty = (title: string, text: string, action?: React.ReactNode) => (
    <Card>
      <CardContent className="p-8 text-center space-y-2">
        <Inbox className="w-8 h-8 mx-auto text-ink-muted" />
        <p className="text-sm font-bold text-ink-main">{title}</p>
        <p className="text-xs text-ink-secondary max-w-md mx-auto">{text}</p>
        {action && <div className="pt-2">{action}</div>}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-main tracking-tight flex items-center gap-2">
            <Siren className="w-7 h-7 text-brand-600" /> Blood Requests
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">
            Post a request when a patient needs blood. Matching donors nearby are alerted right away.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/app/find-donors">
            <Button variant="outline" leftIcon={<Search className="w-4 h-4" />}>
              Find donors
            </Button>
          </Link>
          <Link to="/app/requests/new">
            <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} id="new-request-button">
              Request blood
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-2">
        {tabButton('near', 'Requests near me')}
        {tabButton('mine', 'My requests')}
      </div>

      {error && <ErrorBanner message={error} />}

      {tab === 'near' && near && (
        <>
          {!near.hasProfile
            ? empty(
                'Add your blood group to see requests you can help with',
                'Requests are matched by blood group and district. Complete your donor profile to start receiving them.',
                <Link to="/app/profile/edit">
                  <Button variant="primary" size="sm">Complete my profile</Button>
                </Link>,
              )
            : near.items.length === 0
              ? empty('No open requests near you right now', `We'll alert you when someone in your district needs blood that a ${near.myBloodGroup} donor can give.`)
              : (
                <div className="grid gap-3 md:grid-cols-2">
                  {near.items.map((r) => (
                    <RequestSummaryCard
                      key={r.id}
                      request={r}
                      to={`/app/requests/${r.id}`}
                      footer={
                        typeof r.myResponse === 'string' ? (
                          <span className="text-xs font-semibold text-emerald-700">
                            {r.myResponse === 'accepted' ? 'You accepted this request' : r.myResponse === 'donated' ? 'You donated, thank you!' : `You ${r.myResponse} this request`}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-brand-600">View and respond →</span>
                        )
                      }
                    />
                  ))}
                </div>
              )}
        </>
      )}

      {tab === 'mine' && mine && (
        mine.length === 0
          ? empty(
              'You have not posted any requests',
              'If a patient needs blood, post a request. Only matching donors are alerted, and your number is shared only with donors who accept.',
              <Link to="/app/requests/new">
                <Button variant="primary" size="sm">Request blood</Button>
              </Link>,
            )
          : (
            <div className="grid gap-3 md:grid-cols-2">
              {mine.map((r) => (
                <RequestSummaryCard
                  key={r.id}
                  request={r}
                  to={`/app/requests/${r.id}`}
                  footer={
                    <span className="text-xs text-ink-secondary">
                      For {r.patientName} · {r.donorsNotified} donor{r.donorsNotified === 1 ? '' : 's'} alerted · {r.acceptedCount || 0} accepted
                    </span>
                  }
                />
              ))}
            </div>
          )
      )}
    </div>
  );
};
