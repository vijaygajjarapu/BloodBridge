import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShieldCheck, Users, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';

export const WelcomePage: React.FC = () => {
  return (
    <Card className="shadow-lg border-line-border">
      <CardContent className="p-8 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-500 mx-auto flex items-center justify-center shadow-sm">
          <Heart className="w-8 h-8 fill-current" />
        </div>

        <div>
          <h1 className="text-2xl font-extrabold text-ink-main tracking-tight">
            Welcome to BloodBridge
          </h1>
          <p className="text-sm font-semibold text-brand-600 mt-1">
            Be a Donor. Be a Savior.
          </p>
        </div>

        <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed max-w-sm mx-auto">
          BloodBridge connects compassionate voluntary blood donors with verified emergency medical coordinators through a secure, referral-based savior circle.
        </p>

        <div className="grid grid-cols-2 gap-3 text-left py-2">
          <div className="bg-gray-50 p-3 rounded-lg border border-line-border text-xs">
            <Users className="w-4 h-4 text-brand-500 mb-1" />
            <span className="font-semibold text-ink-main block">Referral Network</span>
            <span className="text-ink-secondary text-[11px]">Join via trusted savior code.</span>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg border border-line-border text-xs">
            <ShieldCheck className="w-4 h-4 text-status-success mb-1" />
            <span className="font-semibold text-ink-main block">Consent First</span>
            <span className="text-ink-secondary text-[11px]">You control contact visibility.</span>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <Link to="/join/SAVIOR-MV2026" className="block">
            <Button variant="primary" size="lg" className="w-full justify-center" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Register as New Savior
            </Button>
          </Link>

          <Link to="/auth/login" className="block">
            <Button variant="secondary" size="lg" className="w-full justify-center">
              Existing Donor Sign In
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
