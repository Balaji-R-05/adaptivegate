import { db, policies } from '@adaptivegate/db';
import {
  evaluatePolicy,
  parsePolicyDocument,
  PolicyParseError,
  type PolicyVerdict,
} from '@adaptivegate/governance';
import { desc, eq } from 'drizzle-orm';

// "Latest wins" — no named-policy selection yet (that's a dashboard
// Policies-page concern). Just the most recently created row for this user.
async function loadActivePolicyYaml(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ yaml: policies.yaml })
    .from(policies)
    .where(eq(policies.userId, userId))
    .orderBy(desc(policies.createdAt))
    .limit(1);

  return row?.yaml ?? null;
}

// Fail-closed in two distinct senses: no policy at all to evaluate against
// denies (CLAUDE.md: "default to fail closed... never silently allow"), and
// a policy that fails to parse/evaluate also denies — never falls through
// to an implicit allow.
export async function evaluateCallToolPolicy(userId: string, tool: string): Promise<PolicyVerdict> {
  const yamlText = await loadActivePolicyYaml(userId);
  if (!yamlText) {
    return { action: 'deny', reason: 'no policy configured for this account', ruleName: '(none)' };
  }

  try {
    const document = parsePolicyDocument(yamlText);
    return evaluatePolicy(document, { tool });
  } catch (error) {
    const reason =
      error instanceof PolicyParseError ? error.message : 'policy evaluation failed unexpectedly';
    return { action: 'deny', reason, ruleName: '(error)' };
  }
}
