import { bm25Route } from './bm25';
import { embeddingRoute } from './embeddingSimilarity';
import { reciprocalRankFusion } from './rrf';
import type { IndexedTool, RankedTool } from './types';

// Rank the full set with each signal (not just topK) before fusing, so RRF
// has each tool's true rank position to work with.
export function hybridRoute(
  tools: IndexedTool[],
  query: string,
  queryEmbedding: number[],
  topK: number,
): RankedTool[] {
  const keyword = bm25Route(tools, query, tools.length);
  const semantic = embeddingRoute(tools, queryEmbedding, tools.length);
  return reciprocalRankFusion([keyword, semantic]).slice(0, topK);
}
