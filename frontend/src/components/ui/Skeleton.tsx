import React from 'react';

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} {...props} />;
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="space-y-3 p-4">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center space-x-4">
        <Skeleton className="h-5 w-1/4" />
        <Skeleton className="h-5 w-1/6" />
        <Skeleton className="h-5 w-1/4" />
        <Skeleton className="h-5 w-1/6" />
        <Skeleton className="h-5 w-1/12" />
      </div>
    ))}
  </div>
);
