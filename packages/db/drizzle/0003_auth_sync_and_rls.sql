-- Keep public.users in sync with Supabase Auth's auth.users, with no
-- application code involved: every new auth user gets a matching row here.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Row-level security as a second layer behind application checks (see
-- CLAUDE.md's Security conventions), independent of whether a client queries
-- these tables directly today. Writes still go through the backend's
-- service-role key, which bypasses RLS entirely.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own row" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users can update own row" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users can view own api keys" ON public.api_keys
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users can view own servers" ON public.servers
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users can view own policies" ON public.policies
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users can view own events" ON public.events
  FOR SELECT USING (auth.uid() = user_id);
