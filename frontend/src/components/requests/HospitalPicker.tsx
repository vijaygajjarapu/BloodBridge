import React, { useEffect, useRef, useState } from 'react';
import { Hospital, MapPin } from 'lucide-react';
import { requestApi } from '../../services/requestApi';
import type { HospitalSuggestion } from '../../types/request';
import { Input } from '../ui/Input';

interface Props {
  country: string;
  state: string;
  district: string;
  pinCode: string;
  name: string;
  area: string;
  onChange: (changes: { name?: string; area?: string; pinCode?: string; city?: string }) => void;
  errors?: { name?: string; area?: string };
}

/**
 * Hospital name with suggestions from the chosen state / district (hospitals in the typed PIN code first).
 * Picking one fills in the area (and PIN code / city when they are empty); everything stays editable.
 */
export const HospitalPicker: React.FC<Props> = ({ country, state, district, pinCode, name, area, onChange, errors = {} }) => {
  const [items, setItems] = useState<HospitalSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const ready = Boolean(state);

  useEffect(() => {
    if (!ready) {
      setItems([]);
      return;
    }
    const t = setTimeout(() => {
      requestApi
        .hospitals({ country, state, district: district || undefined, pinCode: /^\d{6}$/.test(pinCode) ? pinCode : undefined, search: name.trim() || undefined })
        .then(setItems)
        .catch(() => setItems([]));
    }, 250);
    return () => clearTimeout(t);
  }, [ready, country, state, district, pinCode, name]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = (h: HospitalSuggestion) => {
    onChange({
      name: h.name,
      area: h.area || area,
      ...(h.pinCode && !pinCode ? { pinCode: h.pinCode } : {}),
      ...(h.city ? { city: h.city } : {}),
    });
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && ready && items.length > 0;

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="relative" ref={boxRef}>
        <Input
          id="req-hospital"
          label="Hospital name"
          required
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls="hospital-suggestions"
          aria-autocomplete="list"
          placeholder={ready ? 'Start typing or pick from the list' : 'Choose the state and district first'}
          value={name}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange({ name: e.target.value });
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          error={errors.name}
          helperText={ready && !items.length && !name ? 'No saved hospitals here yet. Type the name; it will be suggested next time.' : undefined}
        />
        {showList && (
          <ul
            id="hospital-suggestions"
            role="listbox"
            className="absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded-xl border border-line-border bg-white shadow-lg"
          >
            {items.map((h, i) => (
              <li
                key={h.id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(h);
                }}
                className={`px-3 py-2 cursor-pointer text-sm ${i === active ? 'bg-brand-50' : 'hover:bg-gray-50'}`}
              >
                <span className="flex items-center gap-2 font-semibold text-ink-main">
                  <Hospital className="w-4 h-4 text-brand-600 shrink-0" /> {h.name}
                </span>
                <span className="flex items-center gap-1 text-xs text-ink-secondary pl-6">
                  <MapPin className="w-3 h-3" />
                  {[h.area, h.city || h.district].filter(Boolean).join(', ')}
                  {h.pinCode ? ` · PIN ${h.pinCode}` : ''}
                  {h.samePin && <span className="ml-1 text-emerald-700 font-semibold">· in this PIN code</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Input
        id="req-hospital-area"
        label="Hospital area / locality"
        placeholder="e.g. Jubilee Hills, Ward 5"
        value={area}
        onChange={(e) => onChange({ area: e.target.value })}
        error={errors.area}
        helperText="Filled in when you pick a hospital; you can edit it."
      />
    </div>
  );
};
