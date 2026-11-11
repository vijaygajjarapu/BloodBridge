import React, { useEffect, useState } from 'react';
import { refreshSubscriptionStatus } from '../../hooks/useSubscription';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, Users, Phone, Bell, Globe, Loader2, FlaskConical } from 'lucide-react';
import { subscriptionApi } from '../../services/familyApi';
import type { MySubscription, SubscriptionPlan } from '../../types/family';
import { useAuth } from '../../hooks/useAuth';
import { appConfig } from '../../constants/config';
import { formatDate } from '../../constants/countries';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { errorMessage, errorTitle } from '../../utils/formErrors';
import { PartnerCodeCard } from '../../components/subscription/PartnerCodeCard';
import { partnerApi } from '../../services/partnerApi';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, cb: (r: any) => void) => void };
    /** Set by a future native app wrapper (Capacitor) */
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

/**
 * Web-first purchasing: payment happens only on the website. Inside a mobile app we never show a
 * checkout (no in-app purchase); we point people to the website instead.
 */
function isInsideMobileApp(): boolean {
  return Boolean(window.Capacitor?.isNativePlatform?.()) || /Manvi BloodApp|ManviBloodApp/i.test(navigator.userAgent);
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the payment window. Please check your internet connection.'));
    document.body.appendChild(script);
  });
}

export const SubscribePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [mine, setMine] = useState<MySubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<{ title?: string; message: string } | null>(null);
  const [success, setSuccess] = useState(false);
  const [sponsor, setSponsor] = useState<{ name: string; endsAt: string } | null>(null);

  useEffect(() => {
    if (!appConfig.isDemo) partnerApi.mine().then(setSponsor).catch(() => undefined);
  }, [mine?.active]);

  useEffect(() => {
    if (appConfig.isDemo) {
      setLoading(false);
      return;
    }
    Promise.all([subscriptionApi.plan(), subscriptionApi.mine()])
      .then(([p, m]) => {
        setPlan(p);
        setMine(m);
      })
      .catch((e) => setError({ title: errorTitle(e), message: errorMessage(e) }))
      .finally(() => setLoading(false));
  }, []);

  const finish = (m: MySubscription) => {
    refreshSubscriptionStatus();
    setMine(m);
    setSuccess(true);
    setPaying(false);
  };

  const pay = async () => {
    setError(null);
    setPaying(true);
    try {
      await loadRazorpay();
      const order = await subscriptionApi.createOrder();
      const checkout = new window.Razorpay!({
        key: order.keyId,
        // Razorpay Subscriptions (renews automatically every year) or a one-time order
        ...(order.mode === 'subscription' ? { subscription_id: order.subscriptionId } : { order_id: order.orderId, amount: order.amountPaise, currency: order.currency }),
        name: appConfig.name,
        description: order.mode === 'subscription' ? 'Donor Circle – renews every year' : 'Donor Circle – 1 year',
        prefill: { name: order.name, email: order.email, contact: order.phone },
        theme: { color: '#B91C2C' },
        handler: async (resp: { razorpay_order_id?: string; razorpay_subscription_id?: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            finish(
              resp.razorpay_subscription_id
                ? await subscriptionApi.verifySubscription(resp.razorpay_subscription_id, resp.razorpay_payment_id, resp.razorpay_signature)
                : await subscriptionApi.verify(resp.razorpay_order_id || '', resp.razorpay_payment_id, resp.razorpay_signature),
            );
          } catch (e) {
            setError({ title: 'Payment not confirmed', message: errorMessage(e) });
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      checkout.on('payment.failed', (r: { error?: { description?: string } }) => {
        setError({ title: 'Payment failed', message: r?.error?.description || 'The payment did not go through. You were not charged.' });
        setPaying(false);
      });
      checkout.open();
    } catch (e) {
      setError({ title: errorTitle(e), message: errorMessage(e, 'Could not start the payment.') });
      setPaying(false);
    }
  };

  const simulate = async () => {
    setError(null);
    setPaying(true);
    try {
      finish(await subscriptionApi.devSimulate());
    } catch (e) {
      setError({ title: errorTitle(e), message: errorMessage(e) });
      setPaying(false);
    }
  };

  // Automatic yearly renewal (on by default; turning it off keeps access until the end date)
  const [renewBusy, setRenewBusy] = useState(false);
  const toggleAutoRenew = async (enabled: boolean) => {
    if (!enabled && !window.confirm('Turn off automatic renewal? Your plan stays active until the end date, then your Donor Circle will be locked. Finding donors and posting requests stay free.')) return;
    setRenewBusy(true);
    setError(null);
    try {
      setMine(await subscriptionApi.setAutoRenew(enabled));
    } catch (e) {
      setError({ title: errorTitle(e), message: errorMessage(e) });
    } finally {
      setRenewBusy(false);
    }
  };
  const devRenewNow = async () => {
    setRenewBusy(true);
    try {
      const r = await subscriptionApi.devExpire();
      refreshSubscriptionStatus();
      setMine(r.mine);
    } catch (e) {
      setError({ title: errorTitle(e), message: errorMessage(e) });
    } finally {
      setRenewBusy(false);
    }
  };

  const price = plan ? `₹${plan.amountInr}` : '₹200';
  const period = plan && plan.periodMonths !== 12 ? `${plan.periodMonths} months` : 'year';

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Card className="shadow-lg border-line-border overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-brand-500 to-brand-600 text-white">
          <ShieldCheck className="w-8 h-8 mb-2" />
          <h1 className="text-xl font-bold">Keep your family safe</h1>
          <p className="text-sm text-white/90">Donor Circle subscription</p>
          <p className="mt-3 text-3xl font-black">
            {price} <span className="text-base font-semibold text-white/90">/ {period}</span>
          </p>
        </div>

        <CardContent className="p-6 space-y-5">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-ink-secondary">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          )}
          {appConfig.isDemo && <p className="text-sm text-ink-secondary">Subscriptions work with the live backend, not in demo mode.</p>}

          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900" id="always-free">
            <p className="font-bold mb-1.5">Always free for everyone</p>
            <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
              <li>Find donors and post blood requests</li>
              <li>Matching donors near the hospital are alerted</li>
              <li>Get request alerts, respond and donate</li>
            </ul>
          </div>

          <p className="text-sm font-bold text-ink-main">What the Donor Circle adds</p>
          <ul className="space-y-2.5 text-sm text-ink-main">
            <li className="flex gap-2">
              <Users className="w-5 h-5 text-brand-500 flex-shrink-0" /> Share your savior link and family invite to build your own donor list
            </li>
            <li className="flex gap-2">
              <Bell className="w-5 h-5 text-brand-500 flex-shrink-0" /> People who pledged to you are alerted on your requests, wherever they live
            </li>
            <li className="flex gap-2">
              <Users className="w-5 h-5 text-brand-500 flex-shrink-0" /> See who is ready to donate for each family member
            </li>
            <li className="flex gap-2">
              <Phone className="w-5 h-5 text-brand-500 flex-shrink-0" /> Call them directly in an emergency
            </li>
            <li className="flex gap-2">
              <Bell className="w-5 h-5 text-brand-500 flex-shrink-0" /> Get notified when someone joins your circle
            </li>
          </ul>
          <p className="text-xs text-ink-secondary">Donating blood is always free. You only pay for referrals and your own Donor Circle.</p>

          {error && <ErrorBanner title={error.title} message={error.message} />}

          {sponsor && (
            <p className="text-sm text-ink-main rounded-xl bg-emerald-50 border border-emerald-200 p-3" id="sponsored-by">
              Sponsored by <strong>{sponsor.name}</strong> until {formatDate(sponsor.endsAt)}. No payment needed.
            </p>
          )}
          {/* Also offered to people who already pay: sponsored months start after their paid period */}
          {!appConfig.isDemo && !loading && !sponsor && !success && (
            <PartnerCodeCard onRedeemed={() => subscriptionApi.mine().then(setMine).catch(() => undefined)} />
          )}

          {mine?.active && !success && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 space-y-3" id="subscription-status">
              <p>
                Your subscription is active until <strong>{formatDate(mine.endsAt)}</strong>.{' '}
                {mine.autoRenew
                  ? mine.renewalMode === 'automatic'
                    ? `It renews automatically on ${formatDate(mine.renewsOn)}.`
                    : `Automatic renewal is on: we’ll remind you a week before ${formatDate(mine.renewsOn)} to renew in one tap.`
                  : 'Automatic renewal is off, so it will end on that date.'}
              </p>
              {mine.provider !== 'partner' && (
              <label className="flex items-center gap-2 text-sm text-ink-main">
                <input
                  type="checkbox"
                  id="auto-renew-toggle"
                  checked={mine.autoRenew}
                  disabled={renewBusy}
                  onChange={(e) => toggleAutoRenew(e.target.checked)}
                />
                Renew automatically every {period}
              </label>
              )}
              {plan?.devSimulation && mine.provider === 'dev_simulated' && (
                <Button size="sm" variant="ghost" onClick={devRenewNow} isLoading={renewBusy} leftIcon={<FlaskConical className="w-4 h-4" />}>
                  Test: end my plan now and run renewal
                </Button>
              )}
              {mine.renewalMode !== 'automatic' && <p className="text-xs">Paying again now adds another {period}.</p>}
            </div>
          )}

          {success && mine ? (
            <div className="text-center space-y-3 py-2">
              <CheckCircle2 className="w-12 h-12 text-status-success mx-auto" />
              <p className="text-base font-bold text-ink-main">You’re subscribed!</p>
              <p className="text-sm text-ink-secondary">Active until {formatDate(mine.endsAt)}.</p>
              <Button variant="primary" onClick={() => navigate('/app/family')}>
                See your Donor Circle
              </Button>
            </div>
          ) : isInsideMobileApp() ? (
            // Web-first model: no purchase inside the mobile app
            <div className="rounded-xl border border-line-border p-4 text-sm text-ink-main space-y-2">
              <p className="font-semibold flex items-center gap-2">
                <Globe className="w-4 h-4" /> Subscribe on our website
              </p>
              <p className="text-ink-secondary">
                Open {window.location.host} in your browser, sign in with {user?.email || 'your account'}, and subscribe there. Then come back
                to the app; your subscription will be active here too.
              </p>
            </div>
          ) : (
            plan && (
              <div className="space-y-3">
                {plan.paymentsConfigured ? (
                  <Button variant="primary" size="lg" className="w-full justify-center" isLoading={paying} onClick={pay}>
                    Pay {price} securely
                  </Button>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                    Online payment is not set up yet (Razorpay keys missing in backend settings).
                  </div>
                )}
                {plan.devSimulation && (
                  <Button variant="outline" className="w-full justify-center" isLoading={paying} onClick={simulate} leftIcon={<FlaskConical className="w-4 h-4" />}>
                    Simulate payment (local testing only)
                  </Button>
                )}
                <p className="text-[11px] text-ink-muted text-center">
                  Payments are processed by Razorpay (UPI, cards, net banking). We never see your card or UPI details.
                </p>
              </div>
            )
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-ink-secondary">
        <Link to="/app/family" className="font-semibold text-brand-600">
          ← Back to My Family
        </Link>
      </p>
    </div>
  );
};
