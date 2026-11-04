import type { Operation, RecoveryPolicy } from './types';

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function retryPolicy<T>(operation: Operation<T>, options: RetryOptions): RecoveryPolicy<T> {
  return {
    name: 'retry',
    async run() {
      let lastError: unknown;
      for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
        try {
          const result = await operation();
          return { result, attempts: attempt, recovered: attempt > 1 };
        } catch (error) {
          lastError = error;
          if (attempt < options.maxAttempts) {
            await delay(options.baseDelayMs * 2 ** (attempt - 1));
          }
        }
      }
      throw lastError;
    },
  };
}
