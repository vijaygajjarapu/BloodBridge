import React from 'react';
import { Card, CardContent } from '../../components/ui/Card';
import { appConfig } from '../../constants/config';
import { FileText, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { getDefaultCountry } from '../../constants/countries';

export const TermsPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center space-x-2 bg-gray-100 text-ink-secondary px-3 py-1 rounded-full text-xs font-semibold">
          <FileText className="w-3.5 h-3.5" />
          <span>Terms Version {appConfig.currentPolicyVersion}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-ink-main tracking-tight">
          BloodBridge Savior Participation Terms
        </h1>
        <p className="text-sm text-ink-secondary max-w-2xl mx-auto">
          Please review the operating terms governing community donor enrollment and emergency network coordination.
        </p>
      </div>

      <Card>
        <CardContent className="p-6 sm:p-10 space-y-8 text-sm text-ink-secondary leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-ink-main">1. Nature of the Network</h2>
            <p>
              BloodBridge operates as an emergency information bridge connecting voluntary donors with registered health providers. BloodBridge does not directly perform blood transfusions, collect specimens, or replace professional clinical advice.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-ink-main">2. Voluntary Participation</h2>
            <p>
              All blood and platelet donations are completely voluntary and unpaid in accordance with humanitarian blood banking standards. You may declare yourself unavailable or adjust your readiness preferences at any time through your dashboard.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-ink-main">3. Accurate Medical Self-Reporting</h2>
            <p>
              Savior donors pledge to provide truthful and accurate information regarding their blood group and general eligibility. Blood collection centers will always conduct standard mandatory hemoglobin and infectious marker screenings before any actual phlebotomy procedure.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-ink-main">4. Referral Conduct &amp; Safety</h2>
            <p>
              Referral codes may only be shared with individuals you believe meet the voluntary criteria for blood donation. Harassment, spam invitations, or commercial use of savior codes will result in account suspension and referral code invalidation.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-ink-main">5. Limitation of Liability</h2>
            <p>
              BloodBridge makes every reasonable effort to verify emergency coordinator identities. However, clinical arrangements between donors and licensed healthcare centers remain the clinical responsibility of the certified medical facility.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-ink-main">6. Country of Service and Governing Law</h2>
            <p>
              BloodBridge is currently available in {getDefaultCountry().name}. Your account, donor profile and searches belong to the country you choose at sign-up. Personal data of donors in {getDefaultCountry().name} is handled under the {getDefaultCountry().privacyLaw}, and these terms are governed by the laws of {getDefaultCountry().name}.
            </p>
          </section>

          <div className="pt-6 border-t border-line-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-ink-secondary">Last updated: April 2026</p>
            <Link to="/join/SAVIOR-MV2026">
              <Button variant="primary" size="md">
                Accept &amp; Join as Savior
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
