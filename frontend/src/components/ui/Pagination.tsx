import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
}) => {
  if (totalPages <= 1) return null;

  const startItem = totalItems && pageSize ? (currentPage - 1) * pageSize + 1 : null;
  const endItem = totalItems && pageSize ? Math.min(currentPage * pageSize, totalItems) : null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-line-border bg-white rounded-b-xl">
      <div className="text-xs text-ink-secondary">
        {startItem && endItem && totalItems ? (
          <span>
            Showing <strong className="font-semibold text-ink-main">{startItem}</strong> to{' '}
            <strong className="font-semibold text-ink-main">{endItem}</strong> of{' '}
            <strong className="font-semibold text-ink-main">{totalItems}</strong> entries
          </span>
        ) : (
          <span>
            Page <strong className="font-semibold text-ink-main">{currentPage}</strong> of{' '}
            <strong className="font-semibold text-ink-main">{totalPages}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center space-x-1">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-2 rounded-lg text-ink-secondary hover:text-ink-main hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          <span className="text-sm font-medium hidden sm:inline">Prev</span>
        </button>

        <div className="flex items-center space-x-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
            // Display first, last, and current +/- 1
            if (
              page === 1 ||
              page === totalPages ||
              (page >= currentPage - 1 && page <= currentPage + 1)
            ) {
              const isActive = page === currentPage;
              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => onPageChange(page)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-500 text-white font-semibold shadow-sm'
                      : 'text-ink-secondary hover:text-ink-main hover:bg-gray-100'
                  }`}
                >
                  {page}
                </button>
              );
            }
            if (page === currentPage - 2 || page === currentPage + 2) {
              return (
                <span key={page} className="px-2 text-ink-muted">
                  ...
                </span>
              );
            }
            return null;
          })}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-2 rounded-lg text-ink-secondary hover:text-ink-main hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <span className="text-sm font-medium hidden sm:inline">Next</span>
          <ChevronRight className="w-5 h-5 ml-1" />
        </button>
      </div>
    </div>
  );
};
