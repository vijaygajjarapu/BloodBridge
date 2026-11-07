import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  HeartHandshake,
  Share2,
  ShieldCheck,
  TrendingUp,
  Activity,
  FileCheck2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { adminService } from '../../services';
import type { AdminOverviewMetrics } from '../../types/admin';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { CountryFilter } from '../../components/forms/CountryFilter';

export const AdminDashboardPage: React.FC = () => {
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await adminService.getOverviewMetrics(countryFilter);
      setMetrics(data);
    } catch (err: unknown) {
      setErrorMsg((err as { message?: string })?.message || 'Failed to load administrator metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [countryFilter]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex justify-end">
        <CountryFilter
          value={countryFilter}
          onChange={(c) => {
            setCountryFilter(c);
          }}
        />
      </div>
      {/* Overview Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-ink-main tracking-tight">
            System Operational Health
          </h2>
          <p className="text-xs sm:text-sm text-ink-secondary mt-0.5">
            Real-time donor pipeline, consent authorization rate, and verified referral metrics.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <Link to="/admin/donors">
            <Button variant="primary" size="sm" leftIcon={<HeartHandshake className="w-4 h-4" />}>
              Donor Database
            </Button>
          </Link>
          <Link to="/admin/audit-logs">
            <Button variant="secondary" size="sm">
              Audit Logs
            </Button>
          </Link>
        </div>
      </div>

      {errorMsg && <ErrorBanner message={errorMsg} onRetry={fetchMetrics} />}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-4 w-1/2 mb-3" />
              <Skeleton className="h-8 w-1/3 mb-2" />
            </Card>
          ))
        ) : (
          <>
            <StatCard
              label="Total Enrolled Donors"
              value={metrics?.totalDonors || 1184}
              subtext="Verified community pool"
              trend={{ value: '+14% this quarter', isPositive: true }}
              icon={<HeartHandshake className="w-5 h-5 text-brand-500" />}
              isSampleData
            />

            <StatCard
              label="Referral Registrations"
              value={metrics?.referralRegistrations || 842}
              subtext="71% of total enrollment"
              trend={{ value: 'Savior Circle', isPositive: true }}
              icon={<Share2 className="w-5 h-5 text-blue-600" />}
              isSampleData
            />

            <StatCard
              label="Consent Authorization Rate"
              value={`${metrics?.consentGrantedRate || 88.5}%`}
              subtext="Granted contact sharing"
              icon={<ShieldCheck className="w-5 h-5 text-status-success" />}
              isSampleData
            />

            <StatCard
              label="Emergency Ready Pool"
              value={metrics?.emergencyReadyCount || 645}
              subtext="Available for urgent calls"
              icon={<Activity className="w-5 h-5 text-amber-500" />}
              isSampleData
            />
          </>
        )}
      </div>

      {/* Recharts Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Registration Trends Chart */}
        <div className="lg:col-span-7">
          <Card className="h-full flex flex-col justify-between">
            <CardHeader>
              <div>
                <h3 className="font-bold text-sm text-ink-main">Registration &amp; Referral Growth</h3>
                <p className="text-xs text-ink-secondary">6-Month historical intake curve (Sample Data)</p>
              </div>
              <span className="text-[10px] uppercase font-bold text-ink-muted bg-gray-100 px-2 py-0.5 rounded">
                Trend Analysis
              </span>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              {loading || !metrics ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="h-64 sm:h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics.registrationTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EC" />
                      <XAxis dataKey="month" stroke="#69717D" fontSize={11} />
                      <YAxis stroke="#69717D" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#20252B',
                          color: '#FFFFFF',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="registrations"
                        name="Total Registrations"
                        stroke="#B91C2C"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="referrals"
                        name="Referral Intakes"
                        stroke="#18794E"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Blood Group Distribution Chart */}
        <div className="lg:col-span-5">
          <Card className="h-full flex flex-col justify-between">
            <CardHeader>
              <div>
                <h3 className="font-bold text-sm text-ink-main">Blood Group Inventory Distribution</h3>
                <p className="text-xs text-ink-secondary">Active donor counts by antigen profile</p>
              </div>
              <span className="text-[10px] uppercase font-bold text-ink-muted bg-gray-100 px-2 py-0.5 rounded">
                Demographics
              </span>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              {loading || !metrics ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="h-64 sm:h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.bloodGroupDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EC" />
                      <XAxis dataKey="group" stroke="#69717D" fontSize={11} />
                      <YAxis stroke="#69717D" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#20252B',
                          color: '#FFFFFF',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="count" name="Donors" fill="#B91C2C" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Administrative Action Panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/admin/users" className="block">
          <Card hoverable className="p-5">
            <div className="flex items-center space-x-3 mb-2">
              <Users className="w-5 h-5 text-brand-500" />
              <h4 className="font-bold text-sm text-ink-main">User Directory</h4>
            </div>
            <p className="text-xs text-ink-secondary">
              Review accounts, moderator roles, and account status suspensions.
            </p>
          </Card>
        </Link>

        <Link to="/admin/consents" className="block">
          <Card hoverable className="p-5">
            <div className="flex items-center space-x-3 mb-2">
              <FileCheck2 className="w-5 h-5 text-status-success" />
              <h4 className="font-bold text-sm text-ink-main">Consent Registry</h4>
            </div>
            <p className="text-xs text-ink-secondary">
              Audit contact-sharing permissions and track revocations across the network.
            </p>
          </Card>
        </Link>

        <Link to="/admin/audit-logs" className="block">
          <Card hoverable className="p-5">
            <div className="flex items-center space-x-3 mb-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <h4 className="font-bold text-sm text-ink-main">Audit &amp; Compliance</h4>
            </div>
            <p className="text-xs text-ink-secondary">
              Inspect immutable operator actions and emergency dispatch access logs.
            </p>
          </Card>
        </Link>
      </div>
    </div>
  );
};
