import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  helperText?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, helperText, id, className = '', ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const errorId = selectId ? `${selectId}-error` : undefined;
    const helperId = selectId ? `${selectId}-helper` : undefined;

    return (
      <div className="w-full text-left">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-ink-main mb-1.5">
            {label}
            {props.required && <span className="text-status-error ml-1">*</span>}
          </label>
        )}
        <div className="relative rounded-lg shadow-sm">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={`block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-ink-main transition-colors appearance-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 min-h-[44px] cursor-pointer ${
              error ? 'border-status-error focus:ring-status-error' : 'border-line-border hover:border-gray-400'
            } ${className}`}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-ink-muted">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>
        {error && (
          <p id={errorId} className="mt-1.5 text-xs text-status-error flex items-center font-medium" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="mt-1.5 text-xs text-ink-secondary">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
