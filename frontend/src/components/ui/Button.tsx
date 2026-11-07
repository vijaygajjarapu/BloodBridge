import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      className = '',
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 min-h-[44px]';

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-xs tracking-wide min-w-[44px]',
      md: 'px-4 py-2 text-sm min-w-[44px]',
      lg: 'px-6 py-3 text-base min-w-[44px]',
    };

    const variantStyles = {
      primary:
        'bg-brand-500 hover:bg-brand-600 text-white shadow-sm hover:shadow focus:ring-brand-500 border border-transparent',
      secondary:
        'bg-white hover:bg-gray-50 text-ink-main border border-line-border hover:border-gray-300 shadow-sm focus:ring-gray-300',
      outline:
        'bg-transparent hover:bg-brand-50 text-brand-500 border border-brand-500 focus:ring-brand-500',
      danger:
        'bg-status-error hover:bg-red-800 text-white shadow-sm focus:ring-status-error border border-transparent',
      ghost:
        'bg-transparent hover:bg-gray-100 text-ink-main focus:ring-gray-200 border border-transparent',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin text-current" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="mr-2 inline-flex items-center">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="ml-2 inline-flex items-center">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
