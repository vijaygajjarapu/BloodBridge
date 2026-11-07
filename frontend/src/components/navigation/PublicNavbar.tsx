import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Heart, ShieldCheck, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';

export const PublicNavbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { label: 'How It Works', href: '/#how-it-works' },
    { label: 'About', href: '/about' },
    { label: 'Privacy & Safety', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-line-border transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center space-x-3 group min-h-[44px]">
            <div className="w-10 h-10 rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-sm group-hover:bg-brand-600 transition-colors">
              <Heart className="w-5 h-5 fill-current" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-ink-main block leading-none">
                Blood<span className="text-brand-500">Bridge</span>
              </span>
              <span className="text-[11px] font-medium text-ink-secondary tracking-wide hidden sm:block mt-1">
                Be a Donor. Be a Savior.
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.href;
              return (
                <Link
                  key={link.label}
                  to={link.href}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] inline-flex items-center ${
                    isActive
                      ? 'text-brand-500 font-semibold bg-brand-50'
                      : 'text-ink-secondary hover:text-ink-main hover:bg-gray-100'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center space-x-3">
            <Link to="/auth/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link to="/join/SAVIOR-MV2026">
              <Button
                variant="primary"
                size="sm"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="shadow-sm"
              >
                Join as Savior
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close main navigation menu' : 'Open main navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="text-ink-main p-2 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px] inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-line-border bg-white px-4 pt-2 pb-6 space-y-3 animate-in slide-in-from-top-4 duration-200">
          <div className="flex flex-col space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-lg text-base font-medium text-ink-main hover:bg-brand-50 hover:text-brand-600 transition-colors min-h-[44px] flex items-center"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="pt-4 border-t border-line-border flex flex-col space-y-2.5">
            <Link to="/auth/login" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="secondary" className="w-full justify-center">
                Sign In
              </Button>
            </Link>
            <Link to="/join/SAVIOR-MV2026" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="primary" className="w-full justify-center" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Join as Savior
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
