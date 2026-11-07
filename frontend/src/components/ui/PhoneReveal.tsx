import React from 'react';
import { Eye, EyeOff, Phone } from 'lucide-react';
import { usePhoneReveal, maskPhone, telHref } from '../../hooks/usePhoneReveal';

/** "Show full numbers" for the whole page (1 hour), or "Hide numbers" while they are shown */
export const RevealNumbersButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { revealed, reveal, hide, minutesLeft } = usePhoneReveal();
  return revealed ? (
    <button
      type="button"
      onClick={hide}
      id="hide-numbers"
      className={`inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-ink-main min-h-[36px] ${className}`}
      title="Numbers hide again automatically"
    >
      <EyeOff className="w-4 h-4" /> Hide numbers <span className="text-ink-muted font-normal">(auto-hides in {minutesLeft} min)</span>
    </button>
  ) : (
    <button
      type="button"
      onClick={reveal}
      id="show-numbers"
      className={`inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 min-h-[36px] ${className}`}
      title="Shows all numbers on this page for 1 hour"
    >
      <Eye className="w-4 h-4" /> Show full numbers
    </button>
  );
};

/** A phone number shown partly hidden; tapping it still calls the full number */
export const MaskedPhone: React.FC<{ phone: string; asButton?: boolean; className?: string }> = ({ phone, asButton = false, className = '' }) => {
  const { revealed } = usePhoneReveal();
  const shown = revealed ? phone : maskPhone(phone);
  return (
    <a
      href={telHref(phone)}
      data-phone-masked={!revealed}
      className={
        asButton
          ? `inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white font-semibold text-sm px-3 py-2 hover:bg-brand-700 ${className}`
          : `inline-flex items-center gap-1 text-brand-600 font-semibold ${className}`
      }
      aria-label={`Call ${shown}`}
    >
      <Phone className={asButton ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
      <span className="tabular-nums">{shown}</span>
    </a>
  );
};
