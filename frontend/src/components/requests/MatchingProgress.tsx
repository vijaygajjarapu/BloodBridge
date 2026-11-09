import React, { useEffect, useState } from 'react';
import { Activity as Radar, Send, Eye, CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { MatchingSummary } from '../../types/request';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

const timeLeft = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 60_000) return 'in a moment';
  return `in ${Math.ceil(ms / 60_000)} min`;
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
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const enough = m.accepted >= unitsNeeded;
  const stats = [
    { icon: <Send className="w-4 h-4" />, label: 'Contacted', value: m.contacted },
    { icon: <Eye className="w-4 h-4" />, label: 'Viewed', value: m.viewed },
    { icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />, label: 'Accepted', value: m.accepted },
    { icon: <XCircle className="w-4 h-4 text-ink-muted" />, label: 'Can’t today', value: m.declined },
  ];

  return (
    <Card id="matching-progress">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Radar className="w-5 h-5 text-brand-500" />
          <h2 className="text-base font-bold text-ink-main">Finding donors</h2>
        </div>
        <p className="text-xs text-ink-secondary">
          We contact the donors most likely to help first (closest, available, reliable), then more groups until enough say yes.
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
              ? 'This request is closed, so no more donors are contacted.'
              : enough
                ? `Enough donors have accepted (${m.accepted} of ${unitsNeeded}). We’ve stopped contacting more.`
                : m.nextWaveAt
                  ? `Group ${m.wave} contacted. If not enough donors accept, the next ${m.waiting > 1 ? 'group' : 'donor'} (${m.waiting} waiting) is contacted ${timeLeft(m.nextWaveAt)}.`
                  : m.contacted > 0
                    ? 'Every matching donor has been contacted. We keep checking for donors who become available.'
                    : 'No matching donors found yet. We keep checking for donors who become available.'}
          </span>
        </div>

        {live && !enough && m.waiting > 0 && (
          <Button variant="outline" size="sm" isLoading={busy} onClick={onAlertMore} id="alert-more-donors">
            Alert more donors now
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
