import type { RankedTool } from './types';

// Standard RRF constant (the "60" from the original Cormack et al. paper,
// not tuned for this project specifically).
const DEFAULT_K = 60;

function toolKey(tool: { name: string; serverId: string }): string {
  return `${tool.serverId}:${tool.name}`;
}

// Keyed by (serverId, name), not name alone — two different tools from two
// different servers can genuinely share a name (seen for real: a "fixedqr"
// and a "fetcher" server both expose a tool called `generate_qr`). Keying by
// name alone would silently sum their unrelated scores together.
export function reciprocalRankFusion(rankedLists: RankedTool[][], k = DEFAULT_K): RankedTool[] {
  const scores = new Map<string, number>();
  const tools = new Map<string, { name: string; serverId: string }>();

  for (const list of rankedLists) {
    list.forEach((item, rank) => {
      const key = toolKey(item);
      const current = scores.get(key) ?? 0;
      scores.set(key, current + 1 / (k + rank + 1));
      tools.set(key, { name: item.name, serverId: item.serverId });
    });
  }

  return Array.from(scores.entries())
    .map(([key, score]) => {
      const tool = tools.get(key);
      if (!tool) throw new Error(`unreachable: no tool for key ${key}`);
      return { ...tool, score };
    })
    .sort((a, b) => b.score - a.score);
}
