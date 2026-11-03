import { useSession } from './hooks/useSession';
import { supabase } from './lib/supabase';

function signInWithGitHub() {
  void supabase.auth.signInWithOAuth({ provider: 'github' });
}

function signOut() {
  void supabase.auth.signOut();
}

export function App() {
  const { session, loading } = useSession();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
      <h1 className="text-2xl font-semibold text-slate-900">AdaptiveGate Dashboard</h1>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : session ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-slate-700">Signed in as {session.user.email}</p>
          <button
            type="button"
            onClick={signOut}
            className="rounded bg-slate-900 px-4 py-2 text-white"
          >
            Sign out
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={signInWithGitHub}
          className="rounded bg-slate-900 px-4 py-2 text-white"
        >
          Sign in with GitHub
        </button>
      )}
    </main>
  );
}
