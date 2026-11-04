import { z } from 'zod';

// v1 of the policy DSL — matches the shape of CLAUDE.md's documented example
// policy YAML, minus `agent`, `budgets`, `when`, and the `redact` action
// (those are later build-order steps: budgets/identity and guards).
export const policyActionSchema = z.enum(['allow', 'deny', 'require_approval']);

export const policyRuleSchema = z.object({
  name: z.string().min(1),
  match: z.object({ tool: z.string().min(1) }),
  action: policyActionSchema,
});

export const policyDocumentSchema = z.object({
  version: z.literal(1),
  rules: z.array(policyRuleSchema),
});

export type PolicyAction = z.infer<typeof policyActionSchema>;
export type PolicyRule = z.infer<typeof policyRuleSchema>;
export type PolicyDocument = z.infer<typeof policyDocumentSchema>;
