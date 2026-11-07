import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorBannerProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`rounded-xl border border-red-200 bg-red-50/70 p-4 text-left flex items-start space-x-3.5 ${className}`}
    >
      <div className="flex-shrink-0 text-status-error mt-0.5">
        <AlertCircle className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-status-error">{title}</h3>
        <p className="text-xs text-red-700 mt-0.5">{message}</p>
        {onRetry && (
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              className="border-red-300 text-status-error hover:bg-red-100"
            >
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
