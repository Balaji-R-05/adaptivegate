export interface RecoveryOutcome<T> {
  result: T;
  attempts: number;
  recovered: boolean;
}

export type Operation<T> = () => Promise<T>;

// Swappable: any factory that wraps an Operation<T> into this shape can be
// used at the same call site (`policy.run()`). Comparable: every policy
// reports attempts/recovered in the same shape, regardless of strategy.
export interface RecoveryPolicy<T> {
  name: string;
  run(): Promise<RecoveryOutcome<T>>;
}
