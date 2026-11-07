import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Icon } from './components/Icon';
import { Sidebar } from './components/Sidebar';
import { useApprovals } from './hooks/useApprovals';
import { useSession } from './hooks/useSession';
import { supabase } from './lib/supabase';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { AuditPage } from './pages/AuditPage';
import { ConnectPage } from './pages/ConnectPage';
import { IdentitiesPage } from './pages/IdentitiesPage';
import { LandingPage } from './pages/LandingPage';
import { OverviewPage } from './pages/OverviewPage';
import { PoliciesPage } from './pages/PoliciesPage';
import { ServersPage } from './pages/ServersPage';

const queryClient = new QueryClient();

function signInWithGitHub() {
  void supabase.auth.signInWithOAuth({ provider: 'github' });
}

function signOut() {
  void supabase.auth.signOut();
}

function SignedInShell({ email }: { email: string | undefined }) {
  const { data: approvals } = useApprovals();
  const pendingCount = approvals?.filter((a) => a.status === 'pending' && !a.isExpired).length ?? 0;

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar pendingApprovals={pendingCount} />
      <header className="fixed left-64 right-0 top-0 z-40 flex h-14 items-center justify-between bg-surface/80 px-gutter-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
        <div className="flex items-center gap-space-sm text-sm font-medium text-on-surface-variant">
          <Icon name="hub" className="text-[18px]" />
          <span>MCP Gateway</span>
        </div>
        <div className="flex items-center gap-space-base">
          <div className="flex items-center gap-space-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
              <Icon name="person" className="text-[18px] text-on-primary" />
            </div>
            <span className="hidden text-sm text-on-surface sm:inline">{email}</span>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-1 text-xs font-medium text-on-surface-variant transition-colors hover:text-error"
          >
            <Icon name="logout" className="text-[16px]" />
            Sign out
          </button>
        </div>
      </header>
      <main className="min-h-screen w-full bg-surface pl-64 pt-14">
        <Routes>
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/servers" element={<ServersPage />} />
          <Route path="/connect" element={<ConnectPage />} />
          <Route path="/policies" element={<PoliciesPage />} />
          <Route path="/identities" element={<IdentitiesPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  const { session, loading } = useSession();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {loading ? (
          <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface">
            <h1 className="text-2xl font-semibold text-on-surface">AdaptiveGate Dashboard</h1>
            <p className="text-on-surface-variant">Loading…</p>
          </main>
        ) : session ? (
          <SignedInShell email={session.user.email} />
        ) : (
          <LandingPage onSignIn={signInWithGitHub} />
        )}
      </BrowserRouter>
    </QueryClientProvider>
  );
}
