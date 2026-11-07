import { z } from 'zod';

// A named, scoped, budget-limited credential for one agent — see
// packages/db's `identities` table for the full rationale.
export const identitySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  serverScope: z.array(z.string().uuid()).nullable(),
  budgetLimit: z.number().int().positive().nullable(),
  policyId: z.string().uuid().nullable(),
  enabled: z.boolean(),
  createdAt: z.coerce.date(),
});

export type Identity = z.infer<typeof identitySchema>;

export const createIdentityInputSchema = identitySchema.pick({
  name: true,
  serverScope: true,
  budgetLimit: true,
  policyId: true,
});

export type CreateIdentityInput = z.infer<typeof createIdentityInputSchema>;

export const updateIdentityInputSchema = createIdentityInputSchema.partial().extend({
  enabled: z.boolean().optional(),
});

export type UpdateIdentityInput = z.infer<typeof updateIdentityInputSchema>;
