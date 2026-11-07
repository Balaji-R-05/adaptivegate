import { z } from 'zod';

export const approvalStatusSchema = z.enum(['pending', 'approved', 'denied']);
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;

export const approvalSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  identityId: z.string().uuid().nullable(),
  tool: z.string().min(1),
  serverId: z.string().uuid(),
  argumentsRedacted: z.record(z.string(), z.unknown()).nullable(),
  ruleName: z.string(),
  status: approvalStatusSchema,
  decidedAt: z.coerce.date().nullable(),
  consumedAt: z.coerce.date().nullable(),
  expiresAt: z.coerce.date(),
  createdAt: z.coerce.date(),
});

export type Approval = z.infer<typeof approvalSchema>;

export const resolveApprovalInputSchema = z.object({
  decision: z.enum(['approved', 'denied']),
});

export type ResolveApprovalInput = z.infer<typeof resolveApprovalInputSchema>;
