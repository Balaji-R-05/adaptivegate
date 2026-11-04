export interface IndexedTool {
  name: string;
  description: string;
  serverId: string;
  // Embedding generation is infrastructure (model loading), not algorithm
  // logic, so it stays outside this package — callers hand in precomputed
  // vectors.
  embedding?: number[];
}

export interface RankedTool {
  name: string;
  score: number;
}
