import { useEffect, type ReactNode } from 'react';
import { Icon } from './Icon';

// Minimal hand-rolled overlay — no shadcn/ui dialog is installed in this
// project yet, and this is the first place that needs one, so a small
// primitive matching the existing design tokens beats adding a dependency
// for a single use site. Closes on Escape, backdrop click, or the explicit
// close button; the caller owns open/closed state.
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-gutter-md"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col gap-space-base overflow-y-auto rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-space-lg shadow-lg"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-lg font-semibold text-on-surface">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
            aria-label="Close"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
