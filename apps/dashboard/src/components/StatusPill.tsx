import type { ReactNode } from 'react';

export type StatusVariant = 'allowed' | 'pending' | 'blocked' | 'neutral';

// Tint + border + dot, never a saturated block background — per the design
// system's "restrained semantic accenting" rule.
const VARIANT_CLASSES: Record<StatusVariant, { pill: string; dot: string }> = {
  allowed: { pill: 'bg-surface-container-high text-tertiary', dot: 'bg-tertiary' },
  pending: { pill: 'bg-surface-container-highest text-secondary', dot: 'bg-secondary' },
  blocked: { pill: 'bg-error-container text-on-error-container', dot: 'bg-error' },
  neutral: { pill: 'bg-surface-container-high text-on-surface-variant', dot: 'bg-outline' },
};

export function StatusPill({ variant, children }: { variant: StatusVariant; children: ReactNode }) {
  const classes = VARIANT_CLASSES[variant];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${classes.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${classes.dot}`} />
      {children}
    </span>
  );
}
