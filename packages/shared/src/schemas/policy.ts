import { z } from 'zod';

// Envelope only, for now — storing and versioning a policy document. The rule
// DSL inside `yaml` is validated by the policy engine itself once it exists
// (build-order step: policy engine, budgets, identity and audit log).
export const policySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  version: z.number().int().positive(),
  yaml: z.string().min(1),
  createdAt: z.coerce.date(),
});

export type Policy = z.infer<typeof policySchema>;
