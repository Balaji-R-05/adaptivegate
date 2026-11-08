// Deliberately narrow and specific — matches only the most unambiguous
// prompt-injection phrasing, to keep false positives low on real tool
// output. A broader/fuzzier scanner would catch more real attacks but also
// flag innocuous text far more often.
const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all |any |the )?(previous|prior|above) instructions/i,
  /disregard (your |the )?(system prompt|previous instructions)/i,
  /you are now in (developer|dan|jailbreak) mode/i,
  /forget (everything|all) (you were told|above)/i,
  /\bnew system prompt\b/i,
];

export interface InjectionScanResult {
  flagged: boolean;
  matches: string[];
}

export function scanForInjection(text: string): InjectionScanResult {
  const matches = INJECTION_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) =>
    pattern.source,
  );
  return { flagged: matches.length > 0, matches };
}
