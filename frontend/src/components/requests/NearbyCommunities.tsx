import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ShieldCheck } from 'lucide-react';
import { communityApi } from '../../services/communityApi';
import type { NearbyCommunity } from '../../types/community';
import { useT } from '../../i18n/I18nProvider';
import type { TranslationKey } from '../../i18n/locales/en';

interface Props {
  country?: string;
  state: string;
  district: string;
  pinCode?: string;
  bloodGroup?: string;
  /** With `selected` + `onChange` the panel lets the requester tick communities to alert */
  selected?: string[];
  onChange?: (ids: string[]) => void;
  /** Tick every community once they load (used for critical requests) */
  selectAllByDefault?: boolean;
}

/**
 * "Communities near this hospital": works even if the requester is not in any community.
 * Shows only counts; any count below 3 is shown as "fewer than 3".
 */
export const NearbyCommunities: React.FC<Props> = ({ country, state, district, pinCode, bloodGroup, selected, onChange, selectAllByDefault }) => {
  const [items, setItems] = useState<NearbyCommunity[] | null>(null);
  const [failed, setFailed] = useState(false);
  const selectable = Boolean(selected && onChange);
  const t = useT();

  useEffect(() => {
    if (!state || !district) {
      setItems(null);
      return;
    }
    let cancelled = false;
    setFailed(false);
    const t = setTimeout(() => {
      communityApi
        .near({ country, state, district, pinCode: pinCode && /^\d{6}$/.test(pinCode) ? pinCode : undefined, bloodGroup })
        .then((rows) => {
          if (cancelled) return;
          setItems(rows);
          if (selectable && selectAllByDefault) onChange!(rows.map((r) => r.id));
          else if (selectable) onChange!((selected || []).filter((id) => rows.some((r) => r.id === id)));
        })
        .catch(() => !cancelled && setFailed(true));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, state, district, pinCode, bloodGroup, selectAllByDefault]);

  if (!state || !district || failed || !items || items.length === 0) return null;

  const toggle = (id: string) => {
    if (!selectable) return;
    const cur = new Set(selected);
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    onChange!([...cur]);
  };

  return (
    <div className="rounded-xl border border-line-border p-4 space-y-3" id="nearby-communities">
      <div>
        <p className="text-sm font-bold text-ink-main flex items-center gap-2">
          <Building2 className="w-4 h-4 text-brand-600" /> {selectable ? t('comm.nearHospital') : t('comm.nearArea')}
        </p>
        <p className="text-xs text-ink-secondary mt-0.5">
          {selectable ? t('comm.selectHint') : t('comm.viewHint')}
        </p>
      </div>
      <ul className="space-y-2">
        {items.map((c) => {
          const checked = Boolean(selected?.includes(c.id));
          const body = (
            <>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink-main truncate">{c.name}</span>
                <span className="block text-[11px] text-ink-muted">
                  {t(`comm.type.${c.type}` as TranslationKey)} · {c.locality ? `${c.locality}, ` : ''}{c.city}
                  {c.samePin ? ` · ${t('comm.samePin')}` : ''}
                </span>
              </span>
              <span className="text-xs font-bold text-emerald-700 whitespace-nowrap">
                {t('comm.canDonate', { count: c.ready.count ?? t('comm.fewerThan3') })}
              </span>
            </>
          );
          return (
            <li key={c.id}>
              {selectable ? (
                <label className="flex items-center gap-3 rounded-lg border border-line-border p-2.5 cursor-pointer hover:bg-gray-50 min-h-[44px]">
                  <input type="checkbox" className="w-4 h-4 accent-brand-600" checked={checked} onChange={() => toggle(c.id)} />
                  <span className="flex-1 flex items-center justify-between gap-2 min-w-0">{body}</span>
                </label>
              ) : (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-line-border p-2.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-ink-muted flex items-start gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-status-success shrink-0" />
        {t('comm.privacy')} {t('comm.liveInOne')}{' '}
        <Link to="/app/communities" className="underline font-semibold">{t('comm.addYours')}</Link>
      </p>
    </div>
  );
};
