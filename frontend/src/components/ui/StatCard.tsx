import React from 'react';
import { Card } from './Card';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  icon?: React.ReactNode;
  isSampleData?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  trend,
  icon,
  isSampleData = true,
}) => {
  return (
    <Card hoverable className="p-5 relative flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
            {label}
          </span>
          {icon && <div className="p-2.5 rounded-lg bg-brand-50 text-brand-500">{icon}</div>}
        </div>

        <div className="flex items-baseline space-x-2">
          <div className="text-2xl sm:text-3xl font-extrabold text-ink-main tracking-tight">
            {value}
          </div>
          {trend && (
            <span
              className={`inline-flex items-center text-xs font-semibold ${
                trend.isPositive ? 'text-status-success' : 'text-status-error'
              }`}
            >
              {trend.isPositive ? (
                <TrendingUp className="w-3.5 h-3.5 mr-0.5 inline" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 mr-0.5 inline" />
              )}
              {trend.value}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-line-border flex items-center justify-between text-xs text-ink-secondary">
        <span>{subtext || 'Active in network'}</span>
        {isSampleData && (
          <span className="text-[10px] uppercase font-bold text-ink-muted bg-gray-100 px-1.5 py-0.5 rounded">
            Sample Data
          </span>
        )}
      </div>
    </Card>
  );
};
