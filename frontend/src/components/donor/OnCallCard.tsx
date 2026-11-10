import React, { useEffect, useState } from 'react';
import { BellRing, ShieldCheck, ShieldAlert } from 'lucide-react';
import { eligibilityApi } from '../../services/eligibilityApi';
import type { Eligibility } from '../../types/eligibility';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { useI18n } from '../../i18n/I18nProvider';
import type { TranslationKey } from '../../i18n/locales/en';
import { errorMessage } from '../../utils/formErrors';

const LOCALES: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN', ta: 'ta-IN', ml: 'ml-IN' };

/**
 * Donor profile: "On call" (contact me first for a while) and the verified blood group badge.
 * Both move a donor up the list when a request near them is posted.
 */
export const OnCallCard: React.FC = () => {
  const { t, language } = useI18n();
  const [data, setData] = useState<Eligibility | null>(null);
  const [busy, setBusy] = useState<number | 'stop' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    eligibilityApi.mine().then(setData).catch(() => setData(null));
  }, []);

  if (!data || !data.hasDonorProfile) return null;

  const run = async (key: number | 'stop', fn: () => Promise<Eligibility>) => {
    setBusy(key);
    setError(null);
    try {
      setData(await fn());
    } catch (e) {
      setError(errorMessage(e, t('oncall.error')));
    } finally {
      setBusy(null);
    }
  };

  const until = data.onCall?.until ? new Date(data.onCall.until) : null;
  const options = data.onCall?.options?.length ? data.onCall.options : [12, 24, 72, 168];
  const when = until
    ? until.toLocaleString(LOCALES[language] || 'en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : '';
  const verified = data.bloodGroupVerified;

  return (
    <Card id="on-call-card">
      <CardContent className="p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-ink-main flex items-center gap-2">
            <BellRing className="w-5 h-5 text-brand-600" /> {t('oncall.title')}
          </h2>
          <p className="text-xs text-ink-secondary mt-1">{t('oncall.intro')}</p>
        </div>

        {data.pause?.active ? (
          <p className="text-xs text-ink-muted">{t('pause.blocksOnCall')}</p>
        ) : until ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3">
            <p className="text-sm font-semibold text-emerald-800" role="status">{t('oncall.activeUntil', { time: when })}</p>
            <Button size="sm" variant="outline" isLoading={busy === 'stop'} onClick={() => run('stop', eligibilityApi.stopOnCall)}>
              {t('oncall.stop')}
            </Button>
          </div>
        ) : data.eligible ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-ink-secondary">{t('oncall.for')}</p>
            <div className="flex flex-wrap gap-2">
              {options.map((h) => (
                <Button key={h} size="sm" variant="outline" isLoading={busy === h} disabled={busy !== null} onClick={() => run(h, () => eligibilityApi.goOnCall(h))}>
                  {t(`oncall.h${h}` as TranslationKey)}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-ink-muted">{t('oncall.notEligible')}</p>
        )}
        {error && <p className="text-xs text-status-error" role="alert">{error}</p>}

        <div className="pt-3 border-t border-line-border text-xs flex items-start gap-2">
          {verified ? (
            <>
              <ShieldCheck className="w-4 h-4 text-status-success shrink-0" />
              <span>
                <strong className="text-emerald-700">{t('verify.badge')}.</strong>{' '}
                <span className="text-ink-secondary">{t('verify.yes', { source: verified.source || '' })}</span>
              </span>
            </>
          ) : (
            <>
              <ShieldAlert className="w-4 h-4 text-ink-muted shrink-0" />
              <span className="text-ink-secondary">{t('verify.no')}</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
