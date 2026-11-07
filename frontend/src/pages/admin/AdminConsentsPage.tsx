import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  ShieldCheck,
  ShieldAlert,
  Search,
  Clock,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { consentService } from '../../services';
import type { ConsentRecord } from '../../types/consent';
import { Card, CardContent } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Pagination } from '../../components/ui/Pagination';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { formatDate, getDefaultCountry } from '../../constants/countries';
import { CountryFilter } from '../../components/forms/CountryFilter';

export const AdminConsentsPage: React.FC = () => {
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchConsents = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await consentService.listConsentsAdmin({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        country: countryFilter,
        page,
        pageSize,
      });
      setRecords(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: unknown) {
      setErrorMsg((err as { message?: string })?.message || 'Failed to retrieve consent audit registry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsents();
  }, [statusFilter, countryFilter, page]);

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
          Consent Registry &amp; Compliance Audit
        </h2>
        <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">
          Audited record of donor contact disclosure permissions, policy versions, and withdrawal reasons.
        </p>
      </div>

      <Card className="p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-64">
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'All Consent Statuses' },
              { value: 'granted', label: 'Authorized / Granted' },
              { value: 'withdrawn', label: 'Revoked / Withdrawn' },
            ]}
          />
        </div>

        <div className="text-xs text-ink-secondary flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-status-success" />
          <span>Active Charter: Policy v2.4-2026 (written to follow India&apos;s {getDefaultCountry().privacyLaw})</span>
        </div>
      </Card>

      {errorMsg && <ErrorBanner message={errorMsg} onRetry={fetchConsents} />}

      <Card className="overflow-hidden shadow-sm">
        {loading ? (
          <TableSkeleton rows={5} />
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-secondary">
            No consent logs found matching current filter.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-line-border text-[11px] font-bold uppercase tracking-wider text-ink-secondary">
                    <th className="py-3 px-5">Donor Profile</th>
                    <th className="py-3 px-4">Contact Masking</th>
                    <th className="py-3 px-4">Consent Status</th>
                    <th className="py-3 px-4">Policy Version</th>
                    <th className="py-3 px-4">Granted At</th>
                    <th className="py-3 px-4">Withdrawal Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-border text-sm">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-ink-main">{r.userName}</div>
                        <div className="text-[11px] text-ink-secondary font-mono">ID: {r.userId}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-ink-secondary">
                        {r.phoneMasked}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center ${
                            r.status === 'granted'
                              ? 'bg-emerald-50 text-status-success'
                              : 'bg-red-50 text-status-error'
                          }`}
                        >
                          {r.status === 'granted' ? (
                            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                          ) : (
                            <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                          )}
                          {r.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono font-medium text-ink-secondary">
                        {r.policyVersion}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-ink-secondary">
                        {formatDate(r.grantedAt)}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-ink-secondary">
                        {r.status === 'withdrawn' ? (
                          <div>
                            <span className="font-semibold text-status-error block">
                              Withdrawn {r.withdrawnAt ? formatDate(r.withdrawnAt) : ''}
                            </span>
                            <span className="text-[11px] text-ink-muted">
                              {r.withdrawalReason || 'Donor revoked contact sharing'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-ink-muted">Active authorization</span>
                        )}
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
    </div>
  );
};
