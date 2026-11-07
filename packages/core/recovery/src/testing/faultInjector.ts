// Deterministic (seeded) failure injection for benchmarking recovery
// policies — not used by the gateway itself, only by benchmark/recovery and
// anything else that wants a reproducible "this operation fails X% of the
// time" wrapper. A fixed seed always produces the same pass/fail sequence,
// which is what makes a failure-injection experiment's results reproducible
// (see CLAUDE.md's "save the config, policy and random seed used").

export class SimulatedFailureError extends Error {
  constructor() {
    super('simulated failure (fault injector)');
  }
}

// mulberry32 — a tiny, fast, deterministic PRNG. Not cryptographic; this is
// test/benchmark tooling, not security-sensitive randomness.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Wraps a real "succeed" callback so that, per seeded draw, it either calls
// through or throws SimulatedFailureError. `failureRate` of 0 never fails,
// 1 always fails. Each call to the returned function advances the PRNG, so
// repeated calls from the same injector form one continuous, reproducible
// sequence for a given seed.
export function createFaultInjector(seed: number, failureRate: number) {
  const next = mulberry32(seed);
  return function wrap<T>(succeed: () => T): () => Promise<T> {
    return async () => {
      if (next() < failureRate) {
        throw new SimulatedFailureError();
      }
      return succeed();
    };
  };
}
