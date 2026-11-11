import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShieldCheck, PhoneCall, Mail, ExternalLink } from 'lucide-react';
import { appConfig } from '../../constants/config';
import { getDefaultCountry } from '../../constants/countries';
import { LegalLine } from '../legal/LegalLine';

export const PublicFooter: React.FC = () => {
  return (
    <footer className="bg-white border-t border-line-border text-ink-main pt-12 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Col */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center space-x-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center">
                <Heart className="w-5 h-5 fill-current" />
              </div>
              <span className="text-xl font-bold tracking-tight text-ink-main">
                Blood<span className="text-brand-500">Nation</span>
              </span>
            </Link>
            <p className="text-xs text-ink-secondary leading-relaxed mb-4">
              A trusted, referral-based blood donation community network. Connecting certified donors with verified healthcare facilities during life-critical emergencies.
            </p>
            <div className="inline-flex items-center text-xs font-semibold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-md">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              Consent-First Donor Network
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-secondary mb-4">Platform</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/#how-it-works" className="text-ink-secondary hover:text-brand-500 transition-colors">
                  How Referral Works
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-ink-secondary hover:text-brand-500 transition-colors">
                  About BloodNation
                </Link>
              </li>
              <li>
                <Link to="/auth/register" className="text-ink-secondary hover:text-brand-500 transition-colors">
                  Join as a Donor
                </Link>
              </li>
              <li>
                <Link to="/auth/login" className="text-ink-secondary hover:text-brand-500 transition-colors">
                  Donor Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Privacy */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-secondary mb-4">Privacy & Safety</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/privacy" className="text-ink-secondary hover:text-brand-500 transition-colors">
                  Privacy Policy &amp; Consent
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-ink-secondary hover:text-brand-500 transition-colors">
                  Terms of Participation
                </Link>
              </li>
              <li>
                <Link to="/safety" className="text-ink-secondary hover:text-brand-500 transition-colors">
                  Fraud &amp; Safety
                </Link>
              </li>
              <li>
                <Link to="/app/help" className="text-ink-secondary hover:text-brand-500 transition-colors">
                  Donor Help &amp; FAQs
                </Link>
              </li>
              <li>
                <Link to="/admin/login" className="text-ink-secondary hover:text-brand-500 transition-colors inline-flex items-center">
                  Administrator Portal
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Emergency & Support Contact */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-secondary mb-4">Emergency Dispatch</h4>
            <div className="space-y-3 text-xs text-ink-secondary">
              <div className="flex items-start space-x-2.5">
                <PhoneCall className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
                <div>
                  {appConfig.emergencyUrgentLine ? (
                    <>
                      <span className="font-semibold text-ink-main block">24/7 Blood Line:</span>
                      <span>{appConfig.emergencyUrgentLine}</span>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-ink-main block">Medical emergency ({getDefaultCountry().name}):</span>
                      <span>Call {getDefaultCountry().nationalEmergencyNumber}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <Mail className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-ink-main block">Community Inquiries:</span>
                  <span>{appConfig.supportEmail}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-line-border pt-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3 text-xs text-ink-secondary">
          <LegalLine detailed />
          <div className="flex items-center space-x-4 flex-shrink-0">
            <span>Policy Version {appConfig.currentPolicyVersion}</span>
            <span>•</span>
            <span className="text-brand-600 font-medium">Be a Donor. Be a Savior.</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
