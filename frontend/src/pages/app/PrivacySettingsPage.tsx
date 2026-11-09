import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { errorMessage } from '../../utils/formErrors';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  Download,
  Trash2,
  Clock,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { consentService, profileService } from '../../services';
import type { UserConsentPreferences } from '../../types/consent';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { formatDate } from '../../constants/countries';

export const PrivacySettingsPage: React.FC = () => {
  const [preferences, setPreferences] = useState<UserConsentPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Deletion modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteResultNotice, setDeleteResultNotice] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const loadPreferences = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await consentService.getConsentPreferences();
      setPreferences(data);
    } catch (err: unknown) {
      setErrorMsg((err as { message?: string })?.message || 'Failed to retrieve privacy preferences.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreferences();
  }, []);

  const handleToggleContactSharing = async () => {
    if (!preferences) return;
    setUpdating(true);
    setStatusMessage(null);
    try {
      const newStatus = !preferences.contactSharingAllowed;
      const updated = await consentService.updateConsent({
        contactSharingAllowed: newStatus,
      });
      setPreferences(updated);
      setStatusMessage(
        newStatus
          ? 'Contact sharing consent granted. Emergency coordinators may view your phone.'
          : 'Contact sharing consent withdrawn. Your phone number is now masked.'
      );
    } catch {
      setErrorMsg('Failed to update consent preferences.');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleEmergencyBroadcast = async () => {
    if (!preferences) return;
    setUpdating(true);
    try {
      const updated = await consentService.updateConsent({
        emergencyBroadcastAllowed: !preferences.emergencyBroadcastAllowed,
      });
      setPreferences(updated);
      setStatusMessage('Emergency broadcast alert preference updated.');
    } catch {
      setErrorMsg('Failed to update communication preference.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDataExport = async () => {
    setErrorMsg(null);
    try {
      const result = await profileService.requestDataExport();
      if (result.data) {
        // Save the archive as a JSON file on this device
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bloodbridge-my-data-${result.generatedAt.slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setStatusMessage('Your data file was downloaded. Keep it private: it contains your contact details.');
      } else {
        setStatusMessage(`Data export prepared at ${new Date(result.generatedAt).toLocaleTimeString()}.`);
      }
    } catch (e) {
      setErrorMsg(errorMessage(e, 'Data export failed.'));
    }
  };

  const handleDeleteRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirm.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Type DELETE to confirm.');
      return;
    }
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      const res = await profileService.requestAccountDeletion(deleteReason, 'DELETE');
      setDeleteResultNotice(res.message);
      // The account no longer exists: sign out and go to the home page
      setTimeout(async () => {
        await logout().catch(() => undefined);
        navigate('/', { replace: true });
      }, 3000);
    } catch (err) {
      setDeleteError(errorMessage(err, 'Could not delete your account. Please try again.'));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-main tracking-tight">
          Privacy &amp; Consent Management
        </h1>
        <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">
          Take full control over contact disclosures, medical permissions, and personal data rights.
        </p>
      </div>

      {errorMsg && <ErrorBanner message={errorMsg} onRetry={loadPreferences} />}

      {statusMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-status-success font-semibold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs text-ink-secondary hover:text-ink-main ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <Card className="p-6 space-y-4">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </Card>
      ) : preferences ? (
        <div className="space-y-6">
          {/* Main Consent Toggles */}
          <Card className="shadow-sm">
            <CardHeader>
              <div>
                <h2 className="text-base font-bold text-ink-main">Active Consent Preferences</h2>
                <p className="text-xs text-ink-secondary">
                  Under Policy Version {preferences.activePolicyVersion || 'v2.4-2026'} &bull; Last updated:{' '}
                  {formatDate(preferences.lastUpdated || Date.now())}
                </p>
              </div>
            </CardHeader>

            <CardContent className="p-6 divide-y divide-line-border">
              {/* Toggle 1: Contact Sharing */}
              <div className="py-4 first:pt-0 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    {preferences.contactSharingAllowed ? (
                      <Eye className="w-4 h-4 text-status-success" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-status-error" />
                    )}
                    <span className="font-bold text-sm text-ink-main">
                      Emergency Contact Number Sharing
                    </span>
                  </div>
                  <p className="text-xs text-ink-secondary leading-relaxed max-w-xl">
                    When enabled, authorized hospital emergency dispatchers can see your phone number during active blood shortage matches in your locality.
                  </p>
                </div>

                <Button
                  variant={preferences.contactSharingAllowed ? 'danger' : 'primary'}
                  size="sm"
                  onClick={handleToggleContactSharing}
                  isLoading={updating}
                  className="flex-shrink-0 min-w-[120px]"
                >
                  {preferences.contactSharingAllowed ? 'Revoke Consent' : 'Grant Consent'}
                </Button>
              </div>

              {/* Toggle 2: Emergency Broadcasts */}
              <div className="py-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="font-bold text-sm text-ink-main block">
                    Trauma Shortage Push &amp; SMS Broadcasts
                  </span>
                  <p className="text-xs text-ink-secondary leading-relaxed max-w-xl">
                    Receive high-priority automated alerts when local ICUs declare a critical shortfall of your specific blood type.
                  </p>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleToggleEmergencyBroadcast}
                  isLoading={updating}
                  className="flex-shrink-0 min-w-[120px]"
                >
                  {preferences.emergencyBroadcastAllowed ? 'Disable Alerts' : 'Enable Alerts'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Consent History Audit Log */}
          <Card>
            <CardHeader>
              <div>
                <h3 className="text-base font-bold text-ink-main">Consent Audit History</h3>
                <p className="text-xs text-ink-secondary">
                  Audited record of all authorization changes, grant times, and IP hashes
                </p>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="divide-y divide-line-border text-xs">
                {(preferences.history && preferences.history.length > 0) ? (
                  preferences.history.map((item) => (
                    <div key={item.id} className="p-4 flex items-start justify-between gap-3 hover:bg-gray-50/60">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`font-bold capitalize px-2 py-0.5 rounded text-[10px] ${
                              item.action === 'granted'
                                ? 'bg-emerald-50 text-status-success'
                                : item.action === 'withdrawn'
                                ? 'bg-red-50 text-status-error'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {item.action}
                          </span>
                          <span className="font-mono text-ink-muted">
                            Policy {item.policyVersion}
                          </span>
                        </div>
                        <p className="text-ink-main font-medium">{item.purpose}</p>
                      </div>

                      <div className="text-right text-ink-secondary flex-shrink-0">
                        <div className="flex items-center justify-end space-x-1">
                          <Clock className="w-3 h-3 text-ink-muted" />
                          <span>{formatDate(item.timestamp)}</span>
                        </div>
                        <span className="text-[10px] text-ink-muted block mt-0.5">
                          {item.ipAddressMasked}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-ink-secondary">
                    No explicit modifications recorded yet. All permissions are secured under Policy {preferences.activePolicyVersion || 'v2.4-2026'}.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Data Rights & Erasure */}
          <Card className="border-line-border">
            <CardHeader>
              <h3 className="text-base font-bold text-ink-main">Data Portability &amp; Erasure Rights</h3>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-line-border">
                <div>
                  <span className="font-bold text-sm text-ink-main block">Export My Data Archive</span>
                  <p className="text-xs text-ink-secondary mt-0.5">
                    Download a file with everything you’ve given us: account, donor profile, consents, family, requests and payments.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDataExport}
                  leftIcon={<Download className="w-4 h-4" />}
                  className="flex-shrink-0"
                >
                  Download Data
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-red-50/50 rounded-xl border border-red-200">
                <div>
                  <span className="font-bold text-sm text-status-error block">Delete My Account</span>
                  <p className="text-xs text-ink-secondary mt-0.5">
                    Permanently deletes your account, donor profile, family list, requests and alerts. This can’t be undone.
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowDeleteModal(true)}
                  leftIcon={<Trash2 className="w-4 h-4" />}
                  className="flex-shrink-0"
                >
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Account Deletion Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete your account?"
        description="This permanently deletes your account and data. It can’t be undone."
      >
        {deleteResultNotice ? (
          <div className="text-center py-6 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-status-success mx-auto" />
            <h3 className="font-bold text-ink-main">Account deleted</h3>
            <p className="text-xs text-ink-secondary">{deleteResultNotice}</p>
          </div>
        ) : (
          <form onSubmit={handleDeleteRequest} className="space-y-4">
            <ul className="text-xs text-ink-secondary leading-relaxed list-disc pl-4 space-y-1">
              <li>Your account, donor profile, family list, pledges, requests and alerts are deleted.</li>
              <li>Open blood requests are cancelled, and donors who accepted are told not to go.</li>
              <li>Automatic renewal of your subscription is turned off. Paid time is not refunded automatically.</li>
              <li>Your email and mobile number can be used to sign up again.</li>
              <li>Tip: download your data first if you want a copy.</li>
            </ul>

            <label className="block text-xs font-semibold text-ink-secondary">Why are you leaving? (optional)</label>
            <textarea
              rows={2}
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="e.g., Medical deferral, relocation, or privacy preference."
              className="w-full text-xs p-3 rounded-lg border border-line-border focus:ring-2 focus:ring-status-error focus:outline-none"
            />

            <label className="block text-xs font-semibold text-ink-secondary" htmlFor="delete-confirm">
              Type <strong className="text-status-error">DELETE</strong> to confirm
            </label>
            <input
              id="delete-confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              autoComplete="off"
              className="w-full text-sm p-2.5 rounded-lg border border-line-border focus:ring-2 focus:ring-status-error focus:outline-none"
            />
            {deleteError && <p className="text-xs text-status-error" role="alert">{deleteError}</p>}

            <div className="flex justify-end space-x-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="danger" size="sm" isLoading={deleteSubmitting}>
                Delete permanently
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
