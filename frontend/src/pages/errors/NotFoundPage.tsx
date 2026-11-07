import React from 'react';
import { Link } from 'react-router-dom';
import { HeartCrack, ArrowLeft, Home } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center shadow-sm">
        <HeartCrack className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <span className="text-xs font-mono font-bold text-brand-600 bg-brand-50 px-2.5 py-1 rounded">
          404 ERROR
        </span>
        <h1 className="text-3xl font-extrabold text-ink-main tracking-tight">
          Page Not Found
        </h1>
        <p className="text-sm text-ink-secondary max-w-sm mx-auto">
          The savior screen or referral link you requested could not be located or may have moved.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <Link to="/">
          <Button variant="primary" leftIcon={<Home className="w-4 h-4" />}>
            Return to Homepage
          </Button>
        </Link>
        <Link to="/app/dashboard">
          <Button variant="secondary">
            Go to Donor Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
};
