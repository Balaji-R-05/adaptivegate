-- `auth.users` already exists (it's Supabase Auth's own table, not ours) —
-- drizzle-kit wanted to CREATE it because our schema.ts declares a minimal
-- reference to it; that CREATE TABLE statement is deliberately dropped here.
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;