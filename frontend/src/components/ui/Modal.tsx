import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnOutsideClick?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
  closeOnOutsideClick = true,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-main/50 backdrop-blur-sm transition-opacity"
        onClick={() => closeOnOutsideClick && onClose()}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        ref={modalRef}
        className={`relative bg-white rounded-2xl shadow-modal border border-line-border w-full ${maxWidthStyles[maxWidth]} z-10 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200`}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-line-border">
          <div>
            {title && (
              <h2 id="modal-title" className="text-lg font-semibold text-ink-main">
                {title}
              </h2>
            )}
            {description && <p className="text-xs text-ink-secondary mt-0.5">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-ink-muted hover:text-ink-main min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[calc(100vh-12rem)] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
