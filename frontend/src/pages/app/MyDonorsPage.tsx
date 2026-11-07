import React, { useState, useEffect } from 'react';
import { useSubscription } from '../../hooks/useSubscription';
import { LockedShareButton } from '../../components/subscription/SubscribeToShareNotice';
import { Link } from 'react-router-dom';
import {
  Search,
  Filter,
  Users,
  ChevronRight,
  ArrowUpDown,
  RefreshCw,
  MapPin,
  Calendar,
  Share2,
} from 'lucide-react';
import { donorService } from '../../services';
import type { DonorSummary, BloodGroup, DonorStatus } from '../../types/donor';
import { useDebounce } from '../../hooks/useDebounce';
import { BLOOD_GROUPS } from '../../constants/bloodGroups';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { BloodGroupBadge, StatusBadge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../constants/countries';

export const MyDonorsPage: React.FC = () => {
  // Inviting donors (sharing the savior link) is a subscriber feature
  const { subscribed: canShare, loading: subLoading } = useSubscription();
  const shareLocked = !subLoading && !canShare;
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const [selectedBloodGroup, setSelectedBloodGroup] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'registeredAt' | 'bloodGroup'>('registeredAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [donors, setDonors] = useState<DonorSummary[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchDonors = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await donorService.listMyDonors({
        search: debouncedSearch,
        bloodGroup: selectedBloodGroup === 'ALL' ? undefined : (selectedBloodGroup as BloodGroup),
        status: selectedStatus === 'ALL' ? undefined : (selectedStatus as DonorStatus),
        sortBy,
        sortOrder,
        page,
        pageSize,
      });

      setDonors(res.data);
      setTotalItems(res.total);
      setTotalPages(res.totalPages);
    } catch (err: unknown) {
      setErrorMsg((err as { message?: string })?.message || 'Failed to fetch donor records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonors();
  }, [debouncedSearch, selectedBloodGroup, selectedStatus, sortBy, sortOrder, page]);

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-main tracking-tight">
            My Savior Donors
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">
            Registered donors in your emergency referral network ({totalItems} total)
          </p>
        </div>

        {canShare ? (
          <Link to="/app/referrals/share">
            <Button variant="primary" leftIcon={<Share2 className="w-4 h-4" />}>
              Invite New Donor
            </Button>
          </Link>
        ) : shareLocked ? (
          <LockedShareButton label="Invite New Donor" />
        ) : null}
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Search Field */}
          <div className="lg:col-span-5">
            <Input
              placeholder="Search by name, city, blood type..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          {/* Blood Group Filter */}
          <div className="lg:col-span-3">
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

          {/* Status Filter */}
          <div className="lg:col-span-2">
            <Select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'active', label: 'Active Ready' },
                { value: 'cooling_off', label: 'Rest Window' },
                { value: 'pending', label: 'Pending' },
                { value: 'unavailable', label: 'Unavailable' },
              ]}
            />
          </div>

          {/* Sort Control */}
          <div className="lg:col-span-2 flex items-center space-x-1">
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              options={[
                { value: 'registeredAt', label: 'Registered' },
                { value: 'name', label: 'Name' },
                { value: 'bloodGroup', label: 'Blood Type' },
              ]}
            />
            <button
              type="button"
              onClick={toggleSortOrder}
              aria-label={`Sort ${sortOrder === 'asc' ? 'ascending' : 'descending'}`}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2 rounded-lg border border-line-border hover:bg-gray-100 text-ink-secondary"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {errorMsg && <ErrorBanner message={errorMsg} onRetry={fetchDonors} />}

      {/* Loading State */}
      {loading ? (
        <Card>
          <TableSkeleton rows={5} />
        </Card>
      ) : donors.length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8" />}
          title="No Matching Donors Found"
          description={
            search || selectedBloodGroup !== 'ALL' || selectedStatus !== 'ALL'
              ? 'No registered donors match your current filter criteria. Try clearing filters.'
              : 'You have not registered any donors in your savior circle yet.'
          }
          actionText={
            search || selectedBloodGroup !== 'ALL' || selectedStatus !== 'ALL'
              ? 'Clear All Filters'
              : 'Invite Donors'
          }
          onAction={() => {
            if (search || selectedBloodGroup !== 'ALL' || selectedStatus !== 'ALL') {
              setSearch('');
              setSelectedBloodGroup('ALL');
              setSelectedStatus('ALL');
              setPage(1);
            } else {
              window.location.href = canShare ? '/app/referrals/share' : '/app/subscribe';
            }
          }}
        />
      ) : (
        <Card className="overflow-hidden shadow-sm">
          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-line-border text-[11px] font-bold uppercase tracking-wider text-ink-secondary">
                  <th className="py-3 px-5">Donor Name</th>
                  <th className="py-3 px-4">Blood Group</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Willingness</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Registered</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-border text-sm">
                {donors.map((donor) => (
                  <tr key={donor.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-4 px-5">
                      <Link
                        to={`/app/donors/${donor.id}`}
                        className="font-bold text-ink-main hover:text-brand-500"
                      >
                        {donor.name}
                      </Link>
                    </td>
                    <td className="py-4 px-4">
                      <BloodGroupBadge group={donor.bloodGroup} />
                    </td>
                    <td className="py-4 px-4 text-xs text-ink-secondary">
                      <div className="flex items-center">
                        <MapPin className="w-3.5 h-3.5 mr-1 text-ink-muted flex-shrink-0" />
                        <span>
                          {donor.location.city}, {donor.location.state}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-xs capitalize text-ink-main">
                      {donor.willingness.replace('_', ' ')}
                    </td>
                    <td className="py-4 px-4">
                      <StatusBadge status={donor.status} />
                    </td>
                    <td className="py-4 px-4 text-xs text-ink-secondary">
                      {formatDate(donor.registeredAt)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Link
                        to={`/app/donors/${donor.id}`}
                        className="inline-flex items-center text-xs font-semibold text-brand-600 hover:text-brand-700 min-h-[44px] px-2 rounded"
                      >
                        <span>View</span>
                        <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout (< 768px) */}
          <div className="md:hidden divide-y divide-line-border">
            {donors.map((donor) => (
              <div key={donor.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <BloodGroupBadge group={donor.bloodGroup} />
                    <div>
                      <Link
                        to={`/app/donors/${donor.id}`}
                        className="font-bold text-base text-ink-main hover:text-brand-500 block"
                      >
                        {donor.name}
                      </Link>
                      <span className="text-xs text-ink-secondary capitalize">
                        {donor.willingness.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={donor.status} />
                </div>

                <div className="flex items-center justify-between text-xs text-ink-secondary pt-1">
                  <span className="flex items-center">
                    <MapPin className="w-3.5 h-3.5 mr-1 text-ink-muted" />
                    {donor.location.city}, {donor.location.state}
                  </span>
                  <span className="flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1 text-ink-muted" />
                    {formatDate(donor.registeredAt)}
                  </span>
                </div>

                <div className="pt-1">
                  <Link to={`/app/donors/${donor.id}`} className="block">
                    <Button variant="secondary" size="sm" className="w-full justify-between">
                      <span>View Donor Details</span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
          />
        </Card>
      )}
    </div>
  );
};
