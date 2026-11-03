import { z } from 'zod';

export const eventTypeSchema = z.enum([
  'tool_call',
  'policy_decision',
  'recovery_attempt',
  'approval_decision',
]);

export type EventType = z.infer<typeof eventTypeSchema>;

// `payload` is the per-type detail (tool name/args, policy verdict, recovery
// attempt outcome, etc.); secrets/PII must already be redacted by the time an
// event reaches this shape, per CLAUDE.md's audit-log conventions.
export const eventSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: eventTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.coerce.date(),
});

export type Event = z.infer<typeof eventSchema>;
