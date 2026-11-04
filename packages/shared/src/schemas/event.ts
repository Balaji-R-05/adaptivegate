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

// Query params for GET /api/events — all optional, same validate-at-the-
// boundary convention as the rest of packages/shared.
export const listEventsQuerySchema = z.object({
  type: eventTypeSchema.optional(),
  before: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;

export const eventStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  byType: z.record(eventTypeSchema, z.number().int().nonnegative()),
  blocked: z.number().int().nonnegative(),
  recovered: z.number().int().nonnegative(),
});

export type EventStats = z.infer<typeof eventStatsSchema>;
