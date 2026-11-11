import { useEffect, useState } from 'react';
import { subscriptionApi } from '../services/familyApi';
import { appConfig } from '../constants/config';
import { useAuth } from './useAuth';

let cache: { userId: string; promise: Promise<boolean> } | null = null;

/** Clears the cached status, e.g. right after a successful payment */
export function refreshSubscriptionStatus() {
  cache = null;
}

/**
 * Whether the signed-in person has an active Donor Circle subscription.
 * Sharing the savior (referral) link is a subscriber feature. Demo mode and admins are always allowed.
 */
export function useSubscription() {
  const { user, isAdmin } = useAuth();
  const free = appConfig.isDemo || isAdmin;
  const [subscribed, setSubscribed] = useState<boolean>(free);
  const [loading, setLoading] = useState<boolean>(!free);

  useEffect(() => {
    if (free || !user) {
      setSubscribed(free);
      setLoading(false);
      return;
    }
    if (!cache || cache.userId !== user.id) {
      cache = {
        userId: user.id,
        promise: subscriptionApi
          .mine()
          .then((s) => Boolean(s.active))
          .catch(() => false),
      };
    }
    let alive = true;
    setLoading(true);
    cache.promise.then((active) => {
      if (!alive) return;
      setSubscribed(active);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [free, user]);

  return { subscribed, loading };
}
