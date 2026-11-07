import React from 'react';
import { ShieldCheck, Lock, EyeOff, UserX, Download, FileText } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { appConfig } from '../../constants/config';
import { getDefaultCountry } from '../../constants/countries';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center space-x-2 bg-emerald-50 text-status-success px-3 py-1 rounded-full text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Policy Version {appConfig.currentPolicyVersion}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-ink-main tracking-tight">
          BloodBridge Data Privacy &amp; Consent Charter
        </h1>
        <p className="text-sm text-ink-secondary max-w-2xl mx-auto">
          We treat donor contact details with the highest medical confidentiality standard. Here is exactly how your data is protected and controlled.
        </p>
        <p className="text-xs text-ink-secondary max-w-2xl mx-auto">
          For donors in {getDefaultCountry().name}, this charter is written to follow the {getDefaultCountry().privacyLaw}.
        </p>
      </div>

      <div className="space-y-6 text-sm text-ink-main leading-relaxed">
        {/* Section 1 */}
        <Card>
          <CardContent className="p-6 sm:p-8 space-y-3">
            <div className="flex items-center space-x-2.5 text-brand-600 font-bold text-base mb-1">
              <EyeOff className="w-5 h-5 text-brand-500" />
              <h2>1. Contact Sharing Consent &amp; Visibility</h2>
            </div>
            <p className="text-ink-secondary">
              Your mobile phone number is <strong>never displayed on open web pages</strong> or indexed by search robots. Contact details are accessible only when you actively check the consent box during registration or profile setup.
            </p>
            <p className="text-ink-secondary">
              In emergency scenarios, authorized hospital coordinators receive temporary, audited access to matching blood donors. Even in these urgent situations, access is logged in an immutable audit trail.
            </p>
          </CardContent>
        </Card>

        {/* Section 2 */}
        <Card>
          <CardContent className="p-6 sm:p-8 space-y-3">
            <div className="flex items-center space-x-2.5 text-brand-600 font-bold text-base mb-1">
              <Lock className="w-5 h-5 text-brand-500" />
              <h2>2. Referral Relationship Security</h2>
            </div>
            <p className="text-ink-secondary">
              When you join through a friend&apos;s savior code, they receive a notification confirming that a new donor joined their circle. However, your private medical history, donation dates, and physical home address are never disclosed to your referrer.
            </p>
          </CardContent>
        </Card>

        {/* Section 3 */}
        <Card>
          <CardContent className="p-6 sm:p-8 space-y-3">
            <div className="flex items-center space-x-2.5 text-brand-600 font-bold text-base mb-1">
              <Download className="w-5 h-5 text-brand-500" />
              <h2>3. Your Data Rights: Portability &amp; Revocation</h2>
            </div>
            <p className="text-ink-secondary">
              You retain unilateral ownership of your data at all times:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-ink-secondary">
              <li><strong>Immediate Revocation:</strong> Toggle contact sharing off in <Link to="/app/settings/privacy" className="text-brand-500 underline">Privacy Settings</Link> with immediate effect.</li>
              <li><strong>Data Export:</strong> Request a complete JSON or CSV copy of your profile and donation logs.</li>
              <li><strong>Right to Deletion:</strong> Initiate permanent account and record erasure upon request.</li>
            </ul>
          </CardContent>
        </Card>

        {/* Section 4 */}
        <Card>
          <CardContent className="p-6 sm:p-8 space-y-3">
            <div className="flex items-center space-x-2.5 text-brand-600 font-bold text-base mb-1">
              <UserX className="w-5 h-5 text-brand-500" />
              <h2>4. Zero Commercial Monetization</h2>
            </div>
            <p className="text-ink-secondary">
              {appConfig.name} operates under a non-commercial community charter. We do not sell, rent, or lease donor lists to pharmaceutical marketing firms, insurance companies, or commercial brokers.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-gray-100 p-6 rounded-xl text-center space-y-3">
        <h3 className="text-sm font-bold text-ink-main">Have questions regarding your personal information?</h3>
        <p className="text-xs text-ink-secondary">
          Contact our Data Protection Liaison at <span className="text-brand-600 font-semibold">{appConfig.supportEmail}</span>
          {appConfig.supportHelpline && (
            <> or call our helpline at <span className="font-semibold text-ink-main">{appConfig.supportHelpline}</span></>
          )}
          .
        </p>
        <div className="pt-2">
          <Link to="/app/help">
            <Button variant="outline" size="sm">
              Visit Help &amp; Support
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
