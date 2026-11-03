import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router';
import { useSession } from './hooks/useSession';
import { supabase } from './lib/supabase';
import { ConnectPage } from './pages/ConnectPage';
import { ServersPage } from './pages/ServersPage';

const queryClient = new QueryClient();

function signInWithGitHub() {
  void supabase.auth.signInWithOAuth({ provider: 'github' });
}

function signOut() {
  void supabase.auth.signOut();
}

function SignedInShell({ email }: { email: string | undefined }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-6">
          <span className="text-lg font-semibold text-slate-900">AdaptiveGate</span>
          <nav className="flex gap-4 text-sm text-slate-600">
            <Link to="/servers">Servers</Link>
            <Link to="/connect">Connect</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-600">
          <span>{email}</span>
          <button
            type="button"
            onClick={signOut}
            className="rounded bg-slate-900 px-3 py-1.5 text-white"
          >
            Sign out
          </button>
        </div>
      </header>
      <Routes>
        <Route path="/servers" element={<ServersPage />} />
        <Route path="/connect" element={<ConnectPage />} />
        <Route path="*" element={<Navigate to="/servers" replace />} />
      </Routes>
    </div>
  );
}

export function App() {
  const { session, loading } = useSession();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {loading ? (
          <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
            <h1 className="text-2xl font-semibold text-slate-900">AdaptiveGate Dashboard</h1>
            <p className="text-slate-500">Loading…</p>
          </main>
        ) : session ? (
          <SignedInShell email={session.user.email} />
        ) : (
          <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
            <h1 className="text-2xl font-semibold text-slate-900">AdaptiveGate Dashboard</h1>
            <button
              type="button"
              onClick={signInWithGitHub}
              className="rounded bg-slate-900 px-4 py-2 text-white"
            >
              Sign in with GitHub
            </button>
          </main>
        )}
      </BrowserRouter>
    </QueryClientProvider>
  );
}
