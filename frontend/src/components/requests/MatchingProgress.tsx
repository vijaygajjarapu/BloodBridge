import React, { useEffect, useState } from 'react';
import { Activity as Radar, Send, Eye, CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { MatchingSummary } from '../../types/request';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { useT, type TFunction } from '../../i18n/I18nProvider';

const timeLeft = (iso: string, t: TFunction) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 60_000) return t('match.inMoment');
  return t('match.inMinutes', { n: Math.ceil(ms / 60_000) });
};

/** Requester: live progress of smart matching (counts only, never who) */
export const MatchingProgress: React.FC<{
  matching: MatchingSummary;
  unitsNeeded: number;
  live: boolean;
  busy: boolean;
  onAlertMore: () => void;
}> = ({ matching: m, unitsNeeded, live, busy, onAlertMore }) => {
  // Re-render every 30 s so "next group in N min" stays current
  const [, tick] = useState(0);
  const t = useT();
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const enough = m.accepted >= unitsNeeded;
  const stats = [
    { icon: <Send className="w-4 h-4" />, label: t('match.contacted'), value: m.contacted },
    { icon: <Eye className="w-4 h-4" />, label: t('match.viewed'), value: m.viewed },
    { icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />, label: t('match.accepted'), value: m.accepted },
    { icon: <XCircle className="w-4 h-4 text-ink-muted" />, label: t('match.declined'), value: m.declined },
  ];

  return (
    <Card id="matching-progress">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Radar className="w-5 h-5 text-brand-500" />
          <h2 className="text-base font-bold text-ink-main">{t('match.title')}</h2>
        </div>
        <p className="text-xs text-ink-secondary">
          {t('match.intro')}
        </p>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-line-border bg-gray-50 p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-ink-secondary text-xs">
                {s.icon}
                {s.label}
              </div>
              <div className="text-xl font-black text-ink-main mt-1">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="text-xs text-ink-secondary flex items-start gap-1.5">
          <Clock className="w-4 h-4 shrink-0" />
          <span>
            {!live
              ? t('match.closed')
              : enough
                ? t('match.enough', { accepted: m.accepted, units: unitsNeeded })
                : m.nextWaveAt
                  ? t('match.next', { wave: m.wave, waiting: m.waiting, when: timeLeft(m.nextWaveAt, t) })
                  : m.contacted > 0
                    ? t('match.allContacted')
                    : t('match.noneYet')}
            {m.fromCommunities ? ` ${t('match.fromCommunities', { n: m.fromCommunities })}` : ''}
          </span>
        </div>

        {live && !enough && m.waiting > 0 && (
          <Button variant="outline" size="sm" isLoading={busy} onClick={onAlertMore} id="alert-more-donors">
            {t('match.alertMore')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
