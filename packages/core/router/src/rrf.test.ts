import { describe, expect, it } from 'vitest';
import { reciprocalRankFusion } from './rrf';

describe('reciprocalRankFusion', () => {
  it('ranks an item highest when it ranks well in both lists', () => {
    const keyword = [
      { name: 'a', serverId: 's1', score: 1 },
      { name: 'b', serverId: 's1', score: 0.5 },
    ];
    const semantic = [
      { name: 'a', serverId: 's1', score: 0.9 },
      { name: 'c', serverId: 's1', score: 0.8 },
    ];
    const result = reciprocalRankFusion([keyword, semantic]);
    expect(result[0]?.name).toBe('a');
  });

  it('still includes an item that only appears in one list', () => {
    const keyword = [{ name: 'only-keyword', serverId: 's1', score: 1 }];
    const semantic = [{ name: 'only-semantic', serverId: 's1', score: 1 }];
    const result = reciprocalRankFusion([keyword, semantic]);
    expect(result.map((r) => r.name).sort()).toEqual(['only-keyword', 'only-semantic']);
  });

  // Regression test for a real bug found in production use: two different
  // tools from two different servers happened to both be named "generate_qr"
  // and their unrelated RRF contributions got silently summed, pushing an
  // irrelevant tool to rank #1 for an unrelated query.
  it('does not merge two different tools that share a name but not a server', () => {
    // Array position is rank. In each list, the unrelated "generate_qr" edges
    // out insider_transactions for that one list — but insider_transactions
    // is the only tool that's genuinely relevant in *both* lists. If the two
    // different generate_qr tools get merged by name alone (the bug), their
    // combined score (1/61 + 1/61 ≈ 0.0328) beats insider_transactions'
    // honest two-list score (1/62 + 1/62 ≈ 0.0323) — reproducing exactly
    // what happened with the real fixedqr/fetcher servers in production.
    const keyword = [
      { name: 'generate_qr', serverId: 'server-a', score: 1 },
      { name: 'insider_transactions', serverId: 'server-b', score: 0.9 },
    ];
    const semantic = [
      { name: 'generate_qr', serverId: 'server-c', score: 1 },
      { name: 'insider_transactions', serverId: 'server-b', score: 0.9 },
    ];

    const result = reciprocalRankFusion([keyword, semantic]);

    // The two differently-sourced "generate_qr" entries must stay separate,
    // each scored only on its own (weak) rank — not summed into one entry
    // that out-scores the tool that's actually relevant in both lists.
    const qrEntries = result.filter((r) => r.name === 'generate_qr');
    expect(qrEntries).toHaveLength(2);
    expect(qrEntries.map((r) => r.serverId).sort()).toEqual(['server-a', 'server-c']);

    const winner = result[0];
    expect(winner?.name).toBe('insider_transactions');
    expect(winner?.serverId).toBe('server-b');
  });
});
