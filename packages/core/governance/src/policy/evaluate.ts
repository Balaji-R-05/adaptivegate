import { matchesGlob } from './glob';
import type { PolicyDocument } from './schema';

export type PolicyVerdict =
  | { action: 'allow' }
  | { action: 'deny'; reason: string; ruleName: string }
  | { action: 'require_approval'; reason: string; ruleName: string };

// First matching rule wins; no match = allow. That "default allow" is a
// different thing from the fail-closed convention — fail-closed is about
// what happens when evaluation itself *errors* (see
// apps/server/src/governance/policyEngine.ts), not about the absence of a
// matching rule.
export function evaluatePolicy(document: PolicyDocument, input: { tool: string }): PolicyVerdict {
  for (const rule of document.rules) {
    if (matchesGlob(rule.match.tool, input.tool)) {
      if (rule.action === 'allow') {
        return { action: 'allow' };
      }
      return { action: rule.action, reason: `matched rule "${rule.name}"`, ruleName: rule.name };
    }
  }
  return { action: 'allow' };
}
