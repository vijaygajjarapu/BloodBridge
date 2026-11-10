import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  HeartHandshake,
  Share2,
  FileCheck2,
  ScrollText,
  Sliders,
  LogOut,
  X,
  ShieldCheck, Siren, Briefcase, Handshake } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export interface AdminSidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { label: 'Overview', to: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'User Directory', to: '/admin/users', icon: Users },
    { label: 'Donor Database', to: '/admin/donors', icon: HeartHandshake },
    { label: 'Referrals Network', to: '/admin/referrals', icon: Share2 },
    { label: 'Blood Requests', to: '/admin/requests', icon: Siren },
    { label: 'Organisations & Banks', to: '/admin/organisations', icon: Briefcase },
    { label: 'Partner Programmes', to: '/admin/partners', icon: Handshake },
    { label: 'Consent Registry', to: '/admin/consents', icon: FileCheck2 },
    { label: 'Audit Trail', to: '/admin/audit-logs', icon: ScrollText },
    { label: 'Platform Settings', to: '/admin/settings', icon: Sliders },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center font-bold shadow-md">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-base font-extrabold tracking-tight text-white block leading-none">
              Blood<span className="text-brand-400">Bridge</span>
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 mt-1 block">
              Administration
            </span>
          </div>
        </div>

        {/* Mobile Close Button */}
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close admin menu"
          className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Management Controls
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.label}
              to={item.to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                  isActive
                    ? 'bg-brand-500 text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4 mr-3 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Admin User Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-xs flex-shrink-0">
              {user?.name?.charAt(0) || 'A'}
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-white truncate">{user?.name || 'Administrator'}</div>
              <div className="text-[10px] text-slate-400 truncate">System Operator</div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            aria-label="Log out of admin console"
            className="text-slate-400 hover:text-status-error min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside aria-label="Admin Navigation" className="hidden lg:block w-64 h-screen sticky top-0 flex-shrink-0 border-r border-slate-800 shadow-md">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
