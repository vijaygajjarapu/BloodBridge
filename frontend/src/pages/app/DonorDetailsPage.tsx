import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Heart,
  Activity,
  Flag,
  CheckCircle2,
} from 'lucide-react';
import { donorService } from '../../services';
import type { DonorDetails } from '../../types/donor';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BloodGroupBadge, StatusBadge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { formatDate, countryOrDefault } from '../../constants/countries';

export const DonorDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [donor, setDonor] = useState<DonorDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Report Modal state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccessNotice, setReportSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadDonor = async () => {
      if (!id) return;
      setLoading(true);
      setErrorMsg(null);
      try {
        const data = await donorService.getDonorById(id);
        if (isMounted) setDonor(data);
      } catch (err: unknown) {
        if (isMounted) {
          setErrorMsg((err as { message?: string })?.message || 'Donor record not found.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDonor();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !reportReason.trim()) return;
    setReportSubmitting(true);
    try {
      const res = await donorService.reportIncorrectInfo(id, reportReason);
      setReportSuccessNotice(res.message);
      setTimeout(() => {
        setIsReportModalOpen(false);
        setReportSuccessNotice(null);
        setReportReason('');
      }, 2000);
    } catch {
      setErrorMsg('Failed to submit report. Please try again.');
    } finally {
      setReportSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-6 w-32" />
        <Card className="p-8 space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </Card>
      </div>
    );
  }

  if (errorMsg || !donor) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <Card className="p-8 space-y-4">
          <AlertTriangle className="w-12 h-12 text-status-error mx-auto" />
          <h2 className="text-xl font-bold text-ink-main">Donor Record Unavailable</h2>
          <p className="text-xs sm:text-sm text-ink-secondary">{errorMsg || 'Unable to locate donor details.'}</p>
          <Link to="/app/donors">
            <Button variant="primary">Return to Donor Directory</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/app/donors')}
          className="text-xs font-semibold text-ink-secondary hover:text-brand-500 inline-flex items-center min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Donors List
        </button>

        <button
          type="button"
          onClick={() => setIsReportModalOpen(true)}
          className="text-xs text-ink-secondary hover:text-status-error font-medium inline-flex items-center min-h-[44px] px-2"
        >
          <Flag className="w-3.5 h-3.5 mr-1" />
          Report Inaccurate Info
        </button>
      </div>

      <Card className="shadow-lg border-line-border overflow-hidden">
        {/* Profile Card Header */}
        <div className="p-6 bg-gradient-to-r from-brand-500 to-brand-600 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center font-bold text-2xl shadow-inner">
              <Heart className="w-8 h-8 fill-current text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{donor.name}</h1>
                <StatusBadge status={donor.status} />
              </div>
              <p className="text-xs text-white/80 mt-0.5">
                Referred by code: <span className="font-mono font-bold">{donor.referredByCode || 'DIRECT'}</span>
              </p>
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-white/20">
            <span className="text-[11px] text-white/80 block mb-1">Blood Group</span>
            <BloodGroupBadge group={donor.bloodGroup} size="md" />
          </div>
        </div>

        <CardContent className="p-6 sm:p-8 space-y-8">
          {/* Critical Contact Section (Consent-Enforced Privacy Boundary) */}
          <div className="p-5 rounded-xl border border-line-border bg-gray-50/80 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-secondary">
              Emergency Direct Contact
            </h2>

            {donor.canAccessContact && donor.contactNumber ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-emerald-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-status-success flex items-center justify-center">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs text-ink-secondary block">Verified Mobile Phone</span>
                      <a
                        href={`tel:${donor.contactNumber}`}
                        className="text-base font-mono font-bold text-ink-main hover:text-brand-500 underline"
                      >
                        {donor.contactNumber}
                      </a>
                    </div>
                  </div>

                  <a href={`tel:${donor.contactNumber}`}>
                    <Button variant="primary" size="sm" leftIcon={<Phone className="w-3.5 h-3.5" />}>
                      Call Emergency Dispatch
                    </Button>
                  </a>
                </div>

                <div className="flex items-center space-x-2 text-xs text-status-success font-medium">
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    Donor granted active consent to share direct contact with savior circle members.
                  </span>
                </div>
              </div>
            ) : (
              /* Contact Unavailable State */
              <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-lg space-y-2">
                <div className="flex items-center space-x-2 text-status-warning font-bold text-xs">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Contact Number Masked by Donor Privacy Settings</span>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  {donor.contactUnavailableReason ||
                    'This donor has restricted general phone visibility. Contact is dispatched automatically only when local trauma coordinators broadcast an active emergency.'}
                </p>
              </div>
            )}
          </div>

          {/* Core Profile Attributes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="p-4 bg-white rounded-xl border border-line-border flex items-start space-x-3">
              <MapPin className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-xs font-semibold text-ink-secondary block">Permitted Location</span>
                <span className="font-bold text-ink-main block">
                  {[donor.location?.city, donor.location?.district].filter(Boolean).join(', ') || 'Location not shared'}
                </span>
                <span className="text-xs text-ink-secondary">
                  {[donor.location?.state, donor.location?.postalCode, countryOrDefault(donor.location?.country).name]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-line-border flex items-start space-x-3">
              <Calendar className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-xs font-semibold text-ink-secondary block">Registration Date</span>
                <span className="font-bold text-ink-main block">
                  {formatDate(donor.registeredAt || (donor as any).createdAt || Date.now())}
                </span>
                <span className="text-xs text-ink-secondary">
                  Last donated: {donor.lastDonatedAt || (donor as any).lastDonationDate ? formatDate(donor.lastDonatedAt || (donor as any).lastDonationDate) : 'None recorded'}
                </span>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-line-border flex items-start space-x-3">
              <Activity className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-xs font-semibold text-ink-secondary block">Donation Willingness</span>
                <span className="font-bold text-ink-main capitalize block">
                  {(donor.willingness || (donor as any).donationWillingness || 'regular').replace('_', ' ')}
                </span>
                <span className="text-xs text-ink-secondary">
                  {donor.isEligibleNow ? 'Eligible for donation today' : 'In standard rest period'}
                </span>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-line-border flex items-start space-x-3">
              <Heart className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-xs font-semibold text-ink-secondary block">Total Community Donations</span>
                <span className="font-bold text-ink-main block text-lg">
                  {donor.totalDonationsCount} Donations
                </span>
                <span className="text-xs text-ink-secondary">Estimated 18+ lives touched</span>
              </div>
            </div>
          </div>

          {donor.notes && (
            <div className="p-4 bg-gray-50 rounded-xl border border-line-border text-xs text-ink-secondary space-y-1">
              <span className="font-bold text-ink-main block">Coordinator Medical Notes:</span>
              <p>{donor.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Modal */}
      <Modal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title="Report Incorrect Donor Information"
        description="Help maintain data accuracy across our life-critical network."
      >
        {reportSuccessNotice ? (
          <div className="text-center py-6 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-status-success mx-auto" />
            <h3 className="font-bold text-ink-main">Report Submitted</h3>
            <p className="text-xs text-ink-secondary">{reportSuccessNotice}</p>
          </div>
        ) : (
          <form onSubmit={handleReportSubmit} className="space-y-4">
            <div className="text-xs text-ink-secondary">
              Reporting record for <strong className="text-ink-main">{donor.name}</strong> ({donor.bloodGroup}).
            </div>

            <div>
              <label htmlFor="reason" className="block text-xs font-semibold text-ink-main mb-1">
                Reason for Correction:
              </label>
              <textarea
                id="reason"
                rows={4}
                required
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="e.g. Phone number disconnected, donor moved to another district, or incorrect blood type stated."
                className="w-full text-xs p-3 rounded-lg border border-line-border focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsReportModalOpen(false)}
                disabled={reportSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={reportSubmitting}>
                Submit Correction Notice
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
