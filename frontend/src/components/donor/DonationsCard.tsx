import React, { useEffect, useState } from 'react';
import { CalendarCheck, PauseCircle, PlayCircle, HeartHandshake } from 'lucide-react';
import { eligibilityApi } from '../../services/eligibilityApi';
import type { Eligibility } from '../../types/eligibility';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useI18n } from '../../i18n/I18nProvider';
import type { TranslationKey } from '../../i18n/locales/en';
import { errorMessage } from '../../utils/formErrors';

const LOCALES: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN', ta: 'ta-IN', ml: 'ml-IN' };
const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Donor profile: confirm donations the family recorded, add donations made elsewhere,
 * see when they can give again, and pause alerts (switches back on by itself).
 */
export const DonationsCard: React.FC = () => {
  const { t, language } = useI18n();
  const [data, setData] = useState<Eligibility | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());
  const [place, setPlace] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    eligibilityApi
      .mine()
      .then((d) => {
        setData(d);
        // Opened from a notification: scroll here
        if (window.location.hash === '#donations') setTimeout(() => document.getElementById('donations')?.scrollIntoView({ behavior: 'smooth' }), 100);
      })
      .catch(() => setData(null));
  }, []);

  if (!data || !data.hasDonorProfile) return null;

  const fmt = (iso: string) => new Date(iso).toLocaleDateString(LOCALES[language] || 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const run = async (key: string, fn: () => Promise<Eligibility>, after?: () => void) => {
    setBusy(key);
    setError(null);
    try {
      setData(await fn());
      after?.();
    } catch (e) {
      setError(errorMessage(e, t('oncall.error')));
    } finally {
      setBusy(null);
    }
  };

  const pending = (data.donations || []).filter((d) => d.status === 'pending_donor');
  const history = (data.donations || []).filter((d) => d.status === 'confirmed');
  const pause = data.pause;
  // Waiting after a donation: show when they can give again
  const recentGap = data.nextEligibleDate && data.details.lastDonationDate ? data.nextEligibleDate : null;

  return (
    <Card id="donations">
      <CardContent className="p-5 space-y-5">
        <h2 className="text-base font-bold text-ink-main flex items-center gap-2">
          <HeartHandshake className="w-5 h-5 text-brand-600" /> {t('don.title')}
        </h2>
        {error && <p className="text-xs text-status-error" role="alert">{error}</p>}

        {pending.map((d) => (
          <div key={d.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
            <p className="text-sm text-ink-main">{t('don.pendingQ', { date: fmt(d.donatedOn), place: d.place || '—' })}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" isLoading={busy === `yes-${d.id}`} disabled={busy !== null}
                onClick={() => run(`yes-${d.id}`, () => eligibilityApi.confirmDonation(d.id, true))}>
                {t('don.yesDonated')}
              </Button>
              <Button size="sm" variant="outline" isLoading={busy === `no-${d.id}`} disabled={busy !== null}
                onClick={() => run(`no-${d.id}`, () => eligibilityApi.confirmDonation(d.id, false))}>
                {t('don.notDonated')}
              </Button>
            </div>
          </div>
        ))}

        {recentGap && (
          <p className="text-sm text-ink-secondary flex items-start gap-2">
            <CalendarCheck className="w-4 h-4 shrink-0 mt-0.5 text-brand-600" /> {t('don.gap', { date: fmt(recentGap) })}
          </p>
        )}

        {/* Pause my alerts */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink-main">{t('pause.title')}</p>
          {pause?.active ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-gray-50 border border-line-border p-3">
              <p className="text-sm text-ink-main flex items-start gap-2" role="status">
                <PauseCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {pause.untilTurnedOn ? t('pause.activeForever') : t('pause.activeUntil', { date: fmt(pause.until!) })}
                  {pause.reason && <span className="block text-[11px] text-ink-muted">{pause.reason}</span>}
                </span>
              </p>
              <Button size="sm" variant="outline" isLoading={busy === 'resume'} leftIcon={<PlayCircle className="w-4 h-4" />}
                onClick={() => run('resume', eligibilityApi.resume)}>
                {t('pause.resume')}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-xs text-ink-secondary">{t('pause.hint')}</p>
              <div className="flex flex-wrap gap-2">
                {(pause?.options || [3, 7, 14, 30]).map((d) => (
                  <Button key={d} size="sm" variant="outline" isLoading={busy === `p${d}`} disabled={busy !== null}
                    onClick={() => run(`p${d}`, () => eligibilityApi.pause(d, note.trim() || undefined), () => setNote(''))}>
                    {t(`pause.d${d}` as TranslationKey)}
                  </Button>
                ))}
                <Button size="sm" variant="outline" isLoading={busy === 'pforever'} disabled={busy !== null}
                  onClick={() => run('pforever', () => eligibilityApi.pause(null, note.trim() || undefined), () => setNote(''))}>
                  {t('pause.forever')}
                </Button>
              </div>
              <Input id="pause-note" label={t('pause.reason')} value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} />
            </>
          )}
        </div>

        {/* I donated somewhere else */}
        <div className="space-y-2 border-t border-line-border pt-4">
          <p className="text-sm font-semibold text-ink-main">{t('don.add')}</p>
          <p className="text-xs text-ink-secondary">{t('don.addHint')}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input id="don-date" type="date" label={t('don.date')} value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
            <Input id="don-place" label={t('don.place')} value={place} maxLength={80} onChange={(e) => setPlace(e.target.value)} />
          </div>
          <Button size="sm" variant="primary" isLoading={busy === 'add'} disabled={busy !== null || !date}
            onClick={() => run('add', () => eligibilityApi.addDonation(date, place.trim() || undefined), () => setPlace(''))}>
            {t('don.save')}
          </Button>
        </div>

        {history.length > 0 && (
          <div className="space-y-1 border-t border-line-border pt-4">
            <p className="text-sm font-semibold text-ink-main">{t('don.history')}</p>
            <ul className="text-xs text-ink-secondary space-y-1">
              {history.map((d) => (
                <li key={d.id}>
                  {fmt(d.donatedOn)}
                  {d.place ? ` · ${d.place}` : ''} · {d.source === 'request' ? t('don.viaRequest') : t('don.self')}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
