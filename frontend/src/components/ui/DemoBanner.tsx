import React, { useState } from 'react';
import { ShieldAlert, ChevronDown, ChevronUp, RotateCcw, User, ShieldCheck } from 'lucide-react';
import { appConfig } from '../../constants/config';
import { useAuth } from '../../hooks/useAuth';
import { mockStore } from '../../services/adapters/mock/mockStore';

export const DemoBanner: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { user, loginAsDemoUser, loginAsDemoAdmin, refreshSession } = useAuth();

  if (!appConfig.isDemo) {
    return (
      <div className="bg-emerald-700 text-white text-xs px-4 py-1.5 text-center font-medium">
        Connecting to Live Backend API ({appConfig.apiBaseUrl})
      </div>
    );
  }

  const handleResetData = () => {
    mockStore.reset();
    refreshSession();
    window.location.reload();
  };

  return (
    <aside aria-label="Demo Mode Notice" className="bg-brand-900 text-white text-xs border-b border-brand-800 shadow-sm relative z-40 transition-all">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <span className="font-semibold tracking-wide flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            DEMO MODE ACTIVE:
          </span>
          <span className="text-gray-300 hidden sm:inline">
            Fictional development data &amp; in-memory adapters. No backend connected.
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            className="inline-flex items-center text-amber-300 hover:text-white underline font-medium min-h-[32px] px-2 rounded focus:outline-none focus:ring-1 focus:ring-amber-300"
          >
            <span>{isExpanded ? 'Hide Shortcuts' : 'Demo Switcher'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="bg-brand-950 px-4 py-3 border-t border-brand-800/60 transition-all">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-gray-400 text-[11px] font-medium mr-1">Switch Identity:</span>
              <button
                type="button"
                onClick={loginAsDemoUser}
                className={`inline-flex items-center px-3 py-1 rounded text-xs font-medium transition-colors ${
                  user?.role === 'donor'
                    ? 'bg-brand-600 text-white font-bold ring-1 ring-white/40'
                    : 'bg-brand-800/80 text-gray-200 hover:bg-brand-700'
                }`}
              >
                <User className="w-3 h-3 mr-1.5" />
                Donor (Marcus Vance)
              </button>

              <button
                type="button"
                onClick={loginAsDemoAdmin}
                className={`inline-flex items-center px-3 py-1 rounded text-xs font-medium transition-colors ${
                  user?.role === 'admin'
                    ? 'bg-amber-600 text-white font-bold ring-1 ring-white/40'
                    : 'bg-brand-800/80 text-gray-200 hover:bg-brand-700'
                }`}
              >
                <ShieldCheck className="w-3 h-3 mr-1.5 text-amber-300" />
                Admin (Dr. Evelyn Reed)
              </button>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleResetData}
                className="inline-flex items-center text-gray-300 hover:text-white text-xs px-2.5 py-1 rounded bg-black/30 hover:bg-black/50 transition-colors"
              >
                <RotateCcw className="w-3 h-3 mr-1.5" />
                Reset Mock State
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
