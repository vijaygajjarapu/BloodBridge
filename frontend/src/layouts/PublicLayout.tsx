import React from 'react';
import { Outlet } from 'react-router-dom';
import { PublicNavbar } from '../components/navigation/PublicNavbar';
import { PublicFooter } from '../components/navigation/PublicFooter';
import { DemoBanner } from '../components/ui/DemoBanner';

export const PublicLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-surface-light text-ink-main">
      <DemoBanner />
      <PublicNavbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
};
