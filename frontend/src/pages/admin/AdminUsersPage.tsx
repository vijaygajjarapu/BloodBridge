import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  UserCheck,
  UserX,
  Shield,
  Eye,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { adminService } from '../../services';
import type { AdminUser } from '../../types/admin';
import { useDebounce } from '../../hooks/useDebounce';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../constants/countries';
import { CountryFilter } from '../../components/forms/CountryFilter';

export const AdminUsersPage: React.FC = () => {
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Status toggle confirmation modal
  const [statusActionUser, setStatusActionUser] = useState<AdminUser | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'activate'>('suspend');
  const [statusLoading, setStatusLoading] = useState(false);

  // User detail modal
  const [viewUser, setViewUser] = useState<AdminUser | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await adminService.listUsers({
        search: debouncedSearch,
        status: statusFilter,
        country: countryFilter,
        page,
        pageSize,
      });
      setUsers(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: unknown) {
      setErrorMsg((err as { message?: string })?.message || 'Failed to retrieve user accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [debouncedSearch, statusFilter, countryFilter, page]);

  const handleStatusChangeConfirm = async () => {
    if (!statusActionUser) return;
    setStatusLoading(true);
    try {
      const nextStatus = actionType === 'suspend' ? 'suspended' : 'active';
      const updated = await adminService.updateUserStatus(statusActionUser.id, nextStatus);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setStatusActionUser(null);
    } catch (err) {
      console.error(err);
    } finally {
      setStatusLoading(false);
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
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-ink-main tracking-tight">
          User Account Directory
        </h2>
        <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">
          View registered community members, monitor savior referral counts, and manage suspensions.
        </p>
      </div>

      {/* Filter and Search */}
      <Card className="p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-8">
            <Input
              placeholder="Search user by name, phone number, email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="sm:col-span-4">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'All Account Statuses' },
                { value: 'active', label: 'Active Members' },
                { value: 'suspended', label: 'Suspended Accounts' },
                { value: 'pending', label: 'Pending Verification' },
              ]}
            />
          </div>
        </div>
      </Card>

      {errorMsg && <ErrorBanner message={errorMsg} onRetry={fetchUsers} />}

      {/* Table & Cards */}
      <Card className="overflow-hidden shadow-sm">
        {loading ? (
          <TableSkeleton rows={5} />
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-secondary">
            No user accounts found matching your query.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-line-border text-[11px] font-bold uppercase tracking-wider text-ink-secondary">
                    <th className="py-3 px-5">User Profile</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Referral Code</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-border text-sm">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-ink-main">{u.name}</div>
                        <div className="text-xs text-ink-secondary">
                          Joined {formatDate(u.createdAt)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono">
                        <div>{u.phone}</div>
                        <div className="text-[11px] text-ink-secondary">{u.email || 'No email'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <span
                          className={`font-semibold capitalize px-2 py-0.5 rounded text-[10px] ${
                            u.role === 'admin'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-gray-100 text-ink-main'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono font-bold text-brand-600">
                        {u.referralCode} ({u.referralCount} joined)
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            u.status === 'active'
                              ? 'bg-emerald-50 text-status-success'
                              : u.status === 'suspended'
                              ? 'bg-red-50 text-status-error'
                              : 'bg-amber-50 text-status-warning'
                          }`}
                        >
                          {u.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1">
                        <button
                          type="button"
                          onClick={() => setViewUser(u)}
                          aria-label={`View user ${u.name}`}
                          className="text-xs font-semibold text-ink-secondary hover:text-ink-main p-1.5 rounded hover:bg-gray-200 min-h-[36px] min-w-[36px] inline-flex items-center justify-center"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {u.role !== 'admin' && (
                          <button
                            type="button"
                            onClick={() => {
                              setStatusActionUser(u);
                              setActionType(u.status === 'active' ? 'suspend' : 'activate');
                            }}
                            className={`text-xs font-semibold px-2 py-1 rounded min-h-[36px] ${
                              u.status === 'active'
                                ? 'text-status-error hover:bg-red-50'
                                : 'text-status-success hover:bg-emerald-50'
                            }`}
                          >
                            {u.status === 'active' ? 'Suspend' : 'Activate'}
                          </button>
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

      {/* User Details View Modal */}
      {viewUser && (
        <Modal
          isOpen={Boolean(viewUser)}
          onClose={() => setViewUser(null)}
          title={`User Details: ${viewUser.name}`}
          description={`Identifier: ${viewUser.id}`}
        >
          <div className="space-y-4 text-sm">
            <div className="bg-gray-50 p-4 rounded-xl space-y-2 border border-line-border text-xs">
              <div className="flex justify-between">
                <span className="text-ink-secondary">Mobile Phone:</span>
                <span className="font-mono font-bold text-ink-main">{viewUser.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-secondary">Registered Email:</span>
                <span className="text-ink-main">{viewUser.email || 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-secondary">Referral Code:</span>
                <span className="font-mono font-bold text-brand-600">{viewUser.referralCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-secondary">Referral Intakes:</span>
                <span className="font-bold text-ink-main">{viewUser.referralCount} Donors</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-secondary">Account Status:</span>
                <span className="font-bold uppercase text-brand-700">{viewUser.status}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={() => setViewUser(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Status Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(statusActionUser)}
        onClose={() => setStatusActionUser(null)}
        onConfirm={handleStatusChangeConfirm}
        title={actionType === 'suspend' ? 'Suspend User Account' : 'Reactivate User Account'}
        message={
          actionType === 'suspend'
            ? `Are you sure you want to suspend ${statusActionUser?.name}? Their referral links will be paused and matching alerts disabled.`
            : `Are you sure you want to reactivate ${statusActionUser?.name}?`
        }
        confirmText={actionType === 'suspend' ? 'Suspend Account' : 'Reactivate'}
        isDestructive={actionType === 'suspend'}
        isLoading={statusLoading}
      />
    </div>
  );
};
