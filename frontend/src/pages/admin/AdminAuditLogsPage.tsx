import React, { useState, useEffect } from 'react';
import {
  ScrollText,
  Filter,
  Shield,
  Clock,
  User,
  Activity,
  Layers,
} from 'lucide-react';
import { adminService } from '../../services';
import type { AuditLogEntry } from '../../types/admin';
import { Card, CardContent } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Pagination } from '../../components/ui/Pagination';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../constants/countries';

export const AdminAuditLogsPage: React.FC = () => {
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await adminService.listAuditLogs({
        entityType: entityFilter === 'ALL' ? undefined : entityFilter,
        page,
        pageSize,
      });
      setLogs(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: unknown) {
      setErrorMsg((err as { message?: string })?.message || 'Failed to retrieve system audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [entityFilter, page]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-ink-main tracking-tight">
          Immutable System Audit Trail
        </h2>
        <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">
          Tamper-evident operational logs for security oversight, medical updates, and consent changes.
        </p>
      </div>

      <Card className="p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-64">
          <Select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'All Event Categories' },
              { value: 'donor', label: 'Donor Records' },
              { value: 'consent', label: 'Consent Changes' },
              { value: 'referral', label: 'Referral Actions' },
              { value: 'user', label: 'User Accounts' },
              { value: 'system', label: 'System Configuration' },
            ]}
          />
        </div>

        <div className="text-xs text-ink-secondary">
          Displaying {total} cryptographic audit records
        </div>
      </Card>

      {errorMsg && <ErrorBanner message={errorMsg} onRetry={fetchLogs} />}

      <Card className="overflow-hidden shadow-sm">
        {loading ? (
          <TableSkeleton rows={5} />
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-secondary">
            No audit events found for selected category.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-line-border text-[11px] font-bold uppercase tracking-wider text-ink-secondary">
                    <th className="py-3 px-5">Timestamp</th>
                    <th className="py-3 px-4">Operator / Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Target Entity</th>
                    <th className="py-3 px-4">Audit Details</th>
                    <th className="py-3 px-4 text-right">IP Mask</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-border text-sm">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-5 text-xs text-ink-secondary whitespace-nowrap">
                        <div className="font-semibold text-ink-main">
                          {formatDate(log.timestamp)}
                        </div>
                        <div className="text-[10px] text-ink-muted">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-bold text-ink-main">{log.actorName}</div>
                        <div className="text-[10px] text-brand-600 font-semibold">{log.actorRole}</div>
                      </td>

                      <td className="py-3.5 px-4 text-xs font-mono font-bold text-slate-800">
                        {log.action}
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        <span className="font-semibold uppercase text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                          {log.entityType}: {log.entityId}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-ink-secondary max-w-xs truncate">
                        {log.details}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-xs text-ink-muted">
                        {log.ipAddress}
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
