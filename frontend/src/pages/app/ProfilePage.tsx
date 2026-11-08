import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Phone,
  Mail,
  ShieldCheck,
  Calendar,
  Share2,
  Edit,
  Award,
  Heart,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { profileService } from '../../services';
import type { User as UserProfile } from '../../types/auth';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BloodGroupBadge, StatusBadge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { EligibilityCard } from '../../components/donor/EligibilityCard';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  // The signed-in person's OWN profile (blood group, location) from GET /profile
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadProfileData = async () => {
      setLoading(true);
      try {
        const profile = await profileService.getProfile();
        if (isMounted) setMyProfile(profile);
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadProfileData();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-main tracking-tight">
            Savior Donor Profile
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">
            Your verified identity, blood classification, and community standing
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <Link to="/app/profile/edit">
            <Button variant="primary" leftIcon={<Edit className="w-4 h-4" />}>
              Edit Profile
            </Button>
          </Link>
          <Link to="/app/settings/privacy">
            <Button variant="secondary" leftIcon={<ShieldCheck className="w-4 h-4" />}>
              Privacy Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Profile Card */}
      <Card className="shadow-md border-line-border overflow-hidden">
        <div className="p-6 sm:p-8 bg-gradient-to-r from-brand-500 to-brand-600 text-white flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 text-center sm:text-left">
          <div className="w-20 h-20 rounded-2xl bg-white/20 p-1 ring-4 ring-white/30 flex-shrink-0">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="w-full h-full object-cover rounded-xl"
              />
            ) : (
              <div className="w-full h-full bg-brand-700 rounded-xl flex items-center justify-center font-bold text-2xl">
                {user?.name?.charAt(0) || 'M'}
              </div>
            )}
          </div>

          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl sm:text-2xl font-bold">{user?.name || 'Marcus Vance'}</h2>
              <span className="text-xs font-semibold text-white bg-white/20 px-2.5 py-0.5 rounded-full flex items-center">
                <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-300" />
                Verified Savior
              </span>
            </div>
            <p className="text-xs text-white/90">
              Personal Savior Code: <span className="font-mono font-bold">{user?.referralCode}</span>
            </p>
            <p className="text-xs text-white/80">
              Community Savior since {user?.createdAt ? new Date(user.createdAt).getFullYear() : '2025'}
            </p>
          </div>

          <div className="text-center sm:text-right flex-shrink-0 bg-white/10 px-4 py-3 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-white/80 block mb-1">
              Primary Blood Group
            </span>
            {myProfile?.bloodGroup ? (
              <BloodGroupBadge group={myProfile.bloodGroup as any} size="md" />
            ) : loading ? (
              <span className="text-sm font-bold text-white/80">…</span>
            ) : (
              <Link to="/app/profile/edit" className="text-xs font-bold underline text-white">
                Not set — add it
              </Link>
            )}
          </div>
        </div>

        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="p-4 bg-gray-50 rounded-xl border border-line-border flex items-start space-x-3">
              <Phone className="w-5 h-5 text-brand-500 mt-0.5" />
              <div>
                <span className="text-xs font-semibold text-ink-secondary block">Primary Phone</span>
                <span className="font-mono font-bold text-ink-main">{user?.phone}</span>
                <span className="text-[11px] text-status-success font-medium flex items-center mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  SMS Alerts Enabled
                </span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-line-border flex items-start space-x-3">
              <Mail className="w-5 h-5 text-brand-500 mt-0.5" />
              <div>
                <span className="text-xs font-semibold text-ink-secondary block">Registered Email</span>
                <span className="font-bold text-ink-main truncate block">{user?.email || 'None'}</span>
                <span className="text-[11px] text-ink-secondary">Receipts &amp; Eligibility notices</span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-line-border flex items-start space-x-3">
              <Calendar className="w-5 h-5 text-brand-500 mt-0.5" />
              <div>
                <span className="text-xs font-semibold text-ink-secondary block">Registration Status</span>
                <span className="font-bold text-ink-main block">Active Community Ready</span>
                <span className="text-[11px] text-ink-secondary">Eligible for routine rest cycle tracking</span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-line-border flex items-start space-x-3">
              <Award className="w-5 h-5 text-brand-500 mt-0.5" />
              <div>
                <span className="text-xs font-semibold text-ink-secondary block">Donations Recorded</span>
                <span className="font-bold text-ink-main block">
                  {myProfile?.totalDonations ?? 0} donation{(myProfile?.totalDonations ?? 0) === 1 ? '' : 's'}
                </span>
                <span className="text-[11px] text-brand-600 font-semibold">One donation can help up to 3 patients</span>
              </div>
            </div>
          </div>

          {/* Privacy & Settings Notice */}
          <div className="p-4 rounded-xl bg-brand-50/60 border border-brand-200 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-brand-900 block">Contact Sharing Consent</span>
              <p className="text-xs text-brand-800">
                You currently permit verified emergency coordinators to view your direct phone during active shortages.
              </p>
            </div>
            <Link to="/app/settings/privacy" className="flex-shrink-0">
              <Button variant="outline" size="sm" className="bg-white">
                Review Consent
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Donor self-check: age, weight, gap between donations, reasons to wait */}
      <EligibilityCard />
    </div>
  );
};
