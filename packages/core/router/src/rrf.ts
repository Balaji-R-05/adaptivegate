import type { RankedTool } from './types';

// Standard RRF constant (the "60" from the original Cormack et al. paper,
// not tuned for this project specifically).
const DEFAULT_K = 60;

export function reciprocalRankFusion(rankedLists: RankedTool[][], k = DEFAULT_K): RankedTool[] {
  const scores = new Map<string, number>();

  for (const list of rankedLists) {
    list.forEach((item, rank) => {
      const current = scores.get(item.name) ?? 0;
      scores.set(item.name, current + 1 / (k + rank + 1));
    });
  }

  return Array.from(scores.entries())
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);
}
