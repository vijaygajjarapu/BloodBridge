import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Heart, ShieldCheck, AlertCircle, ArrowRight, UserCheck, Clock } from 'lucide-react';
import { referralService } from '../../services';
import type { ReferralCodeValidation } from '../../types/referral';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';

export const ReferralLandingPage: React.FC = () => {
  const { referralCode = 'SAVIOR-MV2026' } = useParams<{ referralCode: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [validation, setValidation] = useState<ReferralCodeValidation | null>(null);

  useEffect(() => {
    let isMounted = true;
    const validate = async () => {
      setLoading(true);
      try {
        const result = await referralService.validateReferralCode(referralCode);
        if (isMounted) setValidation(result);
      } catch {
        if (isMounted) {
          setValidation({
            isValid: false,
            code: referralCode,
            canDiscloseReferrer: false,
            message: 'Unable to validate referral invitation code at this time.',
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    validate();
    return () => {
      isMounted = false;
    };
  }, [referralCode]);

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <Card className="p-8 text-center space-y-4">
          <Skeleton className="w-16 h-16 rounded-2xl mx-auto" />
          <Skeleton className="h-6 w-3/4 mx-auto" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </Card>
      </div>
    );
  }

  // Invalid or expired code state
  if (!validation || !validation.isValid) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <Card className="p-8 text-center space-y-6 border-red-200 bg-red-50/30">
          <div className="w-16 h-16 rounded-2xl bg-red-100 text-status-error mx-auto flex items-center justify-center">
            {validation?.isExpired ? <Clock className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
          </div>

          <div>
            <h1 className="text-2xl font-bold text-ink-main">
              {validation?.isExpired ? 'Referral Invitation Expired' : 'Invalid Referral Invitation'}
            </h1>
            <p className="text-xs font-mono font-bold text-status-error mt-1 uppercase">
              Code: {referralCode}
            </p>
          </div>

          <p className="text-xs sm:text-sm text-ink-secondary max-w-sm mx-auto leading-relaxed">
            {validation?.message ||
              'This invitation code is not active. Because BloodBridge relies on trusted community introductions, a valid referral is required.'}
          </p>

          <div className="space-y-3 pt-2">
            <Link to="/join/SAVIOR-MV2026">
              <Button variant="primary" className="w-full justify-center">
                Try Active Demo Code (SAVIOR-MV2026)
              </Button>
            </Link>
            <Link to="/">
              <Button variant="secondary" className="w-full justify-center">
                Return to Homepage
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // Valid Referral State
  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <Card className="shadow-xl border-2 border-brand-100 overflow-hidden">
        {/* Banner */}
        <div className="bg-brand-500 text-white p-6 sm:p-8 text-center relative overflow-hidden">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Heart className="w-7 h-7 fill-current text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            You&apos;ve Been Invited as a Savior
          </h1>
          <p className="text-xs sm:text-sm text-white/90 mt-1">
            Community Emergency Blood Network
          </p>
        </div>

        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* Referrer disclosure (authorized by service) */}
          <div className="bg-brand-50/60 border border-brand-200 rounded-xl p-4 flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-ink-secondary block">Invited by Certified Savior:</span>
              <span className="text-base font-bold text-ink-main">
                {validation.canDiscloseReferrer && validation.referrerName
                  ? validation.referrerName
                  : 'Verified Community Member'}
              </span>
              <span className="text-[11px] text-brand-700 block font-mono font-semibold">
                Invitation Code: {validation.code}
              </span>
            </div>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-ink-secondary leading-relaxed">
            <p>
              Your local healthcare facilities periodically encounter severe blood emergencies. By joining our referral circle, you stand ready to answer urgent alerts when someone with your matching blood type needs immediate support.
            </p>

            <div className="bg-gray-50 p-4 rounded-xl border border-line-border space-y-2">
              <div className="flex items-center space-x-2 text-status-success font-semibold text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>Our Transparent Privacy Guarantee</span>
              </div>
              <p className="text-xs text-ink-secondary">
                We never publicly display your phone number. You define whether hospital coordinators can call you during life-critical shortages.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate(`/join/${validation.code}/register`)}
              rightIcon={<ArrowRight className="w-5 h-5" />}
              className="w-full justify-center shadow-md text-base"
            >
              Continue to Donor Registration
            </Button>
          </div>

          <p className="text-center text-[11px] text-ink-muted">
            Registration takes less than 2 minutes &bull; 100% voluntary participation
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
