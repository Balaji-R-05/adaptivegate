import { describe, expect, it } from 'vitest';
import { embeddingRoute } from './embeddingSimilarity';
import type { IndexedTool } from './types';

const tools: IndexedTool[] = [
  { name: 'tool-a', description: 'a', serverId: 's1', embedding: [1, 0, 0] },
  { name: 'tool-b', description: 'b', serverId: 's1', embedding: [0, 1, 0] },
  { name: 'tool-c', description: 'c', serverId: 's1' }, // no embedding
];

describe('embeddingRoute', () => {
  it('ranks the closest vector first', () => {
    const result = embeddingRoute(tools, [1, 0.1, 0], 2);
    expect(result[0]?.name).toBe('tool-a');
  });

  it('ignores tools with no embedding', () => {
    const result = embeddingRoute(tools, [1, 0, 0], 10);
    expect(result.map((r) => r.name)).not.toContain('tool-c');
  });

  it('returns no more than topK results', () => {
    const result = embeddingRoute(tools, [1, 0, 0], 1);
    expect(result).toHaveLength(1);
  });
});
