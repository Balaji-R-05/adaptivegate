import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';

interface UseSessionResult {
  session: Session | null;
  loading: boolean;
}

// Wraps Supabase's own session handling (getSession + onAuthStateChange)
// instead of rolling our own token storage. `loading` now also covers the
// one-time runtime config fetch getSupabase() does before the client can
// exist at all (see lib/supabase.ts).
export function useSession(): UseSessionResult {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    getSupabase().then((supabase) => {
      supabase.auth.getSession().then(({ data }) => {
        setSession(data.session);
        setLoading(false);
      });

      const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
      });
      unsubscribe = () => subscription.subscription.unsubscribe();
    });

    return () => unsubscribe?.();
  }, []);

  return { session, loading };
}
