import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-space-base shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}
