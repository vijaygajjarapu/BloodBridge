import React from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, error, id, className = '', ...props }, ref) => {
    const inputId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : `cb_${Math.random().toString(36).substring(2, 6)}`);
    const errorId = `${inputId}-error`;

    return (
      <div className="w-full text-left">
        <label htmlFor={inputId} className="flex items-start cursor-pointer select-none group min-h-[44px] py-1">
          <div className="flex items-center h-5 mt-0.5">
            <input
              ref={ref}
              id={inputId}
              type="checkbox"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              className={`h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 cursor-pointer transition-colors ${
                error ? 'border-status-error' : ''
              } ${className}`}
              {...props}
            />
          </div>
          <div className="ml-3 text-sm">
            <span className="font-medium text-ink-main group-hover:text-black">{label}</span>
            {description && <p className="text-xs text-ink-secondary mt-0.5">{description}</p>}
          </div>
        </label>
        {error && (
          <p id={errorId} className="ml-7 mt-0.5 text-xs text-status-error font-medium" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
