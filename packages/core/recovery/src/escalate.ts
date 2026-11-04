import type { Operation, RecoveryPolicy } from './types';

// "Give up and tell a human" — ties conceptually to the policy engine's
// require_approval outcome (packages/core/governance): both block and say
// so clearly, rather than silently failing or retrying something that
// shouldn't be retried blindly.
export class EscalationRequiredError extends Error {}

export function escalatePolicy<T>(operation: Operation<T>): RecoveryPolicy<T> {
  return {
    name: 'escalate',
    async run() {
      try {
        const result = await operation();
        return { result, attempts: 1, recovered: false };
      } catch (error) {
        throw new EscalationRequiredError(
          `operation failed and requires escalation: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  };
}
