import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Heart, ArrowLeft, ShieldCheck } from 'lucide-react';
import { DemoBanner } from '../components/ui/DemoBanner';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-surface-light text-ink-main">
      <DemoBanner />
      <header className="p-4 sm:p-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <Link to="/" className="flex items-center space-x-2.5 min-h-[44px]">
          <div className="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-sm">
            <Heart className="w-5 h-5 fill-current" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-ink-main">
            Blood<span className="text-brand-500">Bridge</span>
          </span>
        </Link>

        <Link
          to="/"
          className="text-xs font-semibold text-ink-secondary hover:text-brand-500 inline-flex items-center min-h-[44px] px-2 rounded"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Back to Home
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>

      <footer className="p-4 text-center text-xs text-ink-secondary">
        <div className="flex items-center justify-center space-x-1 mb-1">
          <ShieldCheck className="w-3.5 h-3.5 text-status-success" />
          <span>Encrypted Connection &bull; Healthcare Privacy Standard</span>
        </div>
        <p>© {new Date().getFullYear()} BloodBridge Platform. Be a Donor. Be a Savior.</p>
      </footer>
    </div>
  );
};
