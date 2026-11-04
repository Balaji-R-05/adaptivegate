import type { IndexedTool, RankedTool } from './types';

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [index, value] of a.entries()) {
    const other = b[index] ?? 0;
    dot += value * other;
    normA += value * value;
    normB += other * other;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function embeddingRoute(
  tools: IndexedTool[],
  queryEmbedding: number[],
  topK: number,
): RankedTool[] {
  return tools
    .filter((tool): tool is IndexedTool & { embedding: number[] } => tool.embedding !== undefined)
    .map((tool) => ({
      name: tool.name,
      serverId: tool.serverId,
      score: cosineSimilarity(tool.embedding, queryEmbedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
