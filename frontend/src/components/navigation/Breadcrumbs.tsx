import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export const Breadcrumbs: React.FC<{ items: BreadcrumbItem[] }> = ({ items }) => {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-1.5 text-xs text-ink-secondary py-2">
      <Link to="/app/dashboard" className="hover:text-brand-500 inline-flex items-center p-1 rounded">
        <Home className="w-3.5 h-3.5" />
      </Link>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={item.label}>
            <ChevronRight className="w-3.5 h-3.5 text-ink-muted" />
            {isLast || !item.href ? (
              <span className="font-semibold text-ink-main" aria-current="page">
                {item.label}
              </span>
            ) : (
              <Link to={item.href} className="hover:text-brand-500 truncate max-w-[150px] sm:max-w-none">
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
