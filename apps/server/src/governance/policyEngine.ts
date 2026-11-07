import { db, policies } from '@adaptivegate/db';
import {
  evaluatePolicy,
  parsePolicyDocument,
  PolicyParseError,
  type PolicyVerdict,
} from '@adaptivegate/governance';
import { and, desc, eq } from 'drizzle-orm';

// "Latest wins" when no specific policy is pinned — see loadActivePolicyYaml.
async function loadLatestPolicyYaml(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ yaml: policies.yaml })
    .from(policies)
    .where(eq(policies.userId, userId))
    .orderBy(desc(policies.createdAt))
    .limit(1);

  return row?.yaml ?? null;
}

async function loadPolicyYamlById(userId: string, policyId: string): Promise<string | null> {
  const [row] = await db
    .select({ yaml: policies.yaml })
    .from(policies)
    .where(and(eq(policies.id, policyId), eq(policies.userId, userId)))
    .limit(1);

  return row?.yaml ?? null;
}

// `policyId` is an identity's pinned policy (packages/db's identities.policyId)
// — when set, it's used instead of "latest policy for this user" so
// different agent identities can be governed by different policy packs.
async function loadActivePolicyYaml(userId: string, policyId?: string | null): Promise<string | null> {
  if (policyId) {
    return loadPolicyYamlById(userId, policyId);
  }
  return loadLatestPolicyYaml(userId);
}

// Fail-closed in two distinct senses: no policy at all to evaluate against
// denies (CLAUDE.md: "default to fail closed... never silently allow"), and
// a policy that fails to parse/evaluate also denies — never falls through
// to an implicit allow.
export async function evaluateCallToolPolicy(
  userId: string,
  tool: string,
  policyId?: string | null,
): Promise<PolicyVerdict> {
  const yamlText = await loadActivePolicyYaml(userId, policyId);
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
