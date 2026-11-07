import React from 'react';
import { Heart, ShieldCheck, Users, Target, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';

export const AboutPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center space-x-2 bg-brand-50 text-brand-600 px-3 py-1 rounded-full text-xs font-semibold">
          <Heart className="w-3.5 h-3.5 fill-current" />
          <span>Our Healthcare Mission</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-ink-main tracking-tight">
          Bridging the Critical Gap in Emergency Blood Supply
        </h1>
        <p className="text-base text-ink-secondary leading-relaxed">
          BloodBridge was founded on a simple observation: public blood donor lists fail during real emergencies because they are outdated, impersonal, and compromise donor privacy. We replaced that broken model with a verified, referral-based savior circle.
        </p>
      </div>

      {/* Core Principles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
            <Users className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-ink-main mb-2">Referral Accountability</h2>
          <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
            Every donor is introduced through an existing savior. This fosters personal accountability, higher donation attendance, and authentic emergency readiness.
          </p>
        </Card>

        <Card className="p-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-status-success flex items-center justify-center mb-4">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-ink-main mb-2">Granular Privacy Control</h2>
          <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
            Donors maintain 100% control over their phone numbers. Contact details are never sold, exposed to web scrapers, or disclosed without explicit mutual consent.
          </p>
        </Card>

        <Card className="p-6">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
            <Target className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-ink-main mb-2">Zero Commercial Bias</h2>
          <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
            BloodBridge operates strictly as a humanitarian community initiative. We connect voluntary saviors with verified medical professionals without intermediaries.
          </p>
        </Card>
      </div>

      {/* Story & Commitment */}
      <Card className="border-line-border">
        <CardContent className="p-6 sm:p-10 space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-ink-main">
            Why “Be a Donor. Be a Savior.” Matters
          </h2>
          <p className="text-sm text-ink-secondary leading-relaxed">
            Every two seconds, someone in the country needs blood. Whether it’s trauma surgeries, cancer treatments, or postpartum hemorrhage, blood cannot be synthetically manufactured. It must come as a generous gift from one human being to another.
          </p>
          <div className="space-y-3 pt-2">
            {[
              'Chain-of-trust invitation model reduces no-shows during urgent calls.',
              'Real-time blood group matching identifies universal donors (O-) instantly.',
              'Transparent donor audit history protects medical privacy rights.',
              'No public directories or unsolicited marketing robocalls.',
            ].map((pt) => (
              <div key={pt} className="flex items-start space-x-3 text-xs sm:text-sm text-ink-main">
                <CheckCircle2 className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
                <span>{pt}</span>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-line-border flex flex-col sm:flex-row items-center gap-3">
            <Link to="/join/SAVIOR-MV2026">
              <Button variant="primary">Join as a Community Savior</Button>
            </Link>
            <Link to="/privacy">
              <Button variant="secondary">Review Data Privacy Charter</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
