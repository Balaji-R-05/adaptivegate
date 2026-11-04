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
  // Tool names aren't unique across a user's different servers (two
  // downstream servers can both happen to expose a tool called the same
  // thing) — serverId is what actually identifies a result, so callers must
  // key on (serverId, name), never name alone.
  serverId: string;
  score: number;
}
