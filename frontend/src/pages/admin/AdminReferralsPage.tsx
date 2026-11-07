import React, { useState, useEffect } from 'react';
import {
  Search,
  Share2,
  Power,
  Users,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { adminService } from '../../services';
import type { AdminReferralItem } from '../../types/admin';
import { useDebounce } from '../../hooks/useDebounce';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../constants/countries';
import { CountryFilter } from '../../components/forms/CountryFilter';

export const AdminReferralsPage: React.FC = () => {
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [referrals, setReferrals] = useState<AdminReferralItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Toggle state dialog
  const [selectedReferral, setSelectedReferral] = useState<AdminReferralItem | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  const fetchReferrals = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await adminService.listReferrals({
        search: debouncedSearch,
        country: countryFilter,
        page,
        pageSize,
      });
      setReferrals(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: unknown) {
      setErrorMsg((err as { message?: string })?.message || 'Failed to retrieve referral records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferrals();
  }, [debouncedSearch, countryFilter, page]);

  const handleToggleConfirm = async () => {
    if (!selectedReferral) return;
    setToggleLoading(true);
    try {
      const updated = await adminService.toggleReferralCode(
        selectedReferral.id,
        !selectedReferral.isActive
      );
      setReferrals((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setSelectedReferral(null);
    } catch {
      setErrorMsg('Failed to update referral code permission.');
    } finally {
      setToggleLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <CountryFilter
          value={countryFilter}
          onChange={(c) => {
            setCountryFilter(c);
            setPage(1);
          }}
        />
      </div>
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-ink-main tracking-tight">
          Savior Referral Network Control
        </h2>
        <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">
          Monitor invite conversion metrics, audit code owners, and suspend malicious referral links.
        </p>
      </div>

      <Card className="p-4 shadow-sm">
        <Input
          placeholder="Search by referral code or owner name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          leftIcon={<Search className="w-4 h-4" />}
        />
      </Card>

      {errorMsg && <ErrorBanner message={errorMsg} onRetry={fetchReferrals} />}

      <Card className="overflow-hidden shadow-sm">
        {loading ? (
          <TableSkeleton rows={5} />
        ) : referrals.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-secondary">
            No referral records found matching your query.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-line-border text-[11px] font-bold uppercase tracking-wider text-ink-secondary">
                    <th className="py-3 px-5">Referral Code</th>
                    <th className="py-3 px-4">Owner Profile</th>
                    <th className="py-3 px-4">Total Shared</th>
                    <th className="py-3 px-4">Registrations</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Moderation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-border text-sm">
                  {referrals.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-5">
                        <span className="font-mono font-bold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-md text-xs">
                          {r.code}
                        </span>
                        <div className="text-[11px] text-ink-secondary mt-1">
                          Created {formatDate(r.createdAt)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-bold text-ink-main">{r.ownerName}</div>
                        <div className="font-mono text-ink-secondary">{r.ownerPhone}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-ink-main">
                        {r.totalInvites} links
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <span className="font-bold text-status-success">{r.successfulRegistrations}</span>
                        <span className="text-ink-secondary"> saviors</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            r.isActive
                              ? 'bg-emerald-50 text-status-success'
                              : 'bg-red-50 text-status-error'
                          }`}
                        >
                          {r.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant={r.isActive ? 'danger' : 'secondary'}
                          size="sm"
                          onClick={() => setSelectedReferral(r)}
                          leftIcon={<Power className="w-3.5 h-3.5" />}
                        >
                          {r.isActive ? 'Pause' : 'Enable'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={pageSize}
              onPageChange={(p) => setPage(p)}
            />
          </>
        )}
      </Card>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(selectedReferral)}
        onClose={() => setSelectedReferral(null)}
        onConfirm={handleToggleConfirm}
        title={selectedReferral?.isActive ? 'Pause Referral Code' : 'Reactivate Referral Code'}
        message={
          selectedReferral?.isActive
            ? `Are you sure you want to pause referral code ${selectedReferral?.code}? New registrations using this link will be rejected until re-enabled.`
            : `Are you sure you want to re-enable referral code ${selectedReferral?.code}?`
        }
        confirmText={selectedReferral?.isActive ? 'Pause Code' : 'Enable Code'}
        isDestructive={selectedReferral?.isActive}
        isLoading={toggleLoading}
      />
    </div>
  );
};
