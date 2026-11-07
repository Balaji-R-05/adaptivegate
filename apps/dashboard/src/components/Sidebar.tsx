import { Link, useLocation } from 'react-router';
import { Icon } from './Icon';

const GITHUB_URL = 'https://github.com/Balaji-R-05/adaptivegate';

const NAV_ITEMS = [
  { path: '/overview', label: 'Overview', icon: 'grid_view' },
  { path: '/approvals', label: 'Approvals', icon: 'gpp_maybe' },
  { path: '/servers', label: 'Servers', icon: 'dns' },
  { path: '/marketplace', label: 'Marketplace', icon: 'storefront' },
  { path: '/connect', label: 'Connect', icon: 'terminal' },
  { path: '/policies', label: 'Policies', icon: 'policy' },
  { path: '/identities', label: 'Identities', icon: 'group' },
  { path: '/audit', label: 'Audit', icon: 'description' },
];

export function Sidebar({ pendingApprovals = 0 }: { pendingApprovals?: number }) {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-full w-64 flex-col justify-between bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="flex flex-col">
        <div className="flex h-14 items-center justify-between px-space-base shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-space-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary">
              <Icon name="hub" className="text-[18px] text-on-primary" />
            </div>
            <span className="font-sans text-base font-semibold tracking-tight text-on-surface">
              AdaptiveGate
            </span>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 p-space-sm">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between rounded-xl px-space-md py-space-sm transition-colors ${
                  active
                    ? 'bg-primary-container font-medium text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <div className="flex items-center gap-space-sm">
                  <Icon name={item.icon} className="text-[18px]" />
                  <span className="text-sm">{item.label}</span>
                </div>
                {item.path === '/approvals' && pendingApprovals > 0 && (
                  <span className="rounded-full bg-error-container px-space-xs py-0.5 text-[11px] font-semibold text-on-error-container">
                    {pendingApprovals}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex flex-col gap-space-sm p-space-base shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-space-xs rounded-xl bg-surface-container-low px-space-sm py-space-xs">
          <span className="h-2 w-2 animate-pulse rounded-full bg-tertiary-container" />
          <span className="truncate font-mono text-xs text-on-surface">gateway online</span>
        </div>
        <div className="flex items-center justify-between px-space-xs text-[11px] text-on-surface-variant">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-0.5 transition-colors hover:text-on-surface"
          >
            <Icon name="code" className="text-[14px]" />
            GitHub
          </a>
          <a
            href={`${GITHUB_URL}#readme`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-0.5 transition-colors hover:text-on-surface"
          >
            <Icon name="menu_book" className="text-[14px]" />
            Docs
          </a>
        </div>
      </div>
    </aside>
  );
}
