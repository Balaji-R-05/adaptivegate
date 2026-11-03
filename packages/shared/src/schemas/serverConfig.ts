import { z } from 'zod';

// Discriminated union over auth strategy, instead of optional fields for each case.
export const serverAuthSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bearer'), tokenEnv: z.string().min(1) }),
  z.object({ type: z.literal('none') }),
]);

export type ServerAuth = z.infer<typeof serverAuthSchema>;

// `url` is shape-validated here only. SSRF checks (blocking localhost, private
// IP ranges and cloud metadata addresses) need a runtime DNS/network check and
// are enforced by the gateway when a server is saved or called, not here.
export const serverConfigSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  url: z.string().url(),
  auth: serverAuthSchema,
  enabledTools: z.array(z.string()).default([]),
  createdAt: z.coerce.date(),
});

export type ServerConfig = z.infer<typeof serverConfigSchema>;
