/**
 * Measures the real recovery policies (@adaptivegate/recovery) under
 * injected failures — the comparison CLAUDE.md's Evaluation Notes ask for:
 * "Recovery: success rate and added latency under injected failures."
 *
 * Run with: pnpm --filter @adaptivegate/benchmark run recovery
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createFaultInjector,
  escalatePolicy,
  fallbackPolicy,
  noRecoveryPolicy,
  retryPolicy,
  type RecoveryPolicy,
} from '@adaptivegate/recovery';
import { FAULT_SCENARIOS } from './scenarios';

const SEED = 20261107; // fixed — reproducibility artifact (CLAUDE.md)
const TRIALS = 200;

type PolicyName = 'none' | 'retry' | 'fallback' | 'escalate';
const POLICY_NAMES: PolicyName[] = ['none', 'retry', 'fallback', 'escalate'];

function buildPolicy(name: PolicyName, op: () => Promise<string>): RecoveryPolicy<string> {
  switch (name) {
    case 'none':
      return noRecoveryPolicy(op);
    case 'retry':
      return retryPolicy(op, { maxAttempts: 3, baseDelayMs: 10 });
    case 'fallback':
      // The fallback is a separate, always-succeeding operation — modeling
      // "reroute to an equivalent tool on another server" without needing
      // search-based discovery (out of scope — see packages/core/recovery's
      // own comment on why fallback isn't wired into the gateway by
      // default yet).
      return fallbackPolicy(op, async () => 'fallback-result');
    case 'escalate':
      return escalatePolicy(op);
  }
}

// How many attempts a *failed* run actually made, per policy — only needed
// when the policy throws, since the thrown error doesn't carry this.
const ATTEMPTS_ON_FAILURE: Record<PolicyName, number> = { none: 1, retry: 3, fallback: 2, escalate: 1 };

interface TrialResult {
  succeeded: boolean;
  attempts: number;
  recovered: boolean;
  latencyMs: number;
}

async function runTrial(
  policyName: PolicyName,
  seed: number,
  failureRate: number,
): Promise<TrialResult> {
  const inject = createFaultInjector(seed, failureRate);
  const op = inject(() => 'ok');
  const policy = buildPolicy(policyName, op);

  const start = performance.now();
  try {
    const outcome = await policy.run();
    return {
      succeeded: true,
      attempts: outcome.attempts,
      recovered: outcome.recovered,
      latencyMs: performance.now() - start,
    };
  } catch {
    return {
      succeeded: false,
      attempts: ATTEMPTS_ON_FAILURE[policyName],
      recovered: false,
      latencyMs: performance.now() - start,
    };
  }
}

async function main() {
  const results: Array<{
    scenario: string;
    failureRate: number;
    policy: PolicyName;
    successRate: number;
    meanAttempts: number;
    recoveredRate: number;
    meanLatencyMs: number;
    addedLatencyMs: number;
  }> = [];

  let baselineLatencyMs = 0;

  for (const scenario of FAULT_SCENARIOS) {
    for (const policyName of POLICY_NAMES) {
      const trials: TrialResult[] = [];
      for (let i = 0; i < TRIALS; i++) {
        trials.push(await runTrial(policyName, SEED + i, scenario.failureRate));
      }

      const successRate = trials.filter((t) => t.succeeded).length / TRIALS;
      const meanAttempts = trials.reduce((sum, t) => sum + t.attempts, 0) / TRIALS;
      const recoveredRate = trials.filter((t) => t.recovered).length / TRIALS;
      const meanLatencyMs = trials.reduce((sum, t) => sum + t.latencyMs, 0) / TRIALS;

      if (scenario.name === 'reliable' && policyName === 'none') {
        baselineLatencyMs = meanLatencyMs;
      }

      results.push({
        scenario: scenario.name,
        failureRate: scenario.failureRate,
        policy: policyName,
        successRate,
        meanAttempts,
        recoveredRate,
        meanLatencyMs,
        addedLatencyMs: meanLatencyMs - baselineLatencyMs,
      });
    }
  }

  console.table(
    results.map((r) => ({
      scenario: r.scenario,
      policy: r.policy,
      'success rate': `${Math.round(r.successRate * 100)}%`,
      'mean attempts': r.meanAttempts.toFixed(2),
      'recovered rate': `${Math.round(r.recoveredRate * 100)}%`,
      'added latency (ms)': r.addedLatencyMs.toFixed(2),
    })),
  );

  const resultsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'experiments');
  mkdirSync(resultsDir, { recursive: true });
  const outPath = join(
    resultsDir,
    `recovery-benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        config: { seed: SEED, trialsPerPair: TRIALS, scenarios: FAULT_SCENARIOS, policies: POLICY_NAMES },
        results,
      },
      null,
      2,
    ),
  );
  console.log(`Saved results to ${outPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
