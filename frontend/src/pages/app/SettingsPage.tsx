import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Settings,
  Bell,
  Moon,
  Shield,
  Smartphone,
  LogOut,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';

export const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [emailDigest, setEmailDigest] = useState(true);
  const [referralNotifications, setReferralNotifications] = useState(true);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSavePreferences = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false);
    await logout();
    navigate('/auth/login');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-main tracking-tight">
          Account Settings
        </h1>
        <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">
          Notification channels, application preferences, and session controls
        </p>
      </div>

      {savedNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-status-success font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Settings saved successfully.</span>
        </div>
      )}

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Bell className="w-4 h-4 text-brand-500" />
            <h2 className="text-sm font-bold text-ink-main">Notification Channels</h2>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          <Checkbox
            label="Urgent SMS Text Dispatches"
            description="Receive immediate text messages when your blood group is needed within 15 miles."
            checked={smsAlerts}
            onChange={(e) => setSmsAlerts(e.target.checked)}
          />

          <Checkbox
            label="Savior Circle Referral Activity"
            description="Get notified whenever someone registers or gets verified using your referral link."
            checked={referralNotifications}
            onChange={(e) => setReferralNotifications(e.target.checked)}
          />

          <Checkbox
            label="Monthly Donation Eligibility Reminders"
            description="Receive email notices when your 56-day standard donation rest window is complete."
            checked={emailDigest}
            onChange={(e) => setEmailDigest(e.target.checked)}
          />

          <div className="pt-2">
            <Button variant="primary" size="sm" onClick={handleSavePreferences}>
              Save Communication Preferences
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Linked Settings */}
      <Card>
        <CardContent className="p-0 divide-y divide-line-border text-sm">
          <Link
            to="/app/settings/privacy"
            className="flex items-center justify-between p-4 hover:bg-gray-50 min-h-[44px]"
          >
            <div className="flex items-center space-x-3">
              <Shield className="w-4 h-4 text-brand-500" />
              <div>
                <span className="font-semibold text-ink-main block">Contact Disclosure &amp; Consent</span>
                <span className="text-xs text-ink-secondary">Manage phone visibility and audit trail</span>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-ink-muted" />
          </Link>

          <Link
            to="/app/profile/edit"
            className="flex items-center justify-between p-4 hover:bg-gray-50 min-h-[44px]"
          >
            <div className="flex items-center space-x-3">
              <Smartphone className="w-4 h-4 text-brand-500" />
              <div>
                <span className="font-semibold text-ink-main block">Change Phone Number or Email</span>
                <span className="text-xs text-ink-secondary">Update your registered dispatch contact</span>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-ink-muted" />
          </Link>
        </CardContent>
      </Card>

      {/* Danger Zone: Log Out */}
      <Card className="border-red-200">
        <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="font-bold text-sm text-status-error block">Sign Out of BloodBridge</span>
            <p className="text-xs text-ink-secondary mt-0.5">
              Clear your active session token from this browser device.
            </p>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowLogoutConfirm(true)}
            leftIcon={<LogOut className="w-4 h-4" />}
            className="flex-shrink-0"
          >
            Log Out
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleConfirmLogout}
        title="Confirm Log Out"
        message="Are you sure you want to log out of your BloodBridge account?"
        confirmText="Log Out"
        isDestructive
      />
    </div>
  );
};
