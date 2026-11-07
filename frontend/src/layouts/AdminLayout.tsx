import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AdminSidebar } from '../components/navigation/AdminSidebar';
import { AdminHeader } from '../components/navigation/AdminHeader';
import { DemoBanner } from '../components/ui/DemoBanner';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/admin/dashboard': {
    title: 'Executive Overview',
    subtitle: 'System-wide donor metrics, verified referral rates, and emergency capacity',
  },
  '/admin/users': {
    title: 'User Management',
    subtitle: 'Manage community member profiles, accounts, and operational roles',
  },
  '/admin/donors': {
    title: 'Donor Registry & Verification',
    subtitle: 'Blood type matching records, location registries, and corrections',
  },
  '/admin/referrals': {
    title: 'Savior Referral Network',
    subtitle: 'Track invitations, conversion stats, and manage active code permissions',
  },
  '/admin/consents': {
    title: 'Consent & Privacy Compliance',
    subtitle: 'Audit trail of contact-sharing authorizations and withdrawal requests',
  },
  '/admin/audit-logs': {
    title: 'System Audit Logs',
    subtitle: 'Immutable record of security, consent, and administrative actions',
  },
  '/admin/settings': {
    title: 'Platform Settings',
    subtitle: 'Organization details, emergency dispatch helplines, and policy controls',
  },
};

export const AdminLayout: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();

  const currentMeta = PAGE_TITLES[location.pathname] || {
    title: 'Administrative Console',
    subtitle: 'BloodBridge Secure Operations',
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-ink-main">
      <DemoBanner />
      <div className="flex-1 flex w-full">
        <AdminSidebar
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <AdminHeader
            title={currentMeta.title}
            subtitle={currentMeta.subtitle}
            onOpenMobileMenu={() => setMobileSidebarOpen(true)}
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};
