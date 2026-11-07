// Fault scenarios for the recovery/failure-injection benchmark — a spread
// of failure rates, from "never fails" (the baseline every policy should
// handle trivially) through "always fails" (nothing can save it, including
// retry — that's the point: it shows retry's limit, not a bug).

export interface FaultScenario {
  name: string;
  failureRate: number;
}

export const FAULT_SCENARIOS: FaultScenario[] = [
  { name: 'reliable', failureRate: 0 },
  { name: 'rare-failure', failureRate: 0.1 },
  { name: 'flaky', failureRate: 0.3 },
  { name: 'mostly-fails', failureRate: 0.7 },
  { name: 'always-fails', failureRate: 1 },
];
