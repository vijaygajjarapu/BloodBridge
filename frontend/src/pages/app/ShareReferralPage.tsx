import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  Check,
  MessageSquare,
  Smartphone,
  Share2,
  Heart,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { SubscribeToShareNotice } from '../../components/subscription/SubscribeToShareNotice';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export const ShareReferralPage: React.FC = () => {
  const { user } = useAuth();
  const { subscribed, loading: subLoading } = useSubscription();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'standard' | 'urgent' | 'family'>('standard');

  const referralCode = user?.referralCode || 'SAVIOR-MV2026';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const referralUrl = `${origin}/join/${referralCode}`;

  const messageTemplates = {
    standard: `I'm a registered blood donor on BloodBridge. Every blood donation can save up to 3 lives in emergency situations. Join my local savior circle here: ${referralUrl}`,
    urgent: `Our local community needs more emergency-ready blood donors. Join our verified savior circle on BloodBridge so coordinators can reach out during critical shortages: ${referralUrl}`,
    family: `Hey! I just enrolled as a community blood donor with BloodBridge. Your contact details remain private until you approve emergency contact. Join our family circle here: ${referralUrl}`,
  };

  const currentMessage = messageTemplates[activeTab];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(currentMessage)}`;
    window.open(url, '_blank');
  };

  const handleSms = () => {
    const url = `sms:?&body=${encodeURIComponent(currentMessage)}`;
    window.open(url, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join BloodBridge Savior Network',
          text: currentMessage,
          url: referralUrl,
        });
      } catch {
        // User aborted share modal
      }
    } else {
      handleCopy();
    }
  };

  // Sharing the savior link is a subscriber feature
  if (subLoading) return null;
  if (!subscribed) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-extrabold text-ink-main tracking-tight">Share your savior link</h1>
        <SubscribeToShareNotice />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/app/referrals"
          className="text-xs font-semibold text-ink-secondary hover:text-brand-500 inline-flex items-center min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Referral Center
        </Link>
        <span className="text-xs font-mono font-bold bg-brand-50 text-brand-700 px-2.5 py-1 rounded-md">
          {referralCode}
        </span>
      </div>

      <div className="text-center space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-main tracking-tight">
          Create &amp; Share Savior Invitation
        </h1>
        <p className="text-xs sm:text-sm text-ink-secondary">
          Choose a tailored invitation message to share across your messaging apps.
        </p>
      </div>

      {/* Template Selector Tabs */}
      <div className="flex items-center justify-center p-1 bg-gray-100 rounded-xl max-w-md mx-auto">
        <button
          type="button"
          onClick={() => setActiveTab('standard')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all min-h-[44px] ${
            activeTab === 'standard' ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-secondary hover:text-ink-main'
          }`}
        >
          General Invite
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('urgent')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all min-h-[44px] ${
            activeTab === 'urgent' ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-secondary hover:text-ink-main'
          }`}
        >
          Urgent Call
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('family')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all min-h-[44px] ${
            activeTab === 'family' ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-secondary hover:text-ink-main'
          }`}
        >
          Friends &amp; Family
        </button>
      </div>

      {/* Visual Preview Card */}
      <Card className="shadow-lg border-2 border-brand-100 overflow-hidden">
        <div className="p-4 bg-brand-500 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Heart className="w-5 h-5 fill-current" />
            <span className="text-xs font-bold uppercase tracking-wider">Invitation Preview</span>
          </div>
          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono font-semibold">
            Savior Circle
          </span>
        </div>

        <CardContent className="p-6 space-y-4">
          <div className="p-4 bg-gray-50 border border-line-border rounded-xl font-sans text-xs text-ink-main leading-relaxed select-all">
            {currentMessage}
          </div>

          <div className="flex items-center space-x-2 text-xs text-status-success font-medium">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <span>Safe Sharing: Only the public invitation link is attached. Private data is never leaked.</span>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Button
          variant="primary"
          onClick={handleWhatsApp}
          leftIcon={<MessageSquare className="w-4 h-4 text-emerald-300" />}
          className="w-full justify-center shadow-sm"
        >
          Share on WhatsApp
        </Button>

        <Button
          variant="secondary"
          onClick={handleSms}
          leftIcon={<Smartphone className="w-4 h-4 text-blue-600" />}
          className="w-full justify-center"
        >
          Share via SMS
        </Button>

        <Button
          variant="secondary"
          onClick={handleCopy}
          leftIcon={copied ? <Check className="w-4 h-4 text-status-success" /> : <Copy className="w-4 h-4" />}
          className="w-full justify-center"
        >
          {copied ? 'Copied to Clipboard!' : 'Copy Invitation'}
        </Button>
      </div>

      {/* Native Share button if supported */}
      {typeof navigator !== 'undefined' && 'share' in navigator && (
        <div className="pt-2 text-center">
          <Button
            variant="ghost"
            onClick={handleNativeShare}
            leftIcon={<Share2 className="w-4 h-4" />}
            className="text-xs text-ink-secondary"
          >
            Open System Share Sheet
          </Button>
        </div>
      )}
    </div>
  );
};
