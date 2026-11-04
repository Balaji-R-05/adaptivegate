import { describe, expect, it } from 'vitest';
import { reciprocalRankFusion } from './rrf';

describe('reciprocalRankFusion', () => {
  it('ranks an item highest when it ranks well in both lists', () => {
    const keyword = [
      { name: 'a', score: 1 },
      { name: 'b', score: 0.5 },
    ];
    const semantic = [
      { name: 'a', score: 0.9 },
      { name: 'c', score: 0.8 },
    ];
    const result = reciprocalRankFusion([keyword, semantic]);
    expect(result[0]?.name).toBe('a');
  });

  it('still includes an item that only appears in one list', () => {
    const keyword = [{ name: 'only-keyword', score: 1 }];
    const semantic = [{ name: 'only-semantic', score: 1 }];
    const result = reciprocalRankFusion([keyword, semantic]);
    expect(result.map((r) => r.name).sort()).toEqual(['only-keyword', 'only-semantic']);
  });
});
