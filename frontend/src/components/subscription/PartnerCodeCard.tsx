import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Gift, CheckCircle2 } from 'lucide-react';
import { partnerApi, PARTNER_TYPE_LABELS, type PartnerCodeInfo } from '../../services/partnerApi';
import { refreshSubscriptionStatus } from '../../hooks/useSubscription';
import { useT } from '../../i18n/I18nProvider';
import { formatDate } from '../../constants/countries';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { errorMessage } from '../../utils/formErrors';

/**
 * "Have a code from your insurer, bank or college?" Redeem it and Donor Circle switches on at no cost.
 * A link like /app/subscribe?partner=ACMELIFE-7KQ2 fills in the code.
 */
export const PartnerCodeCard: React.FC<{ onRedeemed?: () => void }> = ({ onRedeemed }) => {
  const t = useT();
  const [params] = useSearchParams();
  const [code, setCode] = useState((params.get('partner') || '').toUpperCase());
  const [info, setInfo] = useState<PartnerCodeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ name: string; endsAt: string } | null>(null);

  const check = async (c = code) => {
    if (c.trim().length < 4) {
      setError(t('partner.enterCode'));
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      setInfo(await partnerApi.lookup(c));
    } catch (e) {
      setError(errorMessage(e, t('partner.notFound')));
    } finally {
      setBusy(false);
    }
  };

  // Opened from a partner's link: look the code up straight away
  useEffect(() => {
    if (code.length >= 4) check(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redeem = async () => {
    if (!info) return;
    setBusy(true);
    setError(null);
    try {
      const r = await partnerApi.redeem(info.code);
      refreshSubscriptionStatus();
      setDone({ name: r.sponsoredBy, endsAt: r.endsAt });
      onRedeemed?.();
    } catch (e) {
      setError(errorMessage(e, t('partner.failed')));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900 space-y-1" role="status" id="partner-redeemed">
        <p className="font-bold flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> {t('partner.done', { name: done.name })}
        </p>
        <p className="text-xs">{t('partner.until', { date: formatDate(done.endsAt) })}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line-border p-4 space-y-3" id="partner-code">
      <p className="text-sm font-bold text-ink-main flex items-center gap-2">
        <Gift className="w-4 h-4 text-brand-600" /> {t('partner.title')}
      </p>
      <p className="text-xs text-ink-secondary">{t('partner.hint')}</p>
      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <Input
            id="partner-code-input"
            label={t('partner.codeLabel')}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setInfo(null);
              setError(null);
            }}
            error={error || undefined}
            placeholder="ACMELIFE-7KQ2"
          />
        </div>
        <Button className="mt-6" variant="outline" isLoading={busy && !info} onClick={() => check()}>
          {t('partner.check')}
        </Button>
      </div>
      {info && (
        <div className="rounded-lg bg-gray-50 p-3 space-y-2">
          <p className="text-sm text-ink-main">
            <strong>{info.name}</strong> <span className="text-ink-muted">· {PARTNER_TYPE_LABELS[info.partnerType]}</span>
          </p>
          {info.available ? (
            <>
              <p className="text-xs text-ink-secondary">{t('partner.offer', { months: info.monthsFree })}</p>
              <Button variant="primary" isLoading={busy} onClick={redeem}>
                {t('partner.redeem')}
              </Button>
            </>
          ) : (
            <p className="text-xs text-status-error">{info.reason}</p>
          )}
        </div>
      )}
    </div>
  );
};
