import { z } from 'zod';

// `hashedKey` only ever holds a hash — the raw key is shown once at creation
// and never persisted (see CLAUDE.md's API key handling conventions).
export const apiKeySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  hashedKey: z.string().min(1),
  label: z.string().min(1).max(100),
  createdAt: z.coerce.date(),
  revokedAt: z.coerce.date().nullable(),
});

export type ApiKey = z.infer<typeof apiKeySchema>;
