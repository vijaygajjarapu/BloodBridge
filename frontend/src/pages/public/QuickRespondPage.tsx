import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Droplet, MapPin, Phone, CheckCircle2, Info, PhoneCall } from 'lucide-react';
import { outreachApi, type QuickView } from '../../services/outreachApi';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { useT } from '../../i18n/I18nProvider';
import type { TranslationKey } from '../../i18n/locales/en';
import { errorMessage } from '../../utils/formErrors';

/**
 * One-tap answer from an SMS / call alert: /q/<token>. Works without signing in.
 * The link belongs to one donor and one request.
 */
export const QuickRespondPage: React.FC = () => {
  const { token = '' } = useParams();
  const t = useT();
  const [q, setQ] = useState<QuickView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'accept' | 'decline' | 'call' | null>(null);
  const [callMsg, setCallMsg] = useState<string | null>(null);

  useEffect(() => {
    outreachApi.quickView(token).then(setQ).catch(() => setError(t('quick.invalid')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const answer = async (action: 'accept' | 'decline') => {
    setBusy(action);
    setError(null);
    try {
      setQ(await outreachApi.quickRespond(token, action));
    } catch (e) {
      setError(errorMessage(e, t('call.error')));
    } finally {
      setBusy(null);
    }
  };

  const maskedCall = async () => {
    if (!q) return;
    setBusy('call');
    setError(null);
    try {
      // A masked call needs the donor to be signed in; send them to sign in if not
      const res = await outreachApi.callFamily(q.requestId);
      setCallMsg(res.message);
    } catch (e) {
      setError(errorMessage(e, t('call.error')));
    } finally {
      setBusy(null);
    }
  };

  if (error && !q) {
    return (
      <div className="max-w-md mx-auto px-4 py-10">
        <ErrorBanner message={error} />
      </div>
    );
  }
  if (!q) return <div className="max-w-md mx-auto px-4 py-10 text-sm text-ink-muted">…</div>;

  const accepted = q.myResponse === 'accepted' || q.myResponse === 'donated';
  const place = [q.hospitalName, q.hospitalArea, q.city].filter(Boolean).join(', ');

  return (
    <div className="max-w-md mx-auto px-4 py-8 space-y-4">
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <Droplet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-ink-main">{t('quick.title', { group: q.bloodGroup })}</h1>
              <p className="text-xs font-semibold text-brand-600">{t(`urgency.${q.urgency}` as TranslationKey)}</p>
            </div>
          </div>
          <p className="text-sm text-ink-main">{t('quick.hello', { name: q.donorFirstName })}</p>
          <div className="text-sm text-ink-secondary space-y-1">
            <p>{t('quick.units', { units: q.unitsNeeded, component: t(`component.${q.component}` as TranslationKey) })}</p>
            <p className="flex items-start gap-1.5">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5" /> {place}
            </p>
          </div>

          {error && <ErrorBanner message={error} />}

          {!q.live && !accepted ? (
            <p className="text-sm text-ink-secondary flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" /> {t('quick.closed')}
            </p>
          ) : accepted ? (
            <div className="space-y-3">
              <p className="text-base font-bold text-status-success flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> {t('quick.thanks')}
              </p>
              {q.requesterPhone && (
                <a href={`tel:${q.requesterPhone.replace(/\s/g, '')}`} className="block">
                  <Button variant="primary" size="lg" className="w-full justify-center" leftIcon={<Phone className="w-5 h-5" />}>
                    {t('donor.call', { name: q.requesterFirstName, phone: q.requesterPhone })}
                  </Button>
                </a>
              )}
              {q.maskedCallAvailable && (
                <div>
                  <Button variant="outline" className="w-full justify-center" isLoading={busy === 'call'} onClick={maskedCall} leftIcon={<PhoneCall className="w-4 h-4" />}>
                    {t('call.viaApp')}
                  </Button>
                  <p className="mt-1 text-[11px] text-ink-muted">{callMsg || t('call.viaAppHint')}</p>
                </div>
              )}
              <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => answer('decline')}>
                {t('donor.cantCome')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {q.requesterPhone && (
                <p className="text-xs text-ink-secondary">{t('quick.familyNumber', { phone: q.requesterPhone })}</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="primary" size="lg" className="justify-center" isLoading={busy === 'accept'} disabled={busy !== null} onClick={() => answer('accept')}>
                  {t('donor.yes')}
                </Button>
                <Button variant="outline" size="lg" className="justify-center" isLoading={busy === 'decline'} disabled={busy !== null} onClick={() => answer('decline')}>
                  {t('donor.no')}
                </Button>
              </div>
              {q.myResponse === 'declined' && <p className="text-xs text-ink-muted">{t('quick.declined')}</p>}
            </div>
          )}

          <p className="text-[11px] text-ink-muted border-t border-line-border pt-3">{t('quick.neverPay')}</p>
          <Link to={`/app/requests/${q.requestId}`} className="text-xs font-semibold text-brand-600 underline">
            {t('quick.openApp')}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};
