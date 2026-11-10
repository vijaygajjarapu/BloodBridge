import React, { useEffect, useState } from 'react';
import { useSubscription } from '../../hooks/useSubscription';
import { SubscribeToShareNotice, LockedShareButton } from '../../components/subscription/SubscribeToShareNotice';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  Share2,
  Bell,
  Heart,
  ShieldCheck,
  ArrowRight,
  Copy,
  Check,
  Sparkles,
  ChevronRight,
  Activity,
  AlertTriangle, Siren, Sparkles as GoodNewsIcon, Info, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { donorService, referralService, notificationService } from '../../services';
import type { DonorSummary } from '../../types/donor';
import type { ReferralStats } from '../../types/referral';
import type { AppNotification } from '../../types/notification';
import { getNotificationAction } from '../../utils/notificationActions';
import { StatCard } from '../../components/ui/StatCard';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BloodGroupBadge, StatusBadge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { FamilyCircleCard } from '../../components/family/FamilyCircleCard';
import { PendingFamilyPledgeCard } from '../../components/family/PendingFamilyPledgeCard';

/** Good-news / info banners are shown once per notification (remembered on this device) */
const SEEN_KEY = (userId: string) => `bb.seenBanners.${userId}`;
const BANNER_MAX_AGE_DAYS = 3;
const readSeen = (userId: string): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY(userId)) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
const rememberSeen = (userId: string, id: string) => {
  try {
    localStorage.setItem(SEEN_KEY(userId), JSON.stringify([id, ...readSeen(userId).filter((x) => x !== id)].slice(0, 200)));
  } catch {
    /* private mode: the banner may show again next visit */
  }
};

export const DonorDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Sharing the savior link is a subscriber feature
  const { subscribed: canShare, loading: subLoading } = useSubscription();
  const shareLocked = !subLoading && !canShare;
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [donors, setDonors] = useState<DonorSummary[]>([]);
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [urgentAlert, setUrgentAlert] = useState<AppNotification | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const [donorsRes, statsRes, notifsRes] = await Promise.all([
          donorService.listMyDonors({ page: 1, pageSize: 5 }),
          referralService.getReferralStats(),
          notificationService.getNotifications(),
        ]);

        if (isMounted) {
          setDonors(donorsRes.data);
          setReferralStats(statsRes);
          // A blood request near you stays until you answer or close it.
          // Other news (new donor joined, updates) shows once, only if it is recent, then lives in Notifications.
          const unread = notifsRes.filter((n) => !n.isRead);
          const urgent = unread.find((n) => n.type === 'emergency' || n.type === 'emergency_request');
          if (urgent) {
            setUrgentAlert(urgent);
          } else {
            const uid = user?.id || 'me';
            const seen = new Set(readSeen(uid));
            const fresh = unread.find((n) => {
              const age = Date.now() - new Date(n.createdAt).getTime();
              return !seen.has(n.id) && !(age > BANNER_MAX_AGE_DAYS * 86400000);
            });
            if (fresh) rememberSeen(uid, fresh.id);
            setUrgentAlert(fresh || null);
          }
        }
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const referralCode = referralStats?.code || user?.referralCode || '';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const referralUrl = `${origin}/join/${referralCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Opened a family invite before signing up: finish the pledge here */}
      <PendingFamilyPledgeCard />

      {/* Latest unread update: red for a blood request, green for good news, neutral otherwise */}
      {urgentAlert && (() => {
        const action = getNotificationAction(urgentAlert);
        const styles =
          action.tone === 'urgent'
            ? { box: 'bg-gradient-to-r from-red-600 to-brand-700 text-white', kicker: 'text-amber-200', text: 'text-white/90', icon: <AlertTriangle className="w-5 h-5 text-amber-300" />, iconBg: 'bg-white/20', btn: 'text-brand-700', close: 'text-white/80 hover:text-white' }
            : action.tone === 'good'
              ? { box: 'bg-gradient-to-r from-emerald-600 to-green-600 text-white', kicker: 'text-emerald-100', text: 'text-white/90', icon: <GoodNewsIcon className="w-5 h-5 text-white" />, iconBg: 'bg-white/20', btn: 'text-emerald-700', close: 'text-white/80 hover:text-white' }
              : { box: 'bg-white border border-line-border text-ink-main', kicker: 'text-brand-600', text: 'text-ink-secondary', icon: <Info className="w-5 h-5 text-brand-600" />, iconBg: 'bg-brand-50', btn: 'text-brand-700', close: 'text-ink-muted hover:text-ink-main' };
        const dismiss = () => {
          notificationService.markAsRead(urgentAlert.id).catch(() => undefined);
          setUrgentAlert(null);
        };
        return (
          <aside
            aria-label={action.kicker}
            id="dashboard-update-banner"
            data-tone={action.tone}
            className={`${styles.box} rounded-xl p-4 sm:p-5 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}
          >
            <div className="flex items-start space-x-3.5">
              <div className={`p-2 rounded-lg ${styles.iconBg} flex-shrink-0 mt-0.5`}>{styles.icon}</div>
              <div>
                <span className={`text-xs font-bold uppercase tracking-wider ${styles.kicker} block`}>{action.kicker}</span>
                <h2 className="text-base sm:text-lg font-bold">{urgentAlert.title}</h2>
                <p className={`text-xs ${styles.text} mt-0.5 max-w-2xl`}>{urgentAlert.message}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
              <Link to={action.to} className="flex-1 sm:flex-none" onClick={dismiss}>
                <Button variant="secondary" size="sm" className={`w-full ${styles.btn} font-bold border-transparent`}>
                  {action.label}
                </Button>
              </Link>
              <button type="button" onClick={dismiss} aria-label="Dismiss" className={`p-2 rounded-lg ${styles.close}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </aside>
        );
      })()}

      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-brand-600 mb-1">
            <Heart className="w-4 h-4 fill-current" />
            <span>Savior Community Member</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-main tracking-tight">
            Welcome back{user?.name ? `, ${user.name}` : ''}!
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">
            Your savior circle is ready for emergency response. Review your referral registrations below.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link to="/app/donors">
            <Button variant="outline" size="md" leftIcon={<Users className="w-4 h-4" />}>
              My donors{referralStats?.successfulRegistrations ? ` (${referralStats.successfulRegistrations})` : ''}
            </Button>
          </Link>
          <Link to="/app/requests/new">
            <Button variant="danger" size="md" leftIcon={<Siren className="w-4 h-4" />}>
              Request blood
            </Button>
          </Link>
          {canShare ? (
            <Link to="/app/referrals/share">
              <Button variant="primary" size="md" leftIcon={<Share2 className="w-4 h-4" />}>
                Share Savior Link
              </Button>
            </Link>
          ) : shareLocked ? (
            <LockedShareButton />
          ) : null}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-4 w-1/2 mb-3" />
              <Skeleton className="h-8 w-1/3 mb-2" />
              <Skeleton className="h-3 w-3/4" />
            </Card>
          ))
        ) : (
          <>
            <StatCard
              label="Circle Donors"
              value={referralStats?.successfulRegistrations ?? 0}
              subtext="Joined via your link"
              icon={<Users className="w-5 h-5" />}
            />

            <StatCard
              label="Ready to Donate"
              value={referralStats?.activeDonorsCount ?? 0}
              subtext="Marked available right now"
              icon={<ShieldCheck className="w-5 h-5 text-status-success" />}
            />

            <StatCard
              label="Joined This Month"
              value={referralStats?.joinedThisMonth ?? 0}
              subtext="New donors in your circle"
              icon={<Share2 className="w-5 h-5" />}
            />

            <StatCard
              label="Awaiting Approval"
              value={referralStats?.pendingRegistrations ?? 0}
              subtext="Signed up, not yet active"
              icon={<Activity className="w-5 h-5 text-brand-500" />}
            />
          </>
        )}
      </div>

      {/* Family Safety Circle (donor list blurred until subscribed) */}
      <FamilyCircleCard compact />

      {/* Main Grid: Referral Code + Recent Registrations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Left Column: Quick Sharing Card */}
        <div className="lg:col-span-5 space-y-6">
          {shareLocked && <SubscribeToShareNotice compact />}
          {canShare && (
          <Card className="border-brand-100 shadow-sm overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-brand-500 to-brand-600 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Your Savior Referral Link</h3>
                <p className="text-xs text-white/80">Invite friends &amp; family to donate</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-mono font-bold text-xs">
                INV
              </div>
            </div>

            <CardContent className="p-5 space-y-4">
              <p className="text-xs text-ink-secondary leading-relaxed">
                When contacts join using your link, they enter your savior circle. Hospital coordinators can then match their blood group during critical emergency shortages.
              </p>

              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Unique Savior Code:
                </label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-50 border border-line-border rounded-lg px-3 py-2 text-xs font-mono font-bold text-brand-600 truncate">
                    {referralUrl}
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleCopyLink}
                    leftIcon={copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-line-border">
                <Link
                  to="/app/referrals/share"
                  className="text-xs font-bold text-brand-600 hover:text-brand-700 inline-flex items-center min-h-[44px]"
                >
                  <span>Open Multi-Channel Share Tool</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Quick Shortcuts */}
          <Card className="p-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-secondary px-2 pt-1">
              Quick Shortcuts
            </h3>
            <div className="divide-y divide-line-border text-xs">
              <Link
                to="/app/donors"
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 text-ink-main font-medium min-h-[44px]"
              >
                <div className="flex items-center space-x-2.5">
                  <Users className="w-4 h-4 text-brand-500" />
                  <span>Browse My Savior Donors</span>
                </div>
                <ChevronRight className="w-4 h-4 text-ink-muted" />
              </Link>

              <Link
                to="/app/settings/privacy"
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 text-ink-main font-medium min-h-[44px]"
              >
                <div className="flex items-center space-x-2.5">
                  <ShieldCheck className="w-4 h-4 text-status-success" />
                  <span>Manage Contact Sharing Consent</span>
                </div>
                <ChevronRight className="w-4 h-4 text-ink-muted" />
              </Link>

              <Link
                to="/app/profile/edit"
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 text-ink-main font-medium min-h-[44px]"
              >
                <div className="flex items-center space-x-2.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Update Blood Type &amp; Availability</span>
                </div>
                <ChevronRight className="w-4 h-4 text-ink-muted" />
              </Link>
            </div>
          </Card>
        </div>

        {/* Right Column: Recent Donor Registrations */}
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <CardHeader>
              <div>
                <h3 className="text-base font-bold text-ink-main">Recent Circle Registrations</h3>
                <p className="text-xs text-ink-secondary">Donors enrolled through your referral link</p>
              </div>
              <Link
                to="/app/donors"
                className="text-xs font-bold text-brand-600 hover:text-brand-700 inline-flex items-center min-h-[44px]"
              >
                <span>View All Donors</span>
                <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </Link>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton className="h-5 w-1/3" />
                      <Skeleton className="h-5 w-1/6" />
                      <Skeleton className="h-5 w-1/6" />
                    </div>
                  ))}
                </div>
              ) : donors.length === 0 ? (
                <EmptyState
                  icon={<Users className="w-8 h-8" />}
                  title="No Donors Registered Yet"
                  description="Share your savior link to invite your first donor. Every registration expands local emergency coverage."
                  actionText={canShare ? 'Share Invite Link' : 'Subscribe to invite donors'}
                  onAction={() => (canShare ? handleCopyLink() : navigate('/app/subscribe'))}
                />
              ) : (
                <div className="divide-y divide-line-border">
                  {donors.map((donor) => (
                    <div
                      key={donor.id}
                      className="p-4 sm:p-5 flex items-center justify-between hover:bg-gray-50/80 transition-colors"
                    >
                      <div className="flex items-center space-x-3.5 overflow-hidden">
                        <BloodGroupBadge group={donor.bloodGroup} />
                        <div className="truncate">
                          <Link
                            to={`/app/donors/${donor.id}`}
                            className="font-bold text-sm text-ink-main hover:text-brand-500 truncate block"
                          >
                            {donor.name}
                          </Link>
                          <div className="text-xs text-ink-secondary truncate">
                            {donor.location.city}, {donor.location.state}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 flex-shrink-0">
                        <StatusBadge status={donor.status} />
                        <Link
                          to={`/app/donors/${donor.id}`}
                          aria-label={`View details for ${donor.name}`}
                          className="text-ink-muted hover:text-brand-500 p-1.5 rounded-lg min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
