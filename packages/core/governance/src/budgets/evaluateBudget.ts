export interface BudgetVerdict {
  allowed: boolean;
  remaining: number | null;
}

// `limit === null` means "no budget configured" — always allowed, same
// fail-open-only-when-explicitly-unconfigured convention as identity scope.
export function evaluateBudget(used: number, limit: number | null): BudgetVerdict {
  if (limit === null) {
    return { allowed: true, remaining: null };
  }
  return { allowed: used < limit, remaining: Math.max(limit - used, 0) };
}
