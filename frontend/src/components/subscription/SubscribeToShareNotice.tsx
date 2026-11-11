import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, ShieldAlert, ArrowRight, Users, HeartPulse } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';

interface Props {
  /** Smaller layout for dashboard cards */
  compact?: boolean;
}

/**
 * Shown instead of the savior (referral) link for people without an active subscription.
 * Pricing rule: only referrals and the Donor Circle are paid. Donor search and blood requests are free for everyone.
 */
export const SubscribeToShareNotice: React.FC<Props> = ({ compact = false }) => (
  <Card className="border-amber-300 bg-amber-50/60 shadow-sm" id="subscribe-to-share">
    <CardContent className={compact ? 'p-4 space-y-3' : 'p-6 space-y-4'}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <Lock className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h2 className={`${compact ? 'text-sm' : 'text-base'} font-bold text-ink-main`}>
            Savior link is a Donor Circle feature
          </h2>
          <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
            Finding donors and posting blood requests are always free. With the Donor Circle you can also invite the
            people you trust, keep your own list of donors for your family, and have them alerted first when your family
            needs blood.
          </p>
        </div>
      </div>

      {!compact && (
        <ul className="grid sm:grid-cols-3 gap-2 text-xs text-ink-main">
          <li className="flex items-start gap-2 rounded-lg bg-white border border-line-border p-2.5">
            <Users className="w-4 h-4 text-brand-600 shrink-0" />
            Invite friends and relatives to join your donor circle
          </li>
          <li className="flex items-start gap-2 rounded-lg bg-white border border-line-border p-2.5">
            <HeartPulse className="w-4 h-4 text-brand-600 shrink-0" />
            See who in your Donor Circle is ready to give
          </li>
          <li className="flex items-start gap-2 rounded-lg bg-white border border-line-border p-2.5">
            <ShieldAlert className="w-4 h-4 text-brand-600 shrink-0" />
            Call them directly in an emergency
          </li>
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Link to="/app/subscribe">
          <Button variant="primary" size={compact ? 'sm' : 'md'} rightIcon={<ArrowRight className="w-4 h-4" />}>
            Get Donor Circle
          </Button>
        </Link>
        <span className="text-[11px] text-ink-muted">Donors you already invited stay in your list.</span>
      </div>
    </CardContent>
  </Card>
);

/** A share button that becomes a "locked" button pointing to the subscribe page */
export const LockedShareButton: React.FC<{ label?: string; className?: string }> = ({ label = 'Share Savior Link', className }) => (
  <Link to="/app/subscribe" title="Subscribe to share your savior link">
    <Button variant="outline" leftIcon={<Lock className="w-4 h-4" />} className={className}>
      {label}
    </Button>
  </Link>
);
