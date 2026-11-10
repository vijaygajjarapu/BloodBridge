import React, { useEffect, useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { outreachApi, type ReachPrefs } from '../../services/outreachApi';
import { Card, CardContent } from '../ui/Card';
import { useT } from '../../i18n/I18nProvider';
import { errorMessage } from '../../utils/formErrors';

const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

/** Donor profile: SMS / call alerts and quiet hours */
export const ReachPrefsCard: React.FC = () => {
  const t = useT();
  const [p, setP] = useState<ReachPrefs | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    outreachApi.myPrefs().then(setP).catch(() => setP(null));
  }, []);

  if (!p) return null;

  const save = async (changes: Partial<Omit<ReachPrefs, 'available'>>) => {
    setSaving(true);
    setMsg(null);
    try {
      setP(await outreachApi.savePrefs(changes));
      setMsg({ ok: true, text: t('reach.saved') });
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e, t('oncall.error')) });
    } finally {
      setSaving(false);
    }
  };

  const quietOn = Boolean(p.quietHoursStart && p.quietHoursEnd);
  const selectCls =
    'border border-line-border rounded-lg px-2 py-1.5 min-h-[40px] text-sm text-ink-main bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

  return (
    <Card id="reach-prefs">
      <CardContent className="p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-ink-main flex items-center gap-2">
            <MessageSquareText className="w-5 h-5 text-brand-600" /> {t('reach.title')}
          </h2>
          <p className="text-xs text-ink-secondary mt-1">{t('reach.intro')}</p>
        </div>

        <label className="flex items-start gap-3 min-h-[44px] cursor-pointer">
          <input type="checkbox" className="mt-0.5 w-4 h-4 accent-brand-600" checked={p.alertBySms} disabled={saving}
            onChange={(e) => save({ alertBySms: e.target.checked })} />
          <span className="text-sm text-ink-main">
            {t('reach.sms')} {!p.available.smsAlerts && <span className="text-[11px] text-ink-muted">{t('reach.notOn')}</span>}
          </span>
        </label>
        <label className="flex items-start gap-3 min-h-[44px] cursor-pointer">
          <input type="checkbox" className="mt-0.5 w-4 h-4 accent-brand-600" checked={p.alertByCall} disabled={saving}
            onChange={(e) => save({ alertByCall: e.target.checked })} />
          <span className="text-sm text-ink-main">
            {t('reach.call')} {!p.available.alertCalls && <span className="text-[11px] text-ink-muted">{t('reach.notOn')}</span>}
          </span>
        </label>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink-secondary">{t('reach.quiet')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={t('reach.quiet')}
              className={selectCls}
              disabled={saving}
              value={quietOn ? 'on' : 'off'}
              onChange={(e) =>
                save(e.target.value === 'on' ? { quietHoursStart: '22:00', quietHoursEnd: '07:00' } : { quietHoursStart: null, quietHoursEnd: null })
              }
            >
              <option value="off">{t('reach.none')}</option>
              <option value="on">22:00 – 07:00</option>
            </select>
            {quietOn && (
              <>
                <span className="text-xs text-ink-secondary">{t('reach.from')}</span>
                <select aria-label={t('reach.from')} className={selectCls} disabled={saving} value={p.quietHoursStart || '22:00'}
                  onChange={(e) => save({ quietHoursStart: e.target.value, quietHoursEnd: p.quietHoursEnd })}>
                  {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="text-xs text-ink-secondary">{t('reach.to')}</span>
                <select aria-label={t('reach.to')} className={selectCls} disabled={saving} value={p.quietHoursEnd || '07:00'}
                  onChange={(e) => save({ quietHoursStart: p.quietHoursStart, quietHoursEnd: e.target.value })}>
                  {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </>
            )}
          </div>
          {quietOn && (
            <label className="flex items-start gap-3 min-h-[44px] cursor-pointer">
              <input type="checkbox" className="mt-0.5 w-4 h-4 accent-brand-600" checked={p.quietAllowCritical} disabled={saving}
                onChange={(e) => save({ quietAllowCritical: e.target.checked })} />
              <span className="text-sm text-ink-main">{t('reach.allowCritical')}</span>
            </label>
          )}
        </div>
        {msg && <p className={`text-xs ${msg.ok ? 'text-status-success' : 'text-status-error'}`} role="status">{msg.text}</p>}
      </CardContent>
    </Card>
  );
};
