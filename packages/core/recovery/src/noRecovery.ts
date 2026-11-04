import type { Operation, RecoveryPolicy } from './types';

// The baseline — one attempt, no retry/fallback/escalation. Useful as a
// comparison point for the others (CLAUDE.md: recovery policies "must be
// swappable and comparable").
export function noRecoveryPolicy<T>(operation: Operation<T>): RecoveryPolicy<T> {
  return {
    name: 'none',
    async run() {
      const result = await operation();
      return { result, attempts: 1, recovered: false };
    },
  };
}
