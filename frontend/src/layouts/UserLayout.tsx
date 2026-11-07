import React from 'react';
import { Outlet } from 'react-router-dom';
import { UserNavbar } from '../components/navigation/UserNavbar';
import { UserBottomNav } from '../components/navigation/UserBottomNav';
import { DemoBanner } from '../components/ui/DemoBanner';
import { useNotifications } from '../hooks/useNotifications';

export const UserLayout: React.FC = () => {
  const { unreadCount } = useNotifications();

  return (
    <div className="min-h-screen flex flex-col bg-surface-light text-ink-main">
      <DemoBanner />
      <UserNavbar unreadCount={unreadCount} />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 md:pb-12">
        <Outlet />
      </main>
      <UserBottomNav unreadCount={unreadCount} />
    </div>
  );
};
