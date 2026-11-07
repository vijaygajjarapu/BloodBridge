import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  HeartHandshake,
  Heart,
  LayoutDashboard,
  Users,
  Share2,
  Bell,
  User,
  LogOut,
  Settings,
  Shield,
  HelpCircle,
  Menu,
  X, Siren } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { ConfirmDialog } from '../feedback/ConfirmDialog';

export const UserNavbar: React.FC<{ unreadCount?: number }> = ({ unreadCount }) => {
  const { user, logout } = useAuth();
  const { unreadCount: liveUnreadCount } = useNotifications();
  const effectiveUnread = typeof unreadCount === 'number' ? unreadCount : liveUnreadCount;
  const location = useLocation();
  const navigate = useNavigate();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const navLinks = [
    { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
    { label: 'Requests', href: '/app/requests', icon: Siren },
    { label: 'My Family', href: '/app/family', icon: HeartHandshake },
    { label: 'My Donors', href: '/app/donors', icon: Users },
    { label: 'Referrals', href: '/app/referrals', icon: Share2 },
    { label: 'Notifications', href: '/app/notifications', icon: Bell, badge: effectiveUnread },
  ];

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false);
    await logout();
    navigate('/auth/login');
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white border-b border-line-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/app/dashboard" className="flex items-center space-x-3 min-h-[44px]">
              <div className="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-sm">
                <Heart className="w-5 h-5 fill-current" />
              </div>
              <div>
                <span className="text-lg font-extrabold tracking-tight text-ink-main block leading-none">
                  Blood<span className="text-brand-500">Bridge</span>
                </span>
                <span className="text-[10px] font-semibold text-brand-600 uppercase tracking-wider">
                  Donor Portal
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.href || location.pathname.startsWith(link.href + '/');
                return (
                  <Link
                    key={link.label}
                    to={link.href}
                    className={`relative inline-flex items-center px-3.5 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                      isActive
                        ? 'bg-brand-50 text-brand-600 font-semibold'
                        : 'text-ink-secondary hover:text-ink-main hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    <span>{link.label}</span>
                    {link.badge && link.badge > 0 ? (
                      <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold text-white bg-status-error rounded-full min-w-[18px]">
                        {link.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                aria-expanded={profileDropdownOpen}
                aria-haspopup="true"
                aria-label="User account menu"
                className="flex items-center space-x-2.5 p-1.5 rounded-xl hover:bg-gray-100 transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-xs ring-2 ring-white">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    user?.name?.charAt(0) || 'U'
                  )}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-semibold text-ink-main leading-tight">{user?.name || 'Marcus Vance'}</div>
                  <div className="text-[10px] text-brand-600 font-medium">Savior Donor</div>
                </div>
              </button>

              {profileDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-xl bg-white shadow-modal border border-line-border py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                  onClick={() => setProfileDropdownOpen(false)}
                >
                  <div className="px-4 py-2.5 border-b border-line-border">
                    <p className="text-xs font-semibold text-ink-main">{user?.name}</p>
                    <p className="text-[11px] text-ink-secondary truncate">{user?.email || user?.phone}</p>
                    <div className="mt-1 text-[10px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded font-mono font-medium inline-block">
                      {user?.referralCode}
                    </div>
                  </div>

                  <Link
                    to="/app/profile"
                    className="flex items-center px-4 py-2.5 text-xs text-ink-main hover:bg-gray-50 min-h-[40px]"
                  >
                    <User className="w-4 h-4 mr-2.5 text-ink-secondary" />
                    My Profile
                  </Link>

                  <Link
                    to="/app/settings/privacy"
                    className="flex items-center px-4 py-2.5 text-xs text-ink-main hover:bg-gray-50 min-h-[40px]"
                  >
                    <Shield className="w-4 h-4 mr-2.5 text-ink-secondary" />
                    Privacy &amp; Contact Sharing
                  </Link>

                  <Link
                    to="/app/settings"
                    className="flex items-center px-4 py-2.5 text-xs text-ink-main hover:bg-gray-50 min-h-[40px]"
                  >
                    <Settings className="w-4 h-4 mr-2.5 text-ink-secondary" />
                    Account Settings
                  </Link>

                  <Link
                    to="/app/help"
                    className="flex items-center px-4 py-2.5 text-xs text-ink-main hover:bg-gray-50 min-h-[40px]"
                  >
                    <HelpCircle className="w-4 h-4 mr-2.5 text-ink-secondary" />
                    Help &amp; Support
                  </Link>

                  <div className="border-t border-line-border my-1"></div>

                  <button
                    type="button"
                    onClick={() => setShowLogoutConfirm(true)}
                    className="flex w-full items-center px-4 py-2.5 text-xs text-status-error hover:bg-red-50 min-h-[40px] text-left font-medium"
                  >
                    <LogOut className="w-4 h-4 mr-2.5 text-status-error" />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleConfirmLogout}
        title="Log Out of BloodBridge"
        message="Are you sure you wish to log out? Your session token will be cleared from this device."
        confirmText="Log Out"
        isDestructive
      />
    </>
  );
};
