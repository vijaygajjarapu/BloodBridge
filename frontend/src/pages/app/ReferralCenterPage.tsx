import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Share2,
  Copy,
  Check,
  Users,
  Award,
  Sparkles,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { referralService } from '../../services';
import type { ReferralStats } from '../../types/referral';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { SubscribeToShareNotice, LockedShareButton } from '../../components/subscription/SubscribeToShareNotice';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BloodGroupBadge } from '../../components/ui/Badge';
import { StatCard } from '../../components/ui/StatCard';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../constants/countries';

export const ReferralCenterPage: React.FC = () => {
  const { user } = useAuth();
  // Sharing the savior link is a subscriber feature
  const { subscribed: canShare, loading: subLoading } = useSubscription();
  const shareLocked = !subLoading && !canShare;
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [nativeShareAvailable, setNativeShareAvailable] = useState(false);

  useEffect(() => {
    setNativeShareAvailable(typeof navigator !== 'undefined' && Boolean(navigator.share));
    let isMounted = true;
    const loadStats = async () => {
      setLoading(true);
      try {
        const res = await referralService.getReferralStats();
        if (isMounted) setStats(res);
      } catch (err) {
        console.error('Failed to load referral stats', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadStats();
    return () => {
      isMounted = false;
    };
  }, []);

  const referralCode = stats?.code || user?.referralCode || '';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const referralUrl = `${origin}/join/${referralCode}`;

  const invitationMessage = `I'm a verified blood donor on Manvi Blood. Every single donation can save up to 3 lives. Join my Donor Circle here: ${referralUrl}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Manvi Blood Savior Network',
          text: invitationMessage,
          url: referralUrl,
        });
      } catch {
        // user cancelled share
      }
    } else {
      handleCopyLink();
    }
  };

  const handleWhatsAppShare = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(invitationMessage)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-main tracking-tight">
            Savior Referral Center
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">
            Expand your community’s emergency blood network by inviting trusted saviors.
          </p>
        </div>

        {canShare ? (
          <Link to="/app/referrals/share">
            <Button variant="primary" leftIcon={<Share2 className="w-4 h-4" />}>
              Advanced Share Options
            </Button>
          </Link>
        ) : shareLocked ? (
          <LockedShareButton />
        ) : null}
      </div>

      {shareLocked && <SubscribeToShareNotice />}

      {/* Main Referral Invitation Card */}
      {canShare && (
      <Card className="shadow-md border-brand-200 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-brand-500 to-brand-600 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-200 flex items-center">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Verified Savior Code
            </span>
            <div className="text-2xl sm:text-3xl font-mono font-extrabold tracking-wider">
              {referralCode}
            </div>
            <p className="text-xs text-white/90">
              Personalized invite code tied to your community profile
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyLink}
              leftIcon={copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              className="font-bold flex-1 md:flex-none"
            >
              {copied ? 'Link Copied!' : 'Copy Link'}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleWhatsAppShare}
              leftIcon={<MessageSquare className="w-3.5 h-3.5 text-emerald-600" />}
              className="font-bold flex-1 md:flex-none"
            >
              WhatsApp
            </Button>

            {nativeShareAvailable && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleNativeShare}
                leftIcon={<Share2 className="w-3.5 h-3.5" />}
                className="font-bold flex-1 md:flex-none"
              >
                Share
              </Button>
            )}
          </div>
        </div>

        <CardContent className="p-6 bg-white space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl border border-line-border text-xs">
            <div className="flex items-center space-x-2 text-ink-secondary truncate w-full">
              <span className="font-semibold text-ink-main flex-shrink-0">Direct Link:</span>
              <span className="font-mono text-ink-main truncate select-all">{referralUrl}</span>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="text-xs font-bold text-brand-600 hover:text-brand-700 min-h-[36px] px-2 flex-shrink-0"
            >
              {copied ? 'Copied' : 'Click to Copy'}
            </button>
          </div>

          <div className="flex items-center space-x-2 text-xs text-ink-secondary">
            <ShieldCheck className="w-4 h-4 text-status-success flex-shrink-0" />
            <span>
              Privacy Protected: Shared invitation links never reveal personal phone numbers or private medical history.
            </span>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Referral Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-4 w-1/2 mb-3" />
              <Skeleton className="h-8 w-1/3 mb-2" />
            </Card>
          ))
        ) : (
          <>
            <StatCard
              label="Successful Registrations"
              value={stats?.successfulRegistrations ?? 0}
              subtext="Donors joined your circle"
              icon={<Users className="w-5 h-5" />}
            />

            <StatCard
              label="Active Ready Saviors"
              value={stats?.activeDonorsCount ?? 0}
              subtext="Ready for emergency alerts"
              icon={<Award className="w-5 h-5 text-status-success" />}
            />

            <StatCard
              label="Awaiting Approval"
              value={stats?.pendingRegistrations ?? 0}
              subtext="Signed up, not yet active"
              icon={<Sparkles className="w-5 h-5 text-amber-500" />}
            />

            <StatCard
              label="Joined This Month"
              value={stats?.joinedThisMonth ?? 0}
              subtext="New donors in your circle"
              icon={<Share2 className="w-5 h-5" />}
            />
          </>
        )}
      </div>

      {/* Activity & Instructions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Recent Circle Activity */}
        <div className="lg:col-span-7">
          <Card>
            <CardHeader>
              <div>
                <h3 className="font-bold text-base text-ink-main">Recent Referral Activity</h3>
                <p className="text-xs text-ink-secondary">Latest members who registered using your code</p>
              </div>
              <Link to="/app/donors" className="text-xs font-bold text-brand-600 hover:text-brand-700">
                View Full Circle
              </Link>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : !stats?.recentActivity || stats.recentActivity.length === 0 ? (
                <div className="p-8 text-center text-xs text-ink-secondary">
                  No referral registrations yet. Share your code to build your circle!
                </div>
              ) : (
                <div className="divide-y divide-line-border">
                  {stats.recentActivity.map((act) => (
                    <div key={act.id} className="p-4 flex items-center justify-between hover:bg-gray-50/70">
                      <div className="flex items-center space-x-3">
                        <BloodGroupBadge group={act.bloodGroup as any} />
                        <div>
                          <span className="font-bold text-sm text-ink-main block">{act.donorName}</span>
                          <span className="text-xs text-ink-secondary">
                            Joined {formatDate(act.registeredAt)}
                          </span>
                        </div>
                      </div>

                      <span className="text-xs font-semibold text-status-success bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {act.status === 'verified' ? 'Verified Ready' : 'Registered'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Savior Referral Instructions */}
        <div className="lg:col-span-5">
          <Card className="p-6 space-y-4">
            <h3 className="font-bold text-base text-ink-main border-b border-line-border pb-2">
              How Referral Multiplies Impact
            </h3>

            <div className="space-y-3 text-xs text-ink-secondary leading-relaxed">
              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                  1
                </span>
                <p>
                  <strong className="text-ink-main">Share with Trusted Friends:</strong> Invite people who live or work near your community.
                </p>
              </div>

              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                  2
                </span>
                <p>
                  <strong className="text-ink-main">No Spam Policy:</strong> Personal invitations ensure high response rates when emergency coordinators post critical requests.
                </p>
              </div>

              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                  3
                </span>
                <p>
                  <strong className="text-ink-main">Save Lives as a Group:</strong> Donors who join via your circle can also create their own savior codes, exponentially expanding safety.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Link to={canShare ? '/app/referrals/share' : '/app/subscribe'} className="block">
                <Button variant="outline" size="sm" className="w-full justify-center">
                  {canShare ? 'Preview Savior Invitation Cards' : 'Subscribe to share invitation cards'}
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
