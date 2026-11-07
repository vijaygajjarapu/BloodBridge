import React from 'react';
import type { BloodGroup, DonorStatus } from '../../types/donor';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'blood' | 'success' | 'warning' | 'error' | 'neutral' | 'info';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
  ...props
}) => {
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs font-semibold',
    md: 'px-2.5 py-1 text-xs font-semibold',
  };

  const variantStyles = {
    blood: 'bg-brand-50 text-brand-600 border border-brand-200 font-bold',
    success: 'bg-emerald-50 text-status-success border border-emerald-200',
    warning: 'bg-amber-50 text-status-warning border border-amber-200',
    error: 'bg-red-50 text-status-error border border-red-200',
    neutral: 'bg-gray-100 text-ink-secondary border border-line-border',
    info: 'bg-blue-50 text-blue-700 border border-blue-200',
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full tracking-wide transition-colors ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

export const BloodGroupBadge: React.FC<{ group: BloodGroup; size?: 'sm' | 'md' }> = ({ group, size = 'md' }) => {
  return (
    <Badge variant="blood" size={size} className="font-extrabold tracking-wider">
      {group}
    </Badge>
  );
};

export const StatusBadge: React.FC<{ status: DonorStatus | 'active' | 'suspended' | 'pending' | 'verified' | string }> = ({
  status,
}) => {
  switch (status) {
    case 'active':
    case 'verified':
      return <Badge variant="success">Active</Badge>;
    case 'pending':
      return <Badge variant="warning">Pending Verification</Badge>;
    case 'cooling_off':
      return <Badge variant="info">Rest Window</Badge>;
    case 'unavailable':
    case 'suspended':
      return <Badge variant="error">{status === 'suspended' ? 'Suspended' : 'Unavailable'}</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
};
