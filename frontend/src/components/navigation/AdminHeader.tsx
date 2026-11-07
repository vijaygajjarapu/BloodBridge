import React, { useState } from 'react';
import { Menu, ExternalLink, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ConfirmDialog } from '../feedback/ConfirmDialog';

export interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  onOpenMobileMenu: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ title, subtitle, onOpenMobileMenu }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await logout();
    navigate('/admin/login');
  };

  return (
    <>
      <header className="bg-white border-b border-line-border sticky top-0 z-20 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open administration menu"
            className="lg:hidden text-ink-main p-2 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px] inline-flex items-center justify-center focus:outline-none"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div>
            <h1 className="text-lg sm:text-xl font-bold text-ink-main tracking-tight leading-tight">
              {title}
            </h1>
            {subtitle && <p className="text-xs text-ink-secondary hidden sm:block">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <Link
            to="/app/dashboard"
            className="text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 px-3 py-2 rounded-lg transition-colors inline-flex items-center min-h-[44px]"
          >
            <span>Donor App</span>
            <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
          </Link>

          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            aria-label="Sign out of admin console"
            className="text-xs font-semibold text-ink-secondary hover:text-status-error px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors inline-flex items-center min-h-[44px]"
          >
            <LogOut className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Admin Console Sign Out"
        message="Are you sure you want to exit the administrative dashboard?"
        confirmText="Sign Out"
        isDestructive
      />
    </>
  );
};
