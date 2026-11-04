import { z } from 'zod';

// Envelope only — storing and versioning a policy document. The rule DSL
// inside `yaml` is validated by the policy engine itself
// (@adaptivegate/governance's parsePolicyDocument), not here.
export const policySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  version: z.number().int().positive(),
  yaml: z.string().min(1),
  createdAt: z.coerce.date(),
});

export type Policy = z.infer<typeof policySchema>;

// What a user actually submits when creating a policy — no id/userId/
// version/createdAt, those are assigned server-side.
export const createPolicyInputSchema = policySchema.pick({ name: true, yaml: true });

export type CreatePolicyInput = z.infer<typeof createPolicyInputSchema>;
