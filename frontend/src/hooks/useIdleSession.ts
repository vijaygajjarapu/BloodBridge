import { useEffect, useRef } from 'react';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const;
const LAST_ACTIVITY_KEY = 'bloodbridge_last_activity';
/** Refresh the short-lived token at most once a minute while the person is active */
const REFRESH_EVERY_MS = 60_000;
const CHECK_EVERY_MS = 10_000;

export const IDLE_LOGOUT_FLAG = 'bloodbridge_idle_logout';

interface Options {
  enabled: boolean;
  idleMs: number;
  refresh: () => Promise<unknown>;
  onIdle: () => void;
}

/**
 * Signs the person out after `idleMs` with no clicks, taps or typing.
 * Any activity keeps the session going: the token is refreshed (throttled) while they are active.
 * Activity in another tab of the same browser counts too.
 */
export function useIdleSession({ enabled, idleMs, refresh, onIdle }: Options) {
  const refreshRef = useRef(refresh);
  const onIdleRef = useRef(onIdle);
  refreshRef.current = refresh;
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!enabled) return;

    let lastActivity = Date.now();
    let lastRefresh = Date.now();
    let refreshing = false;
    let finished = false;

    const readSharedActivity = () => {
      try {
        const shared = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
        if (shared > lastActivity) lastActivity = shared;
      } catch {
        /* storage unavailable */
      }
    };

    const doRefresh = async () => {
      if (refreshing || finished) return;
      refreshing = true;
      try {
        await refreshRef.current();
        lastRefresh = Date.now();
      } catch {
        /* the token may already have expired: the idle check below will sign out */
      } finally {
        refreshing = false;
      }
    };

    const onActivity = () => {
      lastActivity = Date.now();
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivity));
      } catch {
        /* storage unavailable */
      }
      if (lastActivity - lastRefresh >= REFRESH_EVERY_MS) void doRefresh();
    };

    const check = () => {
      if (finished) return;
      readSharedActivity();
      const now = Date.now();
      if (now - lastActivity >= idleMs) {
        finished = true;
        onIdleRef.current();
        return;
      }
      // Active since the last refresh: keep the token ahead of the idle deadline
      if (lastActivity > lastRefresh && now - lastRefresh >= REFRESH_EVERY_MS) void doRefresh();
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true, capture: true }));
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(check, CHECK_EVERY_MS);

    return () => {
      finished = true;
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity, { capture: true }));
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [enabled, idleMs]);
}
