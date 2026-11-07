/**
 * Runs the real governance stack (@adaptivegate/governance) against a
 * labeled set of attack and benign scenarios — the comparison CLAUDE.md's
 * Evaluation Notes ask for: "Governance: attack-block rate on the
 * benchmark, false-positive rate on benign tasks, and latency/token
 * overhead of governance checks."
 *
 * Run with: pnpm --filter @adaptivegate/benchmark run governance
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluatePolicy,
  hasToolDefinitionChanged,
  parsePolicyDocument,
  PolicyParseError,
  redactSecrets,
  scanForInjection,
} from '@adaptivegate/governance';
import {
  ATTACK_SCENARIOS,
  BENIGN_SCENARIOS,
  REDACTION_SCENARIOS,
  type Category,
  type Scenario,
} from './scenarios';

const TIMING_REPEATS = 500; // scenarios run in sub-millisecond time individually; repeat to get a stable mean

// Runs one scenario against its real check and returns whether the
// scenario's situation was flagged/blocked. Mirrors the exact checks
// gatewayServer.ts's call_tool performs — the kill-switch and scope checks
// are trivial one-liners there too, not worth a packages/core abstraction
// for a single boolean comparison.
function isFlagged(scenario: Scenario): boolean {
  switch (scenario.category) {
    case 'kill_switch':
      return !scenario.enabled;
    case 'scope':
      return scenario.serverScope !== null && !scenario.serverScope.includes(scenario.requestedServerId);
    case 'budget': {
      if (scenario.limit === null) return false;
      return scenario.used >= scenario.limit;
    }
    case 'policy': {
      if (!scenario.yaml) return true; // no policy configured — fail closed
      let document;
      try {
        document = parsePolicyDocument(scenario.yaml);
      } catch (error) {
        if (error instanceof PolicyParseError) return true; // fail closed
        throw error;
      }
      const verdict = evaluatePolicy(document, { tool: scenario.tool });
      return verdict.action !== 'allow';
    }
    case 'injection':
      return scanForInjection(scenario.text).flagged;
    case 'tool_integrity':
      return hasToolDefinitionChanged(scenario.previous, scenario.next);
  }
}

function timeCheck(scenario: Scenario): number {
  const start = performance.now();
  for (let i = 0; i < TIMING_REPEATS; i++) {
    isFlagged(scenario);
  }
  return (performance.now() - start) / TIMING_REPEATS;
}

async function main() {
  const attackResults = ATTACK_SCENARIOS.map((scenario) => ({
    scenario: scenario.name,
    category: scenario.category,
    flagged: isFlagged(scenario),
  }));
  const benignResults = BENIGN_SCENARIOS.map((scenario) => ({
    scenario: scenario.name,
    category: scenario.category,
    flagged: isFlagged(scenario),
  }));

  const attackBlockRate = attackResults.filter((r) => r.flagged).length / attackResults.length;
  const falsePositiveRate = benignResults.filter((r) => r.flagged).length / benignResults.length;

  const missedAttacks = attackResults.filter((r) => !r.flagged);
  const falsePositives = benignResults.filter((r) => r.flagged);

  const redactionResults = REDACTION_SCENARIOS.map((scenario) => {
    const { found } = redactSecrets(scenario.text);
    const detected = scenario.expectFound.every((f) => found.includes(f)) && (scenario.expectFound.length === 0) === (found.length === 0);
    return { scenario: scenario.name, expected: scenario.expectFound, found, detected };
  });
  const secretDetectionRate = redactionResults.filter((r) => r.detected).length / redactionResults.length;

  const latencyByCategory: Partial<Record<Category, number>> = {};
  for (const category of ['kill_switch', 'scope', 'budget', 'policy', 'injection', 'tool_integrity'] as Category[]) {
    const example = [...ATTACK_SCENARIOS, ...BENIGN_SCENARIOS].find((s) => s.category === category);
    if (example) latencyByCategory[category] = timeCheck(example);
  }

  console.log('\n=== Attack-block rate ===');
  console.table([
    { metric: 'attack-block rate', value: `${Math.round(attackBlockRate * 100)}% (${attackResults.length - missedAttacks.length}/${attackResults.length})` },
    { metric: 'false-positive rate', value: `${Math.round(falsePositiveRate * 100)}% (${falsePositives.length}/${benignResults.length})` },
    { metric: 'secret detection rate', value: `${Math.round(secretDetectionRate * 100)}% (${redactionResults.filter((r) => r.detected).length}/${redactionResults.length})` },
  ]);

  if (missedAttacks.length > 0) {
    console.log('\nAttacks NOT blocked/flagged (should be 0):');
    console.table(missedAttacks);
  }
  if (falsePositives.length > 0) {
    console.log('\nBenign scenarios incorrectly flagged:');
    console.table(falsePositives);
  }

  console.log('\n=== Mean latency per check category (ms) — no token overhead: these are local, deterministic checks, not LLM calls ===');
  console.table(
    Object.entries(latencyByCategory).map(([category, ms]) => ({ category, 'mean latency (ms)': ms!.toFixed(4) })),
  );

  const resultsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'experiments');
  mkdirSync(resultsDir, { recursive: true });
  const outPath = join(
    resultsDir,
    `governance-benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        note: 'No randomness involved — scenarios are static and deterministic, so there is no seed to record.',
        scenarioCounts: { attacks: attackResults.length, benign: benignResults.length, redaction: redactionResults.length },
        attackBlockRate,
        falsePositiveRate,
        secretDetectionRate,
        latencyByCategoryMs: latencyByCategory,
        tokenOverhead: 'none — governance checks are local deterministic computation, not LLM calls',
        attackResults,
        benignResults,
        redactionResults,
      },
      null,
      2,
    ),
  );
  console.log(`\nSaved results to ${outPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
