import { useCallback, useEffect, useState } from 'react';

const KEY = 'bloodbridge_numbers_revealed_until';
const EVENT = 'bloodbridge:numbers-reveal';
export const REVEAL_DURATION_MS = 60 * 60 * 1000; // 1 hour

function readUntil(): number {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}

/**
 * Phone numbers are shown partly hidden. "Show full numbers" reveals every number on the page
 * for 1 hour (remembered across pages and reloads in this browser), then they hide again.
 */
export function usePhoneReveal() {
  const [until, setUntil] = useState<number>(() => readUntil());
  const [now, setNow] = useState(() => Date.now());
  const revealed = until > now;

  // Stay in sync with other components / tabs
  useEffect(() => {
    const sync = () => setUntil(readUntil());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Tick every 30 s while revealed so numbers hide again on time
  useEffect(() => {
    if (!revealed) return;
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    const end = window.setTimeout(() => setNow(Date.now()), Math.max(0, until - Date.now()) + 50);
    return () => {
      window.clearInterval(t);
      window.clearTimeout(end);
    };
  }, [revealed, until]);

  const write = (value: number) => {
    try {
      if (value) localStorage.setItem(KEY, String(value));
      else localStorage.removeItem(KEY);
    } catch {
      /* storage unavailable */
    }
    setUntil(value);
    setNow(Date.now());
    window.dispatchEvent(new Event(EVENT));
  };

  const reveal = useCallback(() => write(Date.now() + REVEAL_DURATION_MS), []);
  const hide = useCallback(() => write(0), []);
  const minutesLeft = revealed ? Math.max(1, Math.ceil((until - now) / 60_000)) : 0;

  return { revealed, reveal, hide, minutesLeft };
}

/** "+91 98765 00022" -> "+91 98••• ••022" (country code, first 2 and last 3 digits stay visible) */
export function maskPhone(phone: string): string {
  const m = phone.match(/^(\+\d{1,3})\s?(.*)$/);
  const code = m ? m[1] : '';
  const rest = (m ? m[2] : phone).replace(/\D/g, '');
  if (rest.length < 6) return phone;
  const hidden = rest.slice(0, 2) + '•'.repeat(rest.length - 5) + rest.slice(-3);
  const grouped = hidden.length === 10 ? `${hidden.slice(0, 5)} ${hidden.slice(5)}` : hidden;
  return `${code ? code + ' ' : ''}${grouped}`;
}

/** For tel: links: always the full number, so calling works even while it is hidden on screen */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}
