import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { CheckCircle2, Heart, Copy, Check, ArrowRight, Share2, ShieldCheck } from 'lucide-react';
import type { DonorRegistrationResult } from '../../types/donor';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { BloodGroupBadge } from '../../components/ui/Badge';

export const RegistrationSuccessPage: React.FC = () => {
  const location = useLocation();
  const state = location.state as {
    result?: DonorRegistrationResult;
    registeredName?: string;
    bloodGroup?: string;
    referralCodeUsed?: string;
  } | null;

  const [copied, setCopied] = useState(false);

  const registeredName = state?.registeredName || 'Community Savior';
  const newReferralCode = state?.result?.referralCodeCreated || 'SAVIOR-NEW2026';
  const bloodGroup = state?.bloodGroup || 'O+';

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const shareUrl = `${origin}/join/${newReferralCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-xl mx-auto py-12 px-4 space-y-6">
      <Card className="shadow-xl border-line-border overflow-hidden text-center">
        {/* Header */}
        <div className="bg-brand-500 text-white p-8 space-y-3">
          <div className="w-16 h-16 rounded-full bg-white text-status-success mx-auto flex items-center justify-center shadow-md animate-in zoom-in duration-300">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome to the Savior Circle!
          </h1>
          <p className="text-xs sm:text-sm text-white/90 max-w-sm mx-auto">
            {state?.result?.message || 'Your donor registration has been recorded successfully.'}
          </p>
        </div>

        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* Registered Identity Summary */}
          <div className="bg-gray-50 border border-line-border rounded-xl p-4 text-left flex items-center justify-between">
            <div>
              <span className="text-xs text-ink-secondary block">Registered Donor</span>
              <span className="text-base font-bold text-ink-main">{registeredName}</span>
              <span className="text-xs text-status-success font-semibold flex items-center mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                Active in Emergency Matching
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-ink-secondary block mb-1">Blood Type</span>
              <BloodGroupBadge group={bloodGroup as any} size="md" />
            </div>
          </div>

          {/* Generated Referral Code Card */}
          <div className="bg-brand-50/70 border-2 border-brand-200 rounded-xl p-5 text-left space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Share2 className="w-4 h-4 text-brand-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-brand-800">
                  Your New Savior Referral Link
                </span>
              </div>
              <span className="text-[10px] font-bold text-brand-700 bg-white px-2 py-0.5 rounded shadow-xs">
                Ready to Share
              </span>
            </div>

            <p className="text-xs text-brand-900 leading-relaxed">
              Every donor you invite broadens your community’s safety net. Share this invitation link with family and friends:
            </p>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-white border border-brand-200 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-ink-main truncate select-all"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleCopyLink}
                leftIcon={copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                className="flex-shrink-0"
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* Next Steps List */}
          <div className="text-left text-xs text-ink-secondary space-y-2.5 pt-2 border-t border-line-border">
            <span className="font-bold text-ink-main block">What happens next:</span>
            <div className="flex items-start space-x-2">
              <span className="w-4 h-4 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                1
              </span>
              <span>Your profile is queued for emergency blood matching in your designated locality.</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="w-4 h-4 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                2
              </span>
              <span>When a critical need arises, certified dispatchers reach out via verified SMS or call.</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <Link to="/auth/login" className="w-full sm:w-1/2">
              <Button variant="secondary" className="w-full justify-center">
                Sign In to Account
              </Button>
            </Link>

            <Link to="/app/dashboard" className="w-full sm:w-1/2">
              <Button
                variant="primary"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="w-full justify-center shadow-sm"
              >
                Go to Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
