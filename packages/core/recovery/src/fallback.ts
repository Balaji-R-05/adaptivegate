import type { Operation, RecoveryPolicy } from './types';

export function fallbackPolicy<T>(primary: Operation<T>, fallback: Operation<T>): RecoveryPolicy<T> {
  return {
    name: 'fallback',
    async run() {
      try {
        const result = await primary();
        return { result, attempts: 1, recovered: false };
      } catch {
        const result = await fallback();
        return { result, attempts: 2, recovered: true };
      }
    },
  };
}
