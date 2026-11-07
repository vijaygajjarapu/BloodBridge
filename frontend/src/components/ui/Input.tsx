import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, type = 'text', id, className = '', ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const errorId = inputId ? `${inputId}-error` : undefined;
    const helperId = inputId ? `${inputId}-helper` : undefined;

    const isPasswordType = type === 'password';
    const effectiveType = isPasswordType ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="w-full text-left">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-ink-main mb-1.5">
            {label}
            {props.required && <span className="text-status-error ml-1">*</span>}
          </label>
        )}
        <div className="relative rounded-lg shadow-sm">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={effectiveType}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={`block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-ink-main placeholder:text-ink-muted transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 min-h-[44px] ${
              leftIcon ? 'pl-10' : ''
            } ${rightIcon || isPasswordType ? 'pr-10' : ''} ${
              error ? 'border-status-error focus:ring-status-error' : 'border-line-border hover:border-gray-400'
            } ${className}`}
            {...props}
          />
          {isPasswordType ? (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-muted hover:text-ink-main min-h-[44px] min-w-[44px] justify-center focus:outline-none"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          ) : (
            rightIcon && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-ink-muted">
                {rightIcon}
              </div>
            )
          )}
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

Input.displayName = 'Input';
