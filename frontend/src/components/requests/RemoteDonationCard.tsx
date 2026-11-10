import React, { useEffect, useState } from 'react';
import { Building2, MapPin, CheckCircle2, Clock } from 'lucide-react';
import { remoteApi } from '../../services/orgApi';
import type { PartnerBloodBank, RemoteSummary, RemoteCredit } from '../../types/organisation';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useT } from '../../i18n/I18nProvider';
import { errorMessage } from '../../utils/formErrors';

/** Donor far from the hospital: "Donate here, save a life there" */
export const RemoteDonationCard: React.FC<{ requestId: string; initial?: RemoteSummary | null; myState?: string; myDistrict?: string }> = ({ requestId, initial, myState, myDistrict }) => {
  const t = useT();
  const [s, setS] = useState<RemoteSummary | null>(initial || null);
  const [banks, setBanks] = useState<PartnerBloodBank[]>([]);
  const [bankId, setBankId] = useState('');
  const [slip, setSlip] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    remoteApi.banks({ state: myState, district: myDistrict }).then((b) => { setBanks(b); if (b[0]) setBankId(b[0].id); }).catch(() => setBanks([]));
  }, [myState, myDistrict]);

  const run = async (fn: () => Promise<RemoteSummary>) => {
    setBusy(true);
    setError(null);
    try {
      setS(await fn());
    } catch (e) {
      setError(errorMessage(e, t('oncall.error')));
    } finally {
      setBusy(false);
    }
  };
  const mine = s?.mine;

  return (
    <Card id="remote-donation">
      <CardContent className="p-5 space-y-3">
        <h2 className="text-base font-bold text-ink-main flex items-center gap-2"><Building2 className="w-5 h-5 text-brand-600" /> {t('remote.title')}</h2>
        <p className="text-xs text-ink-secondary">{t('remote.hint')}</p>
        {error && <p className="text-xs text-status-error" role="alert">{error}</p>}

        {!mine && (
          <div className="space-y-2">
            <label htmlFor="remote-bank" className="block text-xs font-semibold text-ink-secondary">{t('remote.chooseBank')}</label>
            <select id="remote-bank" value={bankId} onChange={(e) => setBankId(e.target.value)}
              className="w-full border border-line-border rounded-lg px-3 py-2 min-h-[44px] text-sm bg-white">
              {banks.map((b) => (
                <option key={b.id} value={b.id}>{b.name} · {b.city}{b.sameDistrict ? ' ★' : ''}</option>
              ))}
            </select>
            {banks.find((b) => b.id === bankId)?.address && (
              <p className="text-[11px] text-ink-muted flex items-start gap-1"><MapPin className="w-3 h-3 mt-0.5" /> {banks.find((b) => b.id === bankId)?.address} {banks.find((b) => b.id === bankId)?.phone ? `· ${banks.find((b) => b.id === bankId)?.phone}` : ''}</p>
            )}
            <Button variant="primary" isLoading={busy} disabled={!bankId} onClick={() => run(() => remoteApi.pledge(requestId, bankId))}>{t('remote.pledge')}</Button>
          </div>
        )}

        {mine?.status === 'pledged' && (
          <div className="space-y-2">
            <p className="text-sm text-ink-main">{t('remote.pledged', { bank: mine.bloodBank })}</p>
            <div className="flex flex-wrap items-end gap-2">
              <Input id="remote-slip" label={t('remote.slip')} value={slip} maxLength={40} onChange={(e) => setSlip(e.target.value)} />
              <Button variant="primary" isLoading={busy} disabled={slip.trim().length < 3} onClick={() => run(() => remoteApi.donated(requestId, slip))}>{t('remote.markDonated')}</Button>
              <Button variant="ghost" disabled={busy} onClick={() => run(() => remoteApi.cancel(requestId))}>{t('remote.cancel')}</Button>
            </div>
          </div>
        )}
        {mine?.status === 'donated' && <p className="text-sm text-ink-main flex items-center gap-2"><Clock className="w-4 h-4" /> {t('remote.waiting', { bank: mine.bloodBank })}</p>}
        {mine?.status === 'confirmed' && <p className="text-sm font-semibold text-status-success flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {t('remote.confirmed', { bank: mine.bloodBank })}</p>}
      </CardContent>
    </Card>
  );
};

/** Family: replacement donations made for them in other cities */
export const RemoteCreditsCard: React.FC<{ requestId: string; summary: RemoteSummary }> = ({ requestId, summary }) => {
  const t = useT();
  const [credits, setCredits] = useState<RemoteCredit[]>([]);
  useEffect(() => {
    remoteApi.credits(requestId).then(setCredits).catch(() => setCredits([]));
  }, [requestId]);
  if (!summary.pledged && !summary.donated && !summary.confirmed) return null;
  return (
    <Card id="remote-credits">
      <CardContent className="p-5 space-y-2">
        <h2 className="text-base font-bold text-ink-main flex items-center gap-2"><Building2 className="w-5 h-5 text-brand-600" /> {t('remote.familyTitle')}</h2>
        <p className="text-xs text-ink-secondary">{t('remote.counts', { confirmed: summary.confirmed, donated: summary.donated, pledged: summary.pledged })}</p>
        <ul className="space-y-1 text-sm">
          {credits.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              {c.status === 'confirmed' ? <CheckCircle2 className="w-4 h-4 text-status-success" /> : <Clock className="w-4 h-4 text-ink-muted" />}
              {c.bloodBank}{c.donationRef ? ` · ${c.donationRef}` : ''}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-ink-muted">{t('remote.familyHint')}</p>
      </CardContent>
    </Card>
  );
};
