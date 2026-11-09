import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  HeartHandshake,
  Edit2,
  Eye,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  Save,
} from 'lucide-react';
import { adminService } from '../../services';
import type { AdminDonor } from '../../types/admin';
import type { BloodGroup, DonorStatus } from '../../types/donor';
import { useDebounce } from '../../hooks/useDebounce';
import { BLOOD_GROUPS } from '../../constants/bloodGroups';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { BloodGroupBadge, StatusBadge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { CountryFilter } from '../../components/forms/CountryFilter';

export const AdminDonorsPage: React.FC = () => {
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [donors, setDonors] = useState<AdminDonor[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edit / Correction Modal
  const [editingDonor, setEditingDonor] = useState<AdminDonor | null>(null);
  const [editName, setEditName] = useState('');
  const [editBloodGroup, setEditBloodGroup] = useState<BloodGroup>('O+');
  const [editStatus, setEditStatus] = useState<DonorStatus>('active');
  const [editNotes, setEditNotes] = useState('');
  const [editVerified, setEditVerified] = useState(false);
  const [editVerifySource, setEditVerifySource] = useState('blood bank card');
  const [savingCorrection, setSavingCorrection] = useState(false);

  const fetchDonors = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await adminService.listDonors({
        search: debouncedSearch,
        bloodGroup: selectedBloodGroup === 'ALL' ? undefined : (selectedBloodGroup as BloodGroup),
        status: selectedStatus === 'ALL' ? undefined : (selectedStatus as DonorStatus),
        country: countryFilter,
        page,
        pageSize,
      });
      setDonors(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: unknown) {
      setErrorMsg((err as { message?: string })?.message || 'Failed to fetch donor records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonors();
  }, [debouncedSearch, selectedBloodGroup, selectedStatus, countryFilter, page]);

  const handleOpenEdit = (donor: AdminDonor) => {
    setEditingDonor(donor);
    setEditName(donor.name);
    setEditBloodGroup(donor.bloodGroup);
    setEditStatus(donor.status);
    setEditNotes(donor.notes || '');
    setEditVerified(Boolean(donor.bloodGroupVerified));
    setEditVerifySource(donor.bloodGroupVerifySource || 'blood bank card');
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDonor) return;
    setSavingCorrection(true);
    try {
      const updated = await adminService.updateDonorRecord(editingDonor.id, {
        name: editName,
        bloodGroup: editBloodGroup,
        status: editStatus,
        notes: editNotes,
        // Only send a change, so re-saving doesn't reset the verification date
        ...(editVerified !== Boolean(editingDonor.bloodGroupVerified) || (editVerified && editBloodGroup !== editingDonor.bloodGroup)
          ? { bloodGroupVerified: editVerified, bloodGroupVerifySource: editVerifySource }
          : {}),
      });

      setDonors((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setEditingDonor(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingCorrection(false);
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
          Donor Registry &amp; Medical Moderation
        </h2>
        <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">
          Verify antigen classifications, inspect consent authorizations, and apply administrative corrections.
        </p>
      </div>

      {/* Filter and Search */}
      <Card className="p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-6">
            <Input
              placeholder="Search donor name, city, district..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="sm:col-span-3">
            <Select
              value={selectedBloodGroup}
              onChange={(e) => {
                setSelectedBloodGroup(e.target.value);
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'All Blood Groups' },
                ...BLOOD_GROUPS.map((g) => ({ value: g.value, label: g.label })),
              ]}
            />
          </div>

          <div className="sm:col-span-3">
            <Select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'active', label: 'Active' },
                { value: 'cooling_off', label: 'Rest Window' },
                { value: 'pending', label: 'Pending Verification' },
                { value: 'unavailable', label: 'Unavailable' },
              ]}
            />
          </div>
        </div>
      </Card>

      {errorMsg && <ErrorBanner message={errorMsg} onRetry={fetchDonors} />}

      <Card className="overflow-hidden shadow-sm">
        {loading ? (
          <TableSkeleton rows={5} />
        ) : donors.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-secondary">
            No donor records match your filter criteria.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-line-border text-[11px] font-bold uppercase tracking-wider text-ink-secondary">
                    <th className="py-3 px-5">Donor Name</th>
                    <th className="py-3 px-4">Antigen</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Consent</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Correct</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-border text-sm">
                  {donors.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-ink-main">{d.name}</div>
                        <div className="text-[11px] text-ink-secondary">
                          {d.referredBy ? `Invited by ${d.referredBy}` : 'Joined directly'}
                        </div>
                        {d.email && <div className="text-[11px] text-ink-muted">{d.email}</div>}
                      </td>
                      <td className="py-3.5 px-4">
                        <BloodGroupBadge group={d.bloodGroup} />
                        {d.bloodGroupVerified && (
                          <div className="mt-1 text-[10px] font-semibold text-emerald-700" title={d.bloodGroupVerifySource || ''}>✓ Verified</div>
                        )}
                        {d.onCall && <div className="mt-0.5 text-[10px] font-semibold text-brand-600">On call</div>}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-medium text-ink-main">{d.city}</div>
                        <div className="text-ink-secondary">{d.district}, {d.state}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono">
                        {d.phone}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        {d.consentStatus === 'granted' ? (
                          <span className="inline-flex items-center text-status-success font-semibold">
                            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                            Granted
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-status-error font-semibold">
                            <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                            Restricted
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(d)}
                          leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                        >
                          Edit
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

      {/* Administrative Correction Modal */}
      {editingDonor && (
        <Modal
          isOpen={Boolean(editingDonor)}
          onClose={() => setEditingDonor(null)}
          title={`Correct Donor Record: ${editingDonor.name}`}
          description={`Identifier: ${editingDonor.id}`}
        >
          <form onSubmit={handleSaveCorrection} className="space-y-4">
            <Input
              label="Donor Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Blood Group"
                value={editBloodGroup}
                onChange={(e) => setEditBloodGroup(e.target.value as BloodGroup)}
                options={BLOOD_GROUPS.map((g) => ({ value: g.value, label: g.label }))}
              />

              <Select
                label="Status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as DonorStatus)}
                options={[
                  { value: 'active', label: 'Active Ready' },
                  { value: 'cooling_off', label: 'Rest Window' },
                  { value: 'pending', label: 'Pending Verification' },
                  { value: 'unavailable', label: 'Unavailable' },
                ]}
              />
            </div>

            <div className="rounded-lg border border-line-border p-3 space-y-2">
              <label className="flex items-start gap-2 text-xs text-ink-main cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 w-4 h-4 accent-brand-600"
                  checked={editVerified}
                  onChange={(e) => setEditVerified(e.target.checked)}
                />
                <span>
                  <strong>Blood group verified.</strong> Tick only after seeing proof of this blood group. Donors with a verified group are contacted earlier.
                  Changing the blood group removes the tick unless you tick it again.
                </span>
              </label>
              {editVerified && (
                <Select
                  label="Proof seen"
                  value={editVerifySource}
                  onChange={(e) => setEditVerifySource(e.target.value)}
                  options={[
                    { value: 'blood bank card', label: 'Blood bank donor card' },
                    { value: 'lab report', label: 'Lab report' },
                    { value: 'donation record', label: 'Blood bank donation record' },
                    { value: 'checked by our team', label: 'Other (checked by our team)' },
                  ]}
                />
              )}
            </div>

            <div>
              <label htmlFor="notes" className="block text-xs font-semibold text-ink-main mb-1">
                Administrative Audit Notes:
              </label>
              <textarea
                id="notes"
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Reason for administrative correction (e.g. verified lab document provided)."
                className="w-full text-xs p-3 rounded-lg border border-line-border focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditingDonor(null)}
                disabled={savingCorrection}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={savingCorrection}
                leftIcon={<Save className="w-3.5 h-3.5" />}
              >
                Save Correction
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
