import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LogIn } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const UnauthorizedPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-sm">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded">
          403 FORBIDDEN
        </span>
        <h1 className="text-3xl font-extrabold text-ink-main tracking-tight">
          Access Restricted
        </h1>
        <p className="text-sm text-ink-secondary max-w-sm mx-auto">
          You do not have administrative clearance to access this console screen.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <Link to="/app/dashboard">
          <Button variant="primary">
            Return to Donor Portal
          </Button>
        </Link>
        <Link to="/admin/login">
          <Button variant="secondary" leftIcon={<LogIn className="w-4 h-4" />}>
            Admin Sign In
          </Button>
        </Link>
      </div>
    </div>
  );
};
