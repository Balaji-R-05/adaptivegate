ALTER TABLE "events" ADD COLUMN "hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "previous_hash" text;