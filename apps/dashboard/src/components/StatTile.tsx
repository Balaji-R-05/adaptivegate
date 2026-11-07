import type { ReactNode } from 'react';
import { Card } from './Card';
import { Icon } from './Icon';

export function StatTile({
  label,
  value,
  icon,
  iconColorClass = 'text-primary',
  footer,
}: {
  label: string;
  value: string | number;
  icon: string;
  iconColorClass?: string;
  footer?: ReactNode;
}) {
  return (
    <Card className="flex h-36 flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
          {label}
        </span>
        <Icon name={icon} className={`text-[20px] opacity-80 ${iconColorClass}`} />
      </div>
      <span className="my-auto font-sans text-2xl font-semibold tracking-tight text-on-surface">
        {value}
      </span>
      {footer && <div className="pt-space-xs">{footer}</div>}
    </Card>
  );
}
