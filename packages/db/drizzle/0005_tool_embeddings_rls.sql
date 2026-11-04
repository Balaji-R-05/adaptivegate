-- Same pattern as the other four tables' RLS (see 0003_auth_sync_and_rls.sql):
-- enabled as a second layer behind application checks, reads scoped to the
-- owning user; writes go through the backend's service-role key.
ALTER TABLE public.tool_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own tool embeddings" ON public.tool_embeddings
  FOR SELECT USING (auth.uid() = user_id);
